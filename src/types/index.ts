export interface BlitzWareUser {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  picture?: string;
  roles?: string[] | Role[];
  [key: string]: any;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface BlitzWareConfig {
  clientId: string;
  redirectUri: string;
  responseType?: "code" | "token";
}

export interface TokenIntrospectionResponse {
  active: boolean;
  client_id?: string;
  username?: string;
  scope?: string;
  sub?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  token_type?: string;
  [key: string]: any;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: BlitzWareUser | null;
  error: Error | null;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
  // idToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scope?: string;
}

export interface AuthorizeResult {
  accessToken: string;
  refreshToken?: string;
  // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
  // idToken?: string;
  tokenType?: string;
  accessTokenExpirationDate?: string;
  scope?: string;
  state?: string;
  additionalParameters?: Record<string, any>;
}

export interface BlitzWareAuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  hasRole: (role: string) => boolean;
  refresh: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

import { ReactNode } from "react";

export interface BlitzWareProviderProps {
  children: ReactNode;
  config: BlitzWareConfig;
}

export class BlitzWareError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "BlitzWareError";
  }
}

export enum AuthErrorCode {
  CONFIGURATION_ERROR = "configuration_error",
  NETWORK_ERROR = "network_error",
  AUTHENTICATION_FAILED = "authentication_failed",
  TOKEN_EXPIRED = "token_expired",
  REFRESH_FAILED = "refresh_failed",
  LOGOUT_FAILED = "logout_failed",
  USER_INFO_FAILED = "user_info_failed",
  STORAGE_ERROR = "storage_error",
  INTROSPECTION_FAILED = "introspection_failed",
  UNKNOWN_ERROR = "unknown_error",
}
