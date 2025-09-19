import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BlitzWareAuthClient } from '../BlitzWareAuthClient';
import {
  BlitzWareConfig,
  BlitzWareUser,
  AuthState,
  BlitzWareAuthContextValue,
  BlitzWareProviderProps,
  BlitzWareError
} from '../types';

const BlitzWareAuthContext = createContext<BlitzWareAuthContextValue | undefined>(undefined);

export const BlitzWareAuthProvider: React.FC<BlitzWareProviderProps> = ({
  children,
  config
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null
  });

  const [authClient] = useState(() => new BlitzWareAuthClient(config));

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const [isAuthenticated, user] = await Promise.all([
        authClient.isAuthenticated(),
        authClient.getUser()
      ]);

      setAuthState({
        isAuthenticated,
        isLoading: false,
        user,
        error: null
      });
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    }
  }, [authClient]);

  // Login function
  const login = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const user = await authClient.login();

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Login failed')
      }));
      throw error;
    }
  }, [authClient]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      await authClient.logout();

      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Logout failed')
      }));
      throw error;
    }
  }, [authClient]);

  // Get access token
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      return await authClient.getAccessToken();
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to get access token')
      }));
      return null;
    }
  }, [authClient]);

  // Check if user has specific role
  const hasRole = useCallback((role: string): boolean => {
    if (!authState.user || !authState.user.roles) {
      return false;
    }

    return authState.user.roles.some(userRole => 
      typeof userRole === 'string' 
        ? userRole.toLowerCase() === role.toLowerCase()
        : userRole.name?.toLowerCase() === role.toLowerCase()
    );
  }, [authState.user]);

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
    refresh
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
      'useBlitzWareAuth must be used within a BlitzWareAuthProvider'
    );
  }
  
  return context;
};