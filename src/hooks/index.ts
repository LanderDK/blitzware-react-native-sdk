import { useBlitzWareAuth } from '../context/BlitzWareAuthContext';
import { BlitzWareUser } from '../types';

/**
 * Hook to get the current authenticated user
 */
export const useUser = (): BlitzWareUser | null => {
  const { user } = useBlitzWareAuth();
  return user;
};

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useBlitzWareAuth();
  return isAuthenticated;
};

/**
 * Hook to check if authentication is loading
 */
export const useIsLoading = (): boolean => {
  const { isLoading } = useBlitzWareAuth();
  return isLoading;
};

/**
 * Hook to get authentication error
 */
export const useAuthError = (): Error | null => {
  const { error } = useBlitzWareAuth();
  return error;
};

/**
 * Hook to check if user has a specific role
 */
export const useHasRole = (role: string): boolean => {
  const { hasRole } = useBlitzWareAuth();
  return hasRole(role);
};

/**
 * Hook to get access token
 */
export const useAccessToken = () => {
  const { getAccessToken } = useBlitzWareAuth();
  return getAccessToken;
};

/**
 * Hook to get login function
 */
export const useLogin = () => {
  const { login } = useBlitzWareAuth();
  return login;
};

/**
 * Hook to get logout function
 */
export const useLogout = () => {
  const { logout } = useBlitzWareAuth();
  return logout;
};

/**
 * Hook to get refresh function
 */
export const useRefresh = () => {
  const { refresh } = useBlitzWareAuth();
  return refresh;
};

/**
 * Hook to validate current session
 * Use this for protected routes/components to ensure user has valid session
 */
export const useValidateSession = () => {
  const { validateSession } = useBlitzWareAuth();
  return validateSession;
};