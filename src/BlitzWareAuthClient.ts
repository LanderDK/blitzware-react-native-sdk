/**
 * BlitzWare React Native SDK - OAuth 2.0 Client
 * 
 * This SDK integrates with BlitzWare's OAuth 2.0 authorization ser            body: JSON.stringify({
              client_id: this.config.clientId
            }),.
 * Uses expo-auth-session for cross-platform compatibility (iOS, Android, Web)
 */
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  BlitzWareConfig,
  BlitzWareUser,
  TokenSet,
  BlitzWareError,
  AuthErrorCode,
  TokenIntrospectionResponse,
} from "./types";
import axios from "axios";
import { Buffer } from "buffer";

const BASE_URL = "https://auth.blitzware.xyz/api/auth";

// Configure axios instance with credentials for session support
const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Include session cookies in all requests - DOES NOT WORK
  headers: {
    "Content-Type": "application/json",
  },
});

const STORAGE_KEYS = {
  ACCESS_TOKEN: "@blitzware/access_token",
  REFRESH_TOKEN: "@blitzware/refresh_token",
  // Note: ID tokens not supported by BlitzWare OAuth 2.0 service
  // ID_TOKEN: '@blitzware/id_token',
  USER: "@blitzware/user",
  TOKEN_EXPIRY: "@blitzware/token_expiry",
} as const;

const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: "blitzware_access_token",
  REFRESH_TOKEN: "blitzware_refresh_token",
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
        this.discovery = await AuthSession.fetchDiscoveryAsync(BASE_URL);
      } catch (error) {
        // Fallback to manual configuration if discovery fails
        this.discovery = {
          authorizationEndpoint: `${BASE_URL}/authorize`,
          tokenEndpoint: `${BASE_URL}/token`,
          revocationEndpoint: `${BASE_URL}/revoke`,
          userInfoEndpoint: `${BASE_URL}/userinfo`,
          endSessionEndpoint: `${BASE_URL}/logout`,
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

      if (result.type !== "success") {
        throw new Error("Authorization was cancelled or failed");
      }

      // Exchange code for tokens
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: this.config.clientId,
          code: result.params.code,
          redirectUri: this.config.redirectUri,
          extraParams: request.codeVerifier
            ? { code_verifier: request.codeVerifier }
            : {},
        },
        discovery
      );

      // Store tokens securely
      await this.storeTokens({
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || undefined,
        expiresAt: tokenResult.expiresIn
          ? Date.now() + tokenResult.expiresIn * 1000
          : undefined,
      });

      // Get user information
      const user = await this.fetchUserInfo();
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
      const accessToken = await this.getStoredToken("access_token");

      if (accessToken) {
        try {
          const response = await apiClient.post("/logout", {
            client_id: this.config.clientId,
          });

          if (response.status < 200 || response.status >= 300) {
            console.warn("Logout request failed:", response.status);
          }
        } catch (logoutError) {
          // Continue with local logout even if logout request fails
          console.warn("Logout request failed:", logoutError);
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
   * This method ensures you always get a valid token if possible
   */
  async getAccessToken(): Promise<string | null> {
    try {
      // First check if we have a token locally that appears valid
      const isLocallyValid = await this.isTokenValidLocally();

      if (!isLocallyValid) {
        // Token is expired or missing locally, try to refresh
        try {
          return await this.refreshAccessToken();
        } catch (refreshError) {
          // Refresh failed, return null
          return null;
        }
      }

      // Now validate with server to be sure
      const isServerValid = await this.isAuthenticated();

      if (!isServerValid) {
        // Server says token is invalid, try to refresh
        try {
          return await this.refreshAccessToken();
        } catch (refreshError) {
          // Refresh failed, return null
          return null;
        }
      }

      // Return the token
      return await this.getStoredToken("access_token");
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.TOKEN_EXPIRED);
    }
  }

  /**
   * Get current access token without validation (faster, but may be expired)
   * Use this for non-critical operations or when you handle validation separately
   */
  async getAccessTokenFast(): Promise<string | null> {
    try {
      const accessToken = await this.getStoredToken("access_token");
      const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

      if (!accessToken) {
        return null;
      }

      // Check if token is expired
      if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
        return null;
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
      // First validate the refresh token using introspection
      const tokenValidation = await this.validateRefreshToken();

      if (!tokenValidation.active) {
        throw new BlitzWareError(
          "Refresh token is invalid or expired",
          AuthErrorCode.REFRESH_FAILED
        );
      }

      const refreshToken = await this.getStoredToken("refresh_token");

      if (!refreshToken) {
        throw new BlitzWareError(
          "No refresh token available",
          AuthErrorCode.REFRESH_FAILED
        );
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
          ? Date.now() + tokenResult.expiresIn * 1000
          : undefined,
      });

      return tokenResult.accessToken;
    } catch (error) {
      // If refresh fails, clear stored tokens
      await this.clearStorage();
      throw this.handleError(error, AuthErrorCode.REFRESH_FAILED);
    }
  }

  /**
   * Get current authenticated user, validating token and refreshing if needed
   * Validates token then fetches user info
   */
  async getUser(): Promise<BlitzWareUser | null> {
    try {
      // First ensure we have a valid token
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        return null;
      }

      // Get user from storage first (for performance)
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      let storedUser = userJson ? JSON.parse(userJson) : null;

      // If we have stored user data and token is valid, return it
      if (storedUser) {
        return storedUser;
      }

      // No stored user or need fresh data, fetch from server
      const user = await this.fetchUserInfo();
      await this.storeUser(user);

      return user;
    } catch (error) {
      console.warn("Failed to get user:", error);
      return null;
    }
  }

  /**
   * Get current authenticated user from storage only (no server validation)
   * Use this for UI updates where you don't need fresh data
   */
  async getUserFromStorage(): Promise<BlitzWareUser | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.warn("Failed to get user from storage:", error);
      return null;
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

      return user.roles.some((role) =>
        typeof role === "string"
          ? role.toLowerCase() === roleName.toLowerCase()
          : role.name?.toLowerCase() === roleName.toLowerCase()
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetches user information using the stored access token with validation.
   * Validates the token with the authorization server before fetching user info.
   * @returns The authenticated user's information.
   * @throws BlitzWareAuthError if the token is invalid or request fails.
   */
  private async fetchUserInfo(): Promise<BlitzWareUser> {
    try {
      // First validate the token using introspection
      const tokenValidation = await this.validateAccessToken();

      if (!tokenValidation.active) {
        throw new BlitzWareError(
          "Access token is invalid or expired",
          AuthErrorCode.TOKEN_EXPIRED
        );
      }

      // If token is valid, fetch user info
      const accessToken = await this.getStoredToken("access_token");
      if (!accessToken) {
        throw new BlitzWareError(
          "No access token available",
          AuthErrorCode.TOKEN_EXPIRED
        );
      }

      const response = await apiClient.get("/userinfo", {
        params: {
          access_token: accessToken,
        },
      });
      return response.data;
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
        await AsyncStorage.setItem(
          STORAGE_KEYS.TOKEN_EXPIRY,
          tokens.expiresAt.toString()
        );
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
      console.warn("Failed to store user:", error);
    }
  }

  /**
   * Get stored token (public method)
   */
  async getStoredToken(
    type: "access_token" | "refresh_token"
  ): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(
        type === "access_token"
          ? SECURE_STORE_KEYS.ACCESS_TOKEN
          : SECURE_STORE_KEYS.REFRESH_TOKEN
      );
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
        STORAGE_KEYS.TOKEN_EXPIRY,
      ]);
    } catch (error) {
      console.warn("Failed to clear storage:", error);
    }
  }

  /**
   * Introspects a token to check its validity and get metadata.
   * Implements RFC 7662 OAuth2 Token Introspection.
   * @param token - The token to introspect.
   * @param tokenTypeHint - The type of token being introspected.
   * @param clientId - The client ID.
   * @param clientSecret - The client secret (optional for public clients).
   * @returns Token introspection response.
   * @throws BlitzWareAuthError if introspection fails.
   */
  private introspectToken = async (
    token: string,
    tokenTypeHint: "access_token" | "refresh_token"
  ): Promise<TokenIntrospectionResponse> => {
    try {
      const requestBody: {
        token: string;
        token_type_hint: string;
        client_id: string;
        client_secret?: string;
      } = {
        token,
        token_type_hint: tokenTypeHint,
        client_id: this.config.clientId,
      };

      const response = await apiClient.post("/introspect", requestBody);

      return response.data;
    } catch (error) {
      throw this.handleError(error, AuthErrorCode.INTROSPECTION_FAILED);
    }
  };

  /**
   * Validates an access token by introspecting it with the authorization server.
   * This provides authoritative validation from the server.
   * @param clientId - The client ID.
   * @param clientSecret - The client secret (optional for public clients).
   * @returns Promise that resolves to introspection result.
   * @throws BlitzWareAuthError if validation fails.
   */
  private validateAccessToken =
    async (): Promise<TokenIntrospectionResponse> => {
      const token = await this.getStoredToken("access_token");
      if (!token) {
        return { active: false };
      }

      try {
        return await this.introspectToken(token, "access_token");
      } catch (error) {
        // If introspection fails, token is considered invalid
        return { active: false };
      }
    };

  /**
   * Validates a refresh token by introspecting it with the authorization server.
   * @param clientId - The client ID.
   * @param clientSecret - The client secret (optional for public clients).
   * @returns Promise that resolves to introspection result.
   * @throws BlitzWareAuthError if validation fails.
   */
  private validateRefreshToken =
    async (): Promise<TokenIntrospectionResponse> => {
      const token = await this.getStoredToken("refresh_token");
      if (!token) {
        return { active: false };
      }

      try {
        return await this.introspectToken(token, "refresh_token");
      } catch (error) {
        // If introspection fails, token is considered invalid
        return { active: false };
      }
    };

  /**
   * Decodes a JWT and returns its payload as an object.
   * @param token - The JWT string.
   * @returns The decoded payload object, or {} if decoding fails.
   */
  private parseJwt = (token: string) => {
    try {
      if (!token) return {};
      const parts = token.split(".");
      if (parts.length !== 3) return {};

      const base64Url = parts[1];
      // Replace URL-safe characters and add padding if needed
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        "="
      );

      let jsonPayload: string;
      if (typeof Buffer !== "undefined") {
        // Node.js environment
        const payload = Buffer.from(padded, "base64");
        jsonPayload = payload.toString("utf8");
      } else {
        // Browser environment
        jsonPayload = atob(padded);
      }

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error(error);
      return {};
    }
  };

  /**
   * Converts a JWT exp (expiration) value to a Date object.
   * @param exp - The expiration value (number or string).
   * @returns The expiration as a Date, or null if invalid.
   */
  private parseExp = (exp: number | string) => {
    if (!exp) return null;
    if (typeof exp !== "number") exp = Number(exp);
    if (isNaN(exp)) return null;
    return new Date(exp * 1000);
  };

  /**
   * Checks if the stored access token is valid by validating with the server.
   * This provides authoritative validation.
   * @returns True if the token is valid according to the server, false otherwise.
   */
  isAuthenticated = async (): Promise<boolean> => {
    try {
      const tokenValidation = await this.validateAccessToken();
      return tokenValidation.active;
    } catch (error) {
      return false;
    }
  };

  /**
   * Checks if the stored access token is valid locally (not expired).
   * This is a quick local check based on JWT expiration.
   * @returns True if the token appears valid locally, false otherwise.
   */
  isTokenValidLocally = async (): Promise<boolean> => {
    const token = await this.getStoredToken("access_token");
    if (!token) return false;

    const payload = this.parseJwt(token);
    if (!payload || typeof payload !== "object") return false;

    const { exp } = payload;
    const expiration = this.parseExp(exp);
    if (!expiration) return false;
    return expiration > new Date();
  };

  /**
   * Handle and normalize errors
   */
  private handleError(error: any, code: AuthErrorCode): BlitzWareError {
    if (error instanceof BlitzWareError) {
      return error;
    }

    const message =
      error?.message || error?.toString() || "Unknown error occurred";
    return new BlitzWareError(message, code);
  }
}
