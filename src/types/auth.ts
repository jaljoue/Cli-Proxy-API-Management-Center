/**
 * Authentication-related type definitions
 * Based on the original project's src/modules/login.js and src/core/connection.js
 */

// Login credentials
export interface LoginCredentials {
  apiBase: string;
  managementKey: string;
  rememberPassword?: boolean;
}

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  apiBase: string;
  managementKey: string;
  rememberPassword: boolean;
  serverVersion: string | null;
  serverBuildDate: string | null;
  supportsPlugin: boolean;
}

// Connection status
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
