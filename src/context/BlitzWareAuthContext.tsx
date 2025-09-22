import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { BlitzWareAuthClient } from "../BlitzWareAuthClient";
import {
  AuthState,
  BlitzWareAuthContextValue,
  BlitzWareProviderProps,
  BlitzWareError,
} from "../types";

const BlitzWareAuthContext = createContext<
  BlitzWareAuthContextValue | undefined
>(undefined);

export const BlitzWareAuthProvider: React.FC<BlitzWareProviderProps> = ({
  children,
  config,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  const [authClient] = useState(() => new BlitzWareAuthClient(config));

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // First check if we have a stored access token
      const hasStoredToken = await authClient.getStoredToken("access_token");

      if (!hasStoredToken) {
        // No token available - user is not authenticated
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
        return;
      }

      // Validate token with server
      const isValid = await authClient.isAuthenticated();

      if (!isValid) {
        // Token is invalid or expired, try to refresh
        try {
          await authClient.refreshAccessToken();
          // After successful refresh, fetch user info
          const user = await authClient.getUser();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            error: null,
          });
        } catch (refreshError) {
          // Refresh failed, clear everything
          await authClient.logout();
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: null,
          });
        }
      } else {
        // Token is valid, get user info
        const user = await authClient.getUser();
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user,
          error: null,
        });
      }
    } catch (error) {
      // On any error, treat as unauthenticated
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error:
          error instanceof Error
            ? error
            : new Error("Authentication check failed"),
      });
    }
  }, [authClient]);

  // Login function
  const login = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const user = await authClient.login();

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error("Login failed"),
      }));
      throw error;
    }
  }, [authClient]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      await authClient.logout();

      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error("Logout failed"),
      }));
      throw error;
    }
  }, [authClient]);

  // Get access token with automatic validation/refresh
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      return await authClient.getAccessToken();
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to get access token"),
      }));
      return null;
    }
  }, [authClient]);

  // Validate current session
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await authClient.isAuthenticated();

      if (!isValid) {
        // Try to refresh
        try {
          await authClient.refreshAccessToken();
          return true;
        } catch (refreshError) {
          // Refresh failed, clear session
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: null,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }, [authClient]);

  // Check if user has specific role
  const hasRole = useCallback(
    (role: string): boolean => {
      if (!authState.user || !authState.user.roles) {
        return false;
      }

      return authState.user.roles.some((userRole) =>
        typeof userRole === "string"
          ? userRole.toLowerCase() === role.toLowerCase()
          : userRole.name?.toLowerCase() === role.toLowerCase()
      );
    },
    [authState.user]
  );

  // Refresh authentication state
  const refresh = useCallback(async () => {
    await initializeAuth();
  }, [initializeAuth]);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const contextValue: BlitzWareAuthContextValue = {
    ...authState,
    login,
    logout,
    getAccessToken,
    hasRole,
    refresh,
    validateSession,
  };

  return (
    <BlitzWareAuthContext.Provider value={contextValue}>
      {children}
    </BlitzWareAuthContext.Provider>
  );
};

export const useBlitzWareAuth = (): BlitzWareAuthContextValue => {
  const context = useContext(BlitzWareAuthContext);

  if (context === undefined) {
    throw new BlitzWareError(
      "useBlitzWareAuth must be used within a BlitzWareAuthProvider"
    );
  }

  return context;
};
