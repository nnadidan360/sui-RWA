export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  VERIFIER = 'verifier',
  MODERATOR = 'moderator',
  USER = 'user',
  READONLY = 'readonly',
  LENDING_PROTOCOL = 'lending_protocol',
}

export interface User {
  id: string;
  address: string;
  email?: string;
  role: UserRole;
  permissions?: Permission[];
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface AuthSession {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  expiresAt: Date;
  createdAt: Date;
}

export interface AccessControlConfig {
  roles: Record<UserRole, Permission[]>;
  resources: string[];
  actions: string[];
}

// Administrative Authentication Types
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  lastLogin: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRole {
  name: string;
  permissions: AdminPermission[];
  description: string;
}

export enum AdminPermission {
  MANAGE_ASSETS = 'manage_assets',
  MANAGE_LOANS = 'manage_loans',
  MANAGE_USERS = 'manage_users',
  VIEW_ANALYTICS = 'view_analytics',
  SYSTEM_SETTINGS = 'system_settings',
  MANAGE_ADMINS = 'manage_admins',
  AUDIT_LOGS = 'audit_logs',
  EMERGENCY_CONTROLS = 'emergency_controls'
}

export interface AdminSession {
  adminId: string;
  email: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  admin?: Omit<AdminUser, 'passwordHash' | 'mfaSecret'>;
  requiresMfa?: boolean;
  error?: string;
}

export interface JWTPayload {
  adminId: string;
  email: string;
  roles: string[];
  permissions: AdminPermission[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  adminId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}