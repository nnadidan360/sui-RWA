// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Authentication Types
export interface LoginRequest {
  address: string;
  signature: string;
  message: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: import('./entities').User;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Common Request Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Import User type from entities
export type { User } from './entities';