// Main exports
export { BlitzWareAuthClient } from './BlitzWareAuthClient';
export { BlitzWareAuthProvider, useBlitzWareAuth } from './context/BlitzWareAuthContext';

// Hook exports
export {
  useUser,
  useIsAuthenticated,
  useIsLoading,
  useAuthError,
  useHasRole,
  useAccessToken,
  useLogin,
  useLogout,
  useRefresh,
  useValidateSession
} from './hooks';

// Utility exports
export {
  hasRole,
  hasAnyRole,
  hasAllRoles,
  getUserRoles,
  getUserDisplayName,
  isTokenExpired,
  generateRandomString,
  validateConfig
} from './utils';

// Type exports
export type {
  BlitzWareUser,
  Role,
  BlitzWareConfig,
  AuthState,
  TokenSet,
  AuthorizeResult,
  BlitzWareAuthContextValue,
  BlitzWareProviderProps
} from './types';

export { BlitzWareError, AuthErrorCode } from './types';