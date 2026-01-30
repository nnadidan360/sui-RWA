/**
 * Administrative Authentication Service
 * 
 * Handles admin login, logout, session management, and security features
 */

import bcrypt from 'bcryptjs';
import { AdminUser, LoginCredentials, LoginResult, AdminSession, AuditLog, AdminPermission } from '@/types/auth';
import { JWTService, JWTAuthenticationError } from './jwt-service';
import { RateLimiter } from './rate-limiter';
import { AuditLogger } from './audit-logger';
import { SecurityMonitor } from './security-monitor';

export class AdminAuthenticationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 401, details?: any) {
    super(message);
    this.name = 'AdminAuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class AdminAuthService {
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  private securityMonitor: SecurityMonitor;
  private activeSessions: Map<string, AdminSession> = new Map();

  constructor() {
    this.rateLimiter = new RateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      skipSuccessfulRequests: true
    });
    
    this.auditLogger = new AuditLogger();
    this.securityMonitor = new SecurityMonitor(this.auditLogger, this.rateLimiter);
    this.startSessionCleanup();
  }

  /**
   * Authenticate admin user with credentials
   */
  async login(
    credentials: LoginCredentials,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResult> {
    const startTime = Date.now();
    
    try {
      // Check if IP is blocked by security monitor
      if (this.securityMonitor.isIPBlocked(ipAddress)) {
        await this.auditLogger.log({
          adminId: 'unknown',
          adminEmail: credentials.email,
          action: 'LOGIN_ATTEMPT',
          resource: 'admin_auth',
          details: { reason: 'ip_blocked' },
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false,
          error: 'IP address blocked'
        });

        throw new AdminAuthenticationError(
          'Access denied. Your IP address has been blocked due to suspicious activity.',
          'IP_BLOCKED',
          403
        );
      }

      // Check rate limiting
      const rateLimitKey = `login:${credentials.email}:${ipAddress}`;
      if (!this.rateLimiter.isAllowed(rateLimitKey)) {
        // Record failed attempt for security monitoring
        this.securityMonitor.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          { reason: 'rate_limited' }
        );

        await this.auditLogger.log({
          adminId: 'unknown',
          adminEmail: credentials.email,
          action: 'LOGIN_ATTEMPT',
          resource: 'admin_auth',
          details: { reason: 'rate_limited' },
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false,
          error: 'Rate limit exceeded'
        });

        throw new AdminAuthenticationError(
          'Too many login attempts. Please try again later.',
          'RATE_LIMITED',
          429
        );
      }

      // Find admin user (this would typically query a database)
      const admin = await this.findAdminByEmail(credentials.email);
      if (!admin) {
        // Record failed attempt for security monitoring
        this.securityMonitor.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          { reason: 'user_not_found' }
        );

        await this.auditLogger.log({
          adminId: 'unknown',
          adminEmail: credentials.email,
          action: 'LOGIN_ATTEMPT',
          resource: 'admin_auth',
          details: { reason: 'user_not_found' },
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false,
          error: 'Invalid credentials'
        });

        throw new AdminAuthenticationError(
          'Invalid email or password',
          'INVALID_CREDENTIALS',
          401
        );
      }

      // Check if account is locked
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        // Record failed attempt for security monitoring
        this.securityMonitor.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          { reason: 'account_locked', lockedUntil: admin.lockedUntil }
        );

        await this.auditLogger.log({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'LOGIN_ATTEMPT',
          resource: 'admin_auth',
          details: { reason: 'account_locked', lockedUntil: admin.lockedUntil },
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false,
          error: 'Account locked'
        });

        throw new AdminAuthenticationError(
          'Account is temporarily locked due to multiple failed login attempts',
          'ACCOUNT_LOCKED',
          423,
          { lockedUntil: admin.lockedUntil }
        );
      }

      // Check if account is active
      if (!admin.isActive) {
        // Record failed attempt for security monitoring
        this.securityMonitor.recordLoginAttempt(
          credentials.email,
          ipAddress,
          userAgent,
          false,
          { reason: 'account_inactive' }
        );

        await this.auditLogger.log({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'LOGIN_ATTEMPT',
          resource: 'admin_auth',
          details: { reason: 'account_inactive' },
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false,
          error: 'Account inactive'
        });

        throw new AdminAuthenticationError(
          'Account is inactive. Please contact system administrator.',
          'ACCOUNT_INACTIVE',
          403
        );
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, admin.passwordHash);
      if (!isPasswordValid) {
        // Increment failed login attempts
        await this.handleFailedLogin(admin, ipAddress, userAgent);
        
        throw new AdminAuthenticationError(
          'Invalid email or password',
          'INVALID_CREDENTIALS',
          401
        );
      }

      // Check MFA if enabled
      if (admin.mfaEnabled) {
        if (!credentials.mfaToken) {
          // Record partial success for security monitoring
          this.securityMonitor.recordLoginAttempt(
            credentials.email,
            ipAddress,
            userAgent,
            false,
            { reason: 'mfa_required', stage: 'password_verified' }
          );

          return {
            success: false,
            requiresMfa: true,
            error: 'MFA token required'
          };
        }

        const isMfaValid = await this.verifyMfaToken(admin, credentials.mfaToken);
        if (!isMfaValid) {
          // Record failed attempt for security monitoring
          this.securityMonitor.recordLoginAttempt(
            credentials.email,
            ipAddress,
            userAgent,
            false,
            { reason: 'invalid_mfa' }
          );

          await this.auditLogger.log({
            adminId: admin.id,
            adminEmail: admin.email,
            action: 'LOGIN_ATTEMPT',
            resource: 'admin_auth',
            details: { reason: 'invalid_mfa' },
            ipAddress,
            userAgent,
            timestamp: new Date(),
            success: false,
            error: 'Invalid MFA token'
          });

          throw new AdminAuthenticationError(
            'Invalid MFA token',
            'INVALID_MFA',
            401
          );
        }
      }

      // Reset failed login attempts on successful login
      await this.resetFailedLoginAttempts(admin.id);

      // Generate session and tokens
      const sessionId = JWTService.generateSessionId();
      const accessToken = JWTService.generateAccessToken(admin, sessionId);
      const refreshToken = JWTService.generateRefreshToken(admin.id, sessionId);

      // Create and store session
      const session: AdminSession = {
        adminId: admin.id,
        email: admin.email,
        roles: admin.roles,
        permissions: admin.permissions,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        createdAt: new Date(),
        ipAddress,
        userAgent,
        sessionId
      };

      this.activeSessions.set(sessionId, session);

      // Update last login
      await this.updateLastLogin(admin.id);

      // Record successful login for security monitoring
      this.securityMonitor.recordLoginAttempt(
        credentials.email,
        ipAddress,
        userAgent,
        true,
        { 
          sessionId,
          loginDuration: Date.now() - startTime,
          mfaUsed: admin.mfaEnabled
        }
      );

      // Log successful login
      await this.auditLogger.log({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'LOGIN_SUCCESS',
        resource: 'admin_auth',
        details: { 
          sessionId,
          loginDuration: Date.now() - startTime,
          mfaUsed: admin.mfaEnabled
        },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: true
      });

      return {
        success: true,
        token: accessToken,
        refreshToken,
        admin: this.sanitizeAdmin(admin)
      };

    } catch (error) {
      if (error instanceof AdminAuthenticationError) {
        throw error;
      }

      await this.auditLogger.log({
        adminId: 'unknown',
        adminEmail: credentials.email,
        action: 'LOGIN_ERROR',
        resource: 'admin_auth',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AdminAuthenticationError(
        'Login failed due to internal error',
        'INTERNAL_ERROR',
        500
      );
    }
  }

  /**
   * Logout admin user
   */
  async logout(sessionId: string, ipAddress: string, userAgent: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      this.activeSessions.delete(sessionId);
      
      await this.auditLogger.log({
        adminId: session.adminId,
        adminEmail: session.email,
        action: 'LOGOUT',
        resource: 'admin_auth',
        details: { sessionId },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: true
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = JWTService.verifyRefreshToken(refreshToken);
      const session = this.activeSessions.get(payload.sessionId);

      if (!session) {
        throw new AdminAuthenticationError(
          'Session not found or expired',
          'SESSION_NOT_FOUND',
          401
        );
      }

      // Verify session is still valid
      if (session.expiresAt < new Date()) {
        this.activeSessions.delete(payload.sessionId);
        throw new AdminAuthenticationError(
          'Session expired',
          'SESSION_EXPIRED',
          401
        );
      }

      // Get fresh admin data
      const admin = await this.findAdminById(payload.adminId);
      if (!admin || !admin.isActive) {
        this.activeSessions.delete(payload.sessionId);
        throw new AdminAuthenticationError(
          'Admin account not found or inactive',
          'ADMIN_NOT_FOUND',
          401
        );
      }

      // Generate new tokens
      const newSessionId = JWTService.generateSessionId();
      const newAccessToken = JWTService.generateAccessToken(admin, newSessionId);
      const newRefreshToken = JWTService.generateRefreshToken(admin.id, newSessionId);

      // Update session
      session.sessionId = newSessionId;
      session.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      this.activeSessions.delete(payload.sessionId);
      this.activeSessions.set(newSessionId, session);

      await this.auditLogger.log({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'TOKEN_REFRESH',
        resource: 'admin_auth',
        details: { oldSessionId: payload.sessionId, newSessionId },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: true
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };

    } catch (error) {
      if (error instanceof JWTAuthenticationError || error instanceof AdminAuthenticationError) {
        throw error;
      }

      throw new AdminAuthenticationError(
        'Token refresh failed',
        'REFRESH_FAILED',
        500
      );
    }
  }

  /**
   * Validate session and get admin info
   */
  async validateSession(sessionId: string): Promise<AdminSession | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Check if admin has specific permission
   */
  hasPermission(session: AdminSession, permission: AdminPermission): boolean {
    return session.permissions.includes(permission);
  }

  /**
   * Get all active sessions for monitoring
   */
  getActiveSessions(): AdminSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Revoke all sessions for a specific admin
   */
  async revokeAllSessions(adminId: string, ipAddress: string, userAgent: string): Promise<void> {
    const sessionsToRevoke = Array.from(this.activeSessions.entries())
      .filter(([_, session]) => session.adminId === adminId);

    for (const [sessionId, session] of sessionsToRevoke) {
      this.activeSessions.delete(sessionId);
    }

    if (sessionsToRevoke.length > 0) {
      await this.auditLogger.log({
        adminId,
        adminEmail: sessionsToRevoke[0][1].email,
        action: 'REVOKE_ALL_SESSIONS',
        resource: 'admin_auth',
        details: { revokedSessions: sessionsToRevoke.length },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: true
      });
    }
  }

  /**
   * Get security monitor instance for advanced security features
   */
  getSecurityMonitor(): SecurityMonitor {
    return this.securityMonitor;
  }

  /**
   * Get security metrics and monitoring data
   */
  getSecurityMetrics(timeRange?: { startDate: Date; endDate: Date }) {
    return this.securityMonitor.getSecurityMetrics(timeRange);
  }

  /**
   * Get active security alerts
   */
  getActiveSecurityAlerts() {
    return this.securityMonitor.getActiveAlerts();
  }

  /**
   * Block an IP address manually
   */
  async blockIP(ipAddress: string, reason: string, adminId: string, adminEmail: string): Promise<void> {
    this.securityMonitor.blockIP(ipAddress, reason);
    
    await this.auditLogger.log({
      adminId,
      adminEmail,
      action: 'MANUAL_IP_BLOCK',
      resource: 'admin_auth',
      details: { ipAddress, reason },
      ipAddress: 'admin-action',
      userAgent: 'admin-action',
      timestamp: new Date(),
      success: true
    });
  }

  /**
   * Unblock an IP address manually
   */
  async unblockIP(ipAddress: string, adminId: string, adminEmail: string): Promise<void> {
    this.securityMonitor.unblockIP(ipAddress, adminId, adminEmail);
  }

  /**
   * Get list of blocked IPs
   */
  getBlockedIPs(): string[] {
    return this.securityMonitor.getBlockedIPs();
  }

  // Private helper methods

  private async findAdminByEmail(email: string): Promise<AdminUser | null> {
    // This would typically query your database
    // For now, return a mock admin for testing
    if (email === 'admin@rwa-lending.com') {
      return {
        id: 'admin-1',
        email: 'admin@rwa-lending.com',
        passwordHash: await bcrypt.hash('admin123', 12), // In real app, this would be pre-hashed
        roles: [{
          name: 'super_admin',
          permissions: Object.values(AdminPermission),
          description: 'Super Administrator'
        }],
        permissions: Object.values(AdminPermission),
        lastLogin: new Date(),
        mfaEnabled: false,
        isActive: true,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    return null;
  }

  private async findAdminById(id: string): Promise<AdminUser | null> {
    // This would typically query your database
    if (id === 'admin-1') {
      return await this.findAdminByEmail('admin@rwa-lending.com');
    }
    return null;
  }

  private async handleFailedLogin(admin: AdminUser, ipAddress: string, userAgent: string): Promise<void> {
    const newFailedAttempts = admin.failedLoginAttempts + 1;
    
    if (newFailedAttempts >= AdminAuthService.MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + AdminAuthService.LOCKOUT_DURATION);
      
      await this.auditLogger.log({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ACCOUNT_LOCKED',
        resource: 'admin_auth',
        details: { 
          failedAttempts: newFailedAttempts,
          lockedUntil,
          lockoutDuration: AdminAuthService.LOCKOUT_DURATION
        },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: false,
        error: 'Account locked due to failed login attempts'
      });
    } else {
      await this.auditLogger.log({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'FAILED_LOGIN',
        resource: 'admin_auth',
        details: { 
          failedAttempts: newFailedAttempts,
          remainingAttempts: AdminAuthService.MAX_LOGIN_ATTEMPTS - newFailedAttempts
        },
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: false,
        error: 'Invalid credentials'
      });
    }

    // In a real app, this would update the database
    admin.failedLoginAttempts = newFailedAttempts;
    if (newFailedAttempts >= AdminAuthService.MAX_LOGIN_ATTEMPTS) {
      admin.lockedUntil = new Date(Date.now() + AdminAuthService.LOCKOUT_DURATION);
    }
  }

  private async resetFailedLoginAttempts(adminId: string): Promise<void> {
    // In a real app, this would update the database
    // For now, we'll just log it in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Reset failed login attempts for admin: ${adminId}`);
    }
  }

  private async updateLastLogin(adminId: string): Promise<void> {
    // In a real app, this would update the database
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Updated last login for admin: ${adminId}`);
    }
  }

  private async verifyMfaToken(admin: AdminUser, token: string): Promise<boolean> {
    // This would implement TOTP verification using the admin's MFA secret
    // For now, we'll accept any 6-digit token for testing
    return /^\d{6}$/.test(token);
  }

  private sanitizeAdmin(admin: AdminUser): Omit<AdminUser, 'passwordHash' | 'mfaSecret'> {
    const { passwordHash, mfaSecret, ...sanitized } = admin;
    return sanitized;
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions = Array.from(this.activeSessions.entries())
        .filter(([_, session]) => session.expiresAt < now);

      for (const [sessionId] of expiredSessions) {
        this.activeSessions.delete(sessionId);
      }

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, AdminAuthService.SESSION_CLEANUP_INTERVAL);
  }
}