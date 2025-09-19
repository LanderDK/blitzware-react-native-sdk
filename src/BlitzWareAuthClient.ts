/**
 * BlitzWare React Native SDK - OAuth 2.0 Client
 * 
 * This SDK integrates with BlitzWare's OAuth 2.0 authorization server.
 * It automatically discovers endpoint configuration from:
 * https://auth.blitzware.xyz/api/auth/.well-known/openid_configuration
 * 
 * Note: Despite the filename containing "openid_configuration", this is 
 * a standard OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).
 * BlitzWare implements OAuth 2.0, not OpenID Connect.
 */
import { authorize, AuthConfiguration } from 'react-native-app-auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  BlitzWareConfig,
  BlitzWareUser,
  TokenSet,
  AuthorizeResult,
  BlitzWareError,
  AuthErrorCode
} from './types';

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@blitzware/access_token',
  REFRESH_TOKEN: '@blitzware/refresh_token',
  // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
  // ID_TOKEN: '@blitzware/id_token',
  USER: '@blitzware/user',
  TOKEN_EXPIRY: '@blitzware/token_expiry'
} as const;

const KEYCHAIN_SERVICE = 'BlitzWareAuth';

export class BlitzWareAuthClient {
  private authConfig: AuthConfiguration;

  constructor(config: BlitzWareConfig) {
    
    // Default to "code" for mobile security, but allow "token" if explicitly requested
    const responseType = config.responseType || "code";
    
    this.authConfig = {
      issuer: 'https://auth.blitzware.xyz/api/auth',
      clientId: config.clientId,
      redirectUrl: config.redirectUri,
      scopes: [], // Empty scopes - your OAuth 2.0 service doesn't require specific scopes
      additionalParameters: {},
      useNonce: false, // Not needed for OAuth 2.0 (OpenID Connect feature)
      usePKCE: responseType === "code", // Use PKCE only for authorization code flow
      skipCodeExchange: responseType === "token", // Skip code exchange for implicit flow
      additionalHeaders: {},
      dangerouslyAllowInsecureHttpRequests: false
    };
  }

  /**
   * Authenticate user with authorization code flow
   */
  async login(): Promise<BlitzWareUser> {
    try {
      const result: AuthorizeResult = await authorize(this.authConfig);
      
      // Store tokens securely
      await this.storeTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
        expiresAt: result.accessTokenExpirationDate 
          ? new Date(result.accessTokenExpirationDate).getTime()
          : undefined
      });

      // Get user information
      const user = await this.fetchUserInfo(result.accessToken);
      await this.storeUser(user);

      return user;
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Log out the user and clear stored tokens
   */
  async logout(): Promise<void> {
    try {
      const accessToken = await this.getStoredAccessToken();
      
      if (accessToken) {
        // Call logout endpoint directly like React SDK
        try {
          const response = await fetch('https://auth.blitzware.xyz/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: this.authConfig.clientId
            })
          });
          
          if (!response.ok) {
            console.warn('Logout request failed:', response.status);
          }
        } catch (logoutError) {
          // Continue with local logout even if logout request fails
          console.warn('Logout request failed:', logoutError);
        }
      }

      // Clear all stored data
      await this.clearStorage();
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.LOGOUT_FAILED);
    }
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const accessToken = await this.getStoredAccessToken();
      const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

      if (!accessToken) {
        return null;
      }

      // Check if token is expired
      if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
        return await this.refreshAccessToken();
      }

      return accessToken;
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.TOKEN_EXPIRED);
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const refreshToken = await this.getStoredRefreshToken();
      
      if (!refreshToken) {
        throw new BlitzWareError('No refresh token available', AuthErrorCode.REFRESH_FAILED);
      }

      // Manual refresh token request like other SDKs
      const response = await fetch('https://auth.blitzware.xyz/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.authConfig.clientId
        }).toString()
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const result = await response.json();

      // Store new tokens
      await this.storeTokens({
        accessToken: result.access_token,
        refreshToken: result.refresh_token || refreshToken,
        // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
        expiresAt: result.expires_in 
          ? Date.now() + (result.expires_in * 1000)
          : undefined
      });

      return result.access_token;
    } catch (error) {
      // If refresh fails, clear stored tokens
      await this.clearStorage();
      throw this.handleError(error, AuthErrorCode.REFRESH_FAILED);
    }
  }

  /**
   * Get current authenticated user
   */
  async getUser(): Promise<BlitzWareUser | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.warn('Failed to get user from storage:', error);
      return null;
    }
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(roleName: string): Promise<boolean> {
    try {
      const user = await this.getUser();
      if (!user || !user.roles) {
        return false;
      }

      return user.roles.some(role => 
        typeof role === 'string' 
          ? role.toLowerCase() === roleName.toLowerCase()
          : role.name?.toLowerCase() === roleName.toLowerCase()
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch user information from the API
   */
  private async fetchUserInfo(accessToken: string): Promise<BlitzWareUser> {
    try {
      const response = await fetch('https://auth.blitzware.xyz/api/auth/userinfo', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.NETWORK_ERROR);
    }
  }

  /**
   * Store tokens securely
   */
  private async storeTokens(tokens: TokenSet): Promise<void> {
    try {
      // Store sensitive tokens in Keychain
      if (tokens.accessToken) {
        await Keychain.setInternetCredentials(
          `${KEYCHAIN_SERVICE}_access`,
          'access_token',
          tokens.accessToken
        );
      }

      if (tokens.refreshToken) {
        await Keychain.setInternetCredentials(
          `${KEYCHAIN_SERVICE}_refresh`,
          'refresh_token',
          tokens.refreshToken
        );
      }

      // Store less sensitive data in AsyncStorage
      // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
      // if (tokens.idToken) {
      //   await AsyncStorage.setItem(STORAGE_KEYS.ID_TOKEN, tokens.idToken);
      // }

      if (tokens.expiresAt) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, tokens.expiresAt.toString());
      }
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.KEYCHAIN_ERROR);
    }
  }

  /**
   * Store user information
   */
  private async storeUser(user: BlitzWareUser): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to store user:', error);
    }
  }

  /**
   * Get stored access token
   */
  private async getStoredAccessToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(`${KEYCHAIN_SERVICE}_access`);
      return credentials ? credentials.password : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get stored refresh token
   */
  private async getStoredRefreshToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(`${KEYCHAIN_SERVICE}_refresh`);
      return credentials ? credentials.password : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all stored authentication data
   */
  private async clearStorage(): Promise<void> {
    try {
      // Clear Keychain
      await Keychain.resetInternetCredentials(`${KEYCHAIN_SERVICE}_access`);
      await Keychain.resetInternetCredentials(`${KEYCHAIN_SERVICE}_refresh`);

      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
        // STORAGE_KEYS.ID_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.TOKEN_EXPIRY
      ]);
    } catch (error) {
      console.warn('Failed to clear storage:', error);
    }
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: any, code: AuthErrorCode): BlitzWareError {
    if (error instanceof BlitzWareError) {
      return error;
    }

    const message = error?.message || error?.toString() || 'Unknown error occurred';
    return new BlitzWareError(message, code);
  }
}