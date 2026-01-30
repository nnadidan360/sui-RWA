/**
 * Session Management for Wallet Authentication
 * 
 * Handles user sessions, authentication tokens, and secure storage
 */

export interface UserSession {
  publicKey: string;
  accountHash: string;
  walletName: string;
  network: string;
  connectedAt: number;
  expiresAt: number;
  signature?: string; // Optional signature for enhanced security
}

export interface AuthToken {
  token: string;
  expiresAt: number;
  publicKey: string;
}

export class SessionManager {
  private static readonly SESSION_KEY = 'rwa-lending-session';
  private static readonly TOKEN_KEY = 'rwa-lending-auth-token';
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly TOKEN_DURATION = 60 * 60 * 1000; // 1 hour

  private currentSession: UserSession | null = null;
  private authToken: AuthToken | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.loadSession();
    this.loadAuthToken();
    this.startSessionMonitoring();
  }

  /**
   * Create a new session for the connected wallet
   */
  async createSession(
    publicKey: string,
    accountHash: string,
    walletName: string,
    network: string,
    signature?: string
  ): Promise<UserSession> {
    const now = Date.now();
    const session: UserSession = {
      publicKey,
      accountHash,
      walletName,
      network,
      connectedAt: now,
      expiresAt: now + SessionManager.SESSION_DURATION,
      signature,
    };

    this.currentSession = session;
    this.saveSession();
    
    // Generate auth token
    await this.generateAuthToken(publicKey);
    
    this.emit('sessionCreated', session);
    return session;
  }

  /**
   * Get current active session
   */
  getCurrentSession(): UserSession | null {
    if (!this.currentSession) return null;
    
    // Check if session is expired
    if (Date.now() > this.currentSession.expiresAt) {
      this.clearSession();
      return null;
    }
    
    return this.currentSession;
  }

  /**
   * Extend current session
   */
  extendSession(): boolean {
    if (!this.currentSession) return false;
    
    const now = Date.now();
    this.currentSession.expiresAt = now + SessionManager.SESSION_DURATION;
    this.saveSession();
    
    this.emit('sessionExtended', this.currentSession);
    return true;
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    const wasActive = !!this.currentSession;
    
    this.currentSession = null;
    this.authToken = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SessionManager.SESSION_KEY);
      localStorage.removeItem(SessionManager.TOKEN_KEY);
    }
    
    if (wasActive) {
      this.emit('sessionCleared');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const session = this.getCurrentSession();
    const token = this.getValidAuthToken();
    return !!(session && token);
  }

  /**
   * Get current auth token if valid
   */
  getAuthToken(): string | null {
    const token = this.getValidAuthToken();
    return token ? token.token : null;
  }

  /**
   * Generate a new authentication token
   */
  private async generateAuthToken(publicKey: string): Promise<AuthToken> {
    const now = Date.now();
    const tokenData = {
      publicKey,
      timestamp: now,
      random: Math.random().toString(36).substring(2),
    };
    
    // In a real implementation, this would be signed by the server
    // For now, we'll create a simple token
    const token = btoa(JSON.stringify(tokenData));
    
    const authToken: AuthToken = {
      token,
      expiresAt: now + SessionManager.TOKEN_DURATION,
      publicKey,
    };
    
    this.authToken = authToken;
    this.saveAuthToken();
    
    return authToken;
  }

  /**
   * Refresh auth token if needed
   */
  async refreshAuthToken(): Promise<boolean> {
    if (!this.currentSession) return false;
    
    const token = this.getValidAuthToken();
    if (token && token.expiresAt - Date.now() > 5 * 60 * 1000) {
      // Token is still valid for more than 5 minutes
      return true;
    }
    
    try {
      await this.generateAuthToken(this.currentSession.publicKey);
      this.emit('tokenRefreshed', this.authToken);
      return true;
    } catch (error) {
      console.error('Failed to refresh auth token:', error);
      return false;
    }
  }

  /**
   * Validate session with signature (optional enhanced security)
   */
  async validateSessionSignature(message: string, signature: string): Promise<boolean> {
    if (!this.currentSession) return false;
    
    try {
      // In a real implementation, this would verify the signature
      // against the public key using Casper SDK
      // For now, we'll simulate validation
      return signature.length > 0;
    } catch (error) {
      console.error('Signature validation failed:', error);
      return false;
    }
  }

  /**
   * Get session info for API requests
   */
  getSessionHeaders(): Record<string, string> {
    const token = this.getAuthToken();
    const session = this.getCurrentSession();
    
    if (!token || !session) return {};
    
    return {
      'Authorization': `Bearer ${token}`,
      'X-Wallet-Address': session.publicKey,
      'X-Wallet-Network': session.network,
    };
  }

  /**
   * Load session from storage
   */
  private loadSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessionData = localStorage.getItem(SessionManager.SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData) as UserSession;
        
        // Check if session is still valid
        if (Date.now() < session.expiresAt) {
          this.currentSession = session;
        } else {
          localStorage.removeItem(SessionManager.SESSION_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      localStorage.removeItem(SessionManager.SESSION_KEY);
    }
  }

  /**
   * Save session to storage
   */
  private saveSession(): void {
    if (typeof window === 'undefined' || !this.currentSession) return;
    
    try {
      localStorage.setItem(
        SessionManager.SESSION_KEY,
        JSON.stringify(this.currentSession)
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Load auth token from storage
   */
  private loadAuthToken(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const tokenData = localStorage.getItem(SessionManager.TOKEN_KEY);
      if (tokenData) {
        const token = JSON.parse(tokenData) as AuthToken;
        
        // Check if token is still valid
        if (Date.now() < token.expiresAt) {
          this.authToken = token;
        } else {
          localStorage.removeItem(SessionManager.TOKEN_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load auth token:', error);
      localStorage.removeItem(SessionManager.TOKEN_KEY);
    }
  }

  /**
   * Save auth token to storage
   */
  private saveAuthToken(): void {
    if (typeof window === 'undefined' || !this.authToken) return;
    
    try {
      localStorage.setItem(
        SessionManager.TOKEN_KEY,
        JSON.stringify(this.authToken)
      );
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  }

  /**
   * Get valid auth token
   */
  private getValidAuthToken(): AuthToken | null {
    if (!this.authToken) return null;
    
    if (Date.now() > this.authToken.expiresAt) {
      this.authToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SessionManager.TOKEN_KEY);
      }
      return null;
    }
    
    return this.authToken;
  }

  /**
   * Start session monitoring
   */
  private startSessionMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // Check session validity every minute
    setInterval(() => {
      const session = this.getCurrentSession();
      if (!session && this.currentSession) {
        // Session expired
        this.clearSession();
      }
      
      // Auto-refresh token if needed
      if (session) {
        this.refreshAuthToken();
      }
    }, 60 * 1000);
    
    // Listen for storage changes (multi-tab support)
    window.addEventListener('storage', (event) => {
      if (event.key === SessionManager.SESSION_KEY) {
        if (event.newValue) {
          try {
            this.currentSession = JSON.parse(event.newValue);
            this.emit('sessionChanged', this.currentSession);
          } catch (error) {
            console.error('Failed to parse session from storage:', error);
          }
        } else {
          this.currentSession = null;
          this.emit('sessionCleared');
        }
      }
    });
  }

  /**
   * Event handling
   */
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();