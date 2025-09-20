/**
 * BlitzWare React Native SDK - OAuth 2.0 Client
 * 
 * This SDK integrates with BlitzWare's OAuth 2.0 authorization ser            body: JSON.stringify({
              client_id: this.config.clientId
            }),.
 * Uses expo-auth-session for cross-platform compatibility (iOS, Android, Web)
 */
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
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

const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'blitzware_access_token',
  REFRESH_TOKEN: 'blitzware_refresh_token'
} as const;

export class BlitzWareAuthClient {
  private config: BlitzWareConfig;
  private discovery: AuthSession.DiscoveryDocument | null = null;

  constructor(config: BlitzWareConfig) {
    this.config = config;
  }

  /**
   * Initialize the discovery document
   */
  private async getDiscovery(): Promise<AuthSession.DiscoveryDocument> {
    if (!this.discovery) {
      try {
        // Try to fetch discovery document
        this.discovery = await AuthSession.fetchDiscoveryAsync('https://auth.blitzware.xyz/api/auth');
      } catch (error) {
        // Fallback to manual configuration if discovery fails
        this.discovery = {
          authorizationEndpoint: 'https://auth.blitzware.xyz/api/auth/authorize',
          tokenEndpoint: 'https://auth.blitzware.xyz/api/auth/token',
          revocationEndpoint: 'https://auth.blitzware.xyz/api/auth/revoke',
        };
      }
    }
    return this.discovery;
  }

  /**
   * Authenticate user with authorization code flow
   */
  async login(): Promise<BlitzWareUser> {
    try {
      const discovery = await this.getDiscovery();
      
      // Create authorization request
      const request = new AuthSession.AuthRequest({
        clientId: this.config.clientId,
        scopes: [],
        redirectUri: this.config.redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });

      // Prompt for authorization
      const result = await request.promptAsync(discovery);

      if (result.type !== 'success') {
        throw new Error('Authorization was cancelled or failed');
      }

      // Exchange code for tokens
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: this.config.clientId,
          code: result.params.code,
          redirectUri: this.config.redirectUri,
          extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : {},
        },
        discovery
      );

      // Store tokens securely
      await this.storeTokens({
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || undefined,
        expiresAt: tokenResult.expiresIn 
          ? Date.now() + (tokenResult.expiresIn * 1000)
          : undefined
      });

      // Get user information
      const user = await this.fetchUserInfo(tokenResult.accessToken);
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
              client_id: this.config.clientId
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

      const discovery = await this.getDiscovery();

      // Use expo-auth-session for token refresh
      const tokenResult = await AuthSession.refreshAsync(
        {
          clientId: this.config.clientId,
          refreshToken,
        },
        discovery
      );

      // Store new tokens
      await this.storeTokens({
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || refreshToken,
        expiresAt: tokenResult.expiresIn 
          ? Date.now() + (tokenResult.expiresIn * 1000)
          : undefined
      });

      return tokenResult.accessToken;
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
      // Store sensitive tokens in SecureStore
      if (tokens.accessToken) {
        await SecureStore.setItemAsync(
          SECURE_STORE_KEYS.ACCESS_TOKEN,
          tokens.accessToken
        );
      }

      if (tokens.refreshToken) {
        await SecureStore.setItemAsync(
          SECURE_STORE_KEYS.REFRESH_TOKEN,
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
      throw this.handleError(error, AuthErrorCode.STORAGE_ERROR);
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
      return await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get stored refresh token
   */
  private async getStoredRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all stored authentication data
   */
  private async clearStorage(): Promise<void> {
    try {
      // Clear SecureStore
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);

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