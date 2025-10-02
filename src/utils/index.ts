import { BlitzWareUser } from "../types";

/**
 * Check if user has a specific role
 */
export const hasRole = (
  user: BlitzWareUser | null,
  roleName: string
): boolean => {
  if (!user || !user.roles) {
    return false;
  }

  return user.roles.some(
    (role) => role.toLowerCase() === roleName.toLowerCase()
  );
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (
  user: BlitzWareUser | null,
  roleNames: string[]
): boolean => {
  if (!user || !user.roles || roleNames.length === 0) {
    return false;
  }

  return roleNames.some((roleName) => hasRole(user, roleName));
};

/**
 * Check if user has all of the specified roles
 */
export const hasAllRoles = (
  user: BlitzWareUser | null,
  roleNames: string[]
): boolean => {
  if (!user || !user.roles || roleNames.length === 0) {
    return false;
  }

  return roleNames.every((roleName) => hasRole(user, roleName));
};

/**
 * Get user roles as string array
 */
export const getUserRoles = (user: BlitzWareUser | null): string[] => {
  if (!user || !user.roles) {
    return [];
  }

  return user.roles.map((role) => role).filter(Boolean);
};

/**
 * Format user display name
 */
export const getUserDisplayName = (user: BlitzWareUser | null): string => {
  if (!user) {
    return "Anonymous";
  }

  return user.username || user.email || "User";
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (expiresAt: number | undefined): boolean => {
  if (!expiresAt) {
    return false;
  }

  return Date.now() >= expiresAt;
};

/**
 * Create a secure random string
 */
export const generateRandomString = (length: number = 43): string => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return result;
};

/**
 * Validate BlitzWare configuration
 */
export const validateConfig = (config: any): string[] => {
  const errors: string[] = [];

  if (!config) {
    errors.push("Configuration is required");
    return errors;
  }

  if (!config.clientId) {
    errors.push("clientId is required");
  }

  if (!config.redirectUri) {
    errors.push("redirectUri is required");
  }

  // Validate redirect URI format
  if (config.redirectUri && !config.redirectUri.includes("://")) {
    errors.push(
      "redirectUri must include a valid scheme (e.g., myapp://callback)"
    );
  }

  // Warn about implicit flow on mobile (security consideration)
  if (config.responseType === "token") {
    console.warn(
      'BlitzWare: Using responseType "token" (implicit flow) on mobile is less secure. ' +
        'Consider using "code" (authorization code + PKCE) for better security.'
    );
  }

  return errors;
};
