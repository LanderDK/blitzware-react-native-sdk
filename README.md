# BlitzWare React Native SDK

A comprehensive authentication SDK for React Native applications using Expo, providing secure OAuth 2.0 authentication with automatic token management, session validation, and role-based access control.

## Features

- 🔐 **OAuth 2.0 Authentication**: Secure authentication with PKCE (Proof Key for Code Exchange)
- 📱 **Cross-Platform**: iOS, Android, and Web support via Expo
- 🔄 **Automatic Token Management**: Automatic token refresh with server-side validation
- 🛡️ **Session Validation**: Real-time session validation for protected resources
- 🔑 **Secure Storage**: Uses Expo SecureStore for token storage
- 👥 **Role-Based Access**: Built-in role checking and authorization
- ⚡ **React Hooks**: Modern React patterns with comprehensive hooks
- 🔍 **Server Validation**: Token introspection for enhanced security
- 🎯 **Loading States**: Built-in loading and error state management

## Installation

```bash
npm install blitzware-react-native-sdk expo-auth-session expo-secure-store
# or
yarn add blitzware-react-native-sdk expo-auth-session expo-secure-store
```

### Prerequisites

This SDK requires Expo and the following dependencies:
- `expo-auth-session` - For OAuth 2.0 authentication
- `expo-secure-store` - For secure token storage

If using Expo managed workflow, these are included. For bare React Native, install them separately.

### Platform Setup

#### iOS Setup

1. Add URL scheme to your `app.json` or `app.config.js`:
```json
{
  "expo": {
    "scheme": "yourapp"
  }
}
```

#### Android Setup

The URL scheme in `app.json` automatically configures Android intent filters in Expo managed workflow.

For bare React Native, add to `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="yourapp" />
</intent-filter>
```

## Implementation Guide

Follow this step-by-step guide to implement authentication in your app.

### Step 1: Configure the Provider

Wrap your app with the `BlitzWareAuthProvider` at the root level:

```tsx
import React from 'react';
import { BlitzWareAuthProvider, BlitzWareConfig } from 'blitzware-react-native-sdk';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const blitzWareConfig: BlitzWareConfig = {
    clientId: "your-client-id",
    redirectUri: "yourapp://oauth", // Must match your app scheme
    responseType: "code", // OAuth 2.0 authorization code flow
  };

  return (
    <BlitzWareAuthProvider config={blitzWareConfig}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </BlitzWareAuthProvider>
  );
}
```

### Step 2: Basic Authentication

Create your main authentication screen:

```tsx
import React from "react";
import { StyleSheet, Pressable, View, Text } from "react-native";
import { useBlitzWareAuth } from "blitzware-react-native-sdk";

export default function HomeScreen() {
  const { login, logout, isAuthenticated, user, isLoading, error } = useBlitzWareAuth();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BlitzWare Authentication</Text>
      
      {/* Authentication Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.subtitle}>Status:</Text>
        <Text>
          {isLoading ? "Loading..." : isAuthenticated ? "Authenticated" : "Not Authenticated"}
        </Text>
        
        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}
        
        {/* User Information */}
        {user && (
          <View style={styles.userContainer}>
            <Text style={styles.subtitle}>User Info:</Text>
            <Text>ID: {user.id}</Text>
            <Text>Email: {user.email || "N/A"}</Text>
            <Text>Username: {user.username || "N/A"}</Text>
          </View>
        )}
      </View>
      
      {/* Login/Logout Button */}
      <View style={styles.buttonContainer}>
        {!isAuthenticated ? (
          <Pressable style={styles.button} onPress={handleLogin} disabled={isLoading}>
            <Text style={styles.buttonText}>Login with BlitzWare</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={handleLogout} disabled={isLoading}>
            <Text style={styles.buttonText}>Logout</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
```

### Step 3: Advanced Features - Session Validation

Add session validation for enhanced security:

```tsx
import React, { useState } from "react";
import { Alert } from "react-native";
import { useValidateSession } from "blitzware-react-native-sdk";

export default function ProtectedScreen() {
  const { isAuthenticated, user } = useBlitzWareAuth();
  const validateSession = useValidateSession();
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);

  const handleValidateSession = async () => {
    setValidating(true);
    try {
      const isValid = await validateSession();
      setSessionValid(isValid);
      Alert.alert(
        "Session Status",
        isValid ? "Session is valid!" : "Session expired. Please log in again."
      );
    } catch (error) {
      console.error("Session validation error:", error);
      Alert.alert("Error", "Failed to validate session");
    } finally {
      setValidating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text>Please log in to access this content</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Protected Content</Text>
      <Text>Welcome, {user?.username || user?.email}!</Text>
      
      {/* Session Status Display */}
      {sessionValid !== null && (
        <View style={[styles.statusBadge, { 
          backgroundColor: sessionValid ? '#4CAF50' : '#F44336' 
        }]}>
          <Text style={styles.statusText}>
            Session: {sessionValid ? 'Valid' : 'Invalid'}
          </Text>
        </View>
      )}
      
      <Pressable 
        style={styles.button} 
        onPress={handleValidateSession}
        disabled={validating}
      >
        <Text style={styles.buttonText}>
          {validating ? "Validating..." : "Check Session"}
        </Text>
      </Pressable>
    </View>
  );
}
```

### Step 4: Access Token Management

Get access tokens for API calls:

```tsx
import React from "react";
import { Alert } from "react-native";
import { useAccessToken } from "blitzware-react-native-sdk";

export default function ApiScreen() {
  const getAccessToken = useAccessToken();

  const makeApiCall = async () => {
    try {
      // Get the access token (automatically refreshed if needed)
      const token = await getAccessToken();
      
      if (!token) {
        Alert.alert("Error", "No access token available");
        return;
      }

      // Make authenticated API call
      const response = await fetch("https://api.yourservice.com/protected", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert("Success", "API call successful!");
      } else {
        Alert.alert("Error", "API call failed");
      }
    } catch (error) {
      console.error("API call error:", error);
      Alert.alert("Error", "Failed to make API call");
    }
  };

  const showTokenInfo = async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        Alert.alert(
          "Token Info", 
          `Length: ${token.length} characters\nPreview: ${token.substring(0, 20)}...`
        );
      } else {
        Alert.alert("No Token", "No access token available");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to get token info");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API Integration</Text>
      
      <Pressable style={styles.button} onPress={makeApiCall}>
        <Text style={styles.buttonText}>Make Protected API Call</Text>
      </Pressable>
      
      <Pressable style={styles.button} onPress={showTokenInfo}>
        <Text style={styles.buttonText}>Show Token Info</Text>
      </Pressable>
    </View>
  );
}
```

### Step 5: Role-Based Access Control

Implement role-based features:

```tsx
import React from "react";
import { useHasRole } from "blitzware-react-native-sdk";

export default function Dashboard() {
  const { user } = useBlitzWareAuth();
  const isAdmin = useHasRole('admin');
  const isPremium = useHasRole('premium');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text>Welcome, {user?.username}!</Text>
      <Text>Roles: {user?.roles?.join(', ') || 'None'}</Text>
      
      {/* Admin-only content */}
      {isAdmin && (
        <View style={[styles.card, styles.adminCard]}>
          <Text style={styles.cardTitle}>🔧 Admin Panel</Text>
          <Text>You have administrative privileges</Text>
        </View>
      )}
      
      {/* Premium content */}
      {isPremium && (
        <View style={[styles.card, styles.premiumCard]}>
          <Text style={styles.cardTitle}>⭐ Premium Features</Text>
          <Text>Access to premium content</Text>
        </View>
      )}
      
      {/* Regular user content */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 User Stats</Text>
        <Text>Standard user features available</Text>
      </View>
    </View>
  );
}
```

## API Reference

### Core Hook: useBlitzWareAuth()

The main hook providing complete authentication state and methods:

```tsx
const {
  // State
  isAuthenticated,    // boolean - Current authentication status
  isLoading,         // boolean - Loading state (login, logout, refresh)
  user,              // BlitzWareUser | null - Current user information
  error,             // Error | null - Last authentication error
  
  // Methods
  login,             // () => Promise<void> - Initiate login flow
  logout,            // () => Promise<void> - Logout and clear tokens
  getAccessToken,    // () => Promise<string | null> - Get access token
  hasRole,           // (role: string) => boolean - Check user role
  refresh,           // () => Promise<void> - Manually refresh tokens
  validateSession,   // () => Promise<boolean> - Validate current session
} = useBlitzWareAuth();
```

### Specialized Hooks

#### Individual State Hooks
```tsx
const user = useUser();                    // Get current user
const isAuthenticated = useIsAuthenticated(); // Check auth status
const isLoading = useIsLoading();            // Check loading state
const error = useAuthError();               // Get auth error
```

#### Action Hooks
```tsx
const login = useLogin();                   // Get login function
const logout = useLogout();                 // Get logout function
const getAccessToken = useAccessToken();    // Get token function
const refresh = useRefresh();               // Get refresh function
const validateSession = useValidateSession(); // Get validation function
```

#### Authorization Hooks
```tsx
const hasAdminRole = useHasRole('admin');   // Check specific role
```

### Configuration

```tsx
interface BlitzWareConfig {
  clientId: string;           // Your BlitzWare client ID
  redirectUri: string;        // OAuth redirect URI (must match app scheme)
  responseType?: 'code';      // OAuth flow type (code is recommended)
}
```

### User Object

```tsx
interface BlitzWareUser {
  id: string;                 // Unique user identifier
  email?: string;             // User email address
  username?: string;          // User display name
  name?: string;              // Full name
  roles?: string[];           // User roles for RBAC
  [key: string]: any;         // Additional user properties
}
```

## Error Handling

The SDK provides comprehensive error handling:

```tsx
import { BlitzWareError, AuthErrorCode } from 'blitzware-react-native-sdk';

function LoginComponent() {
  const { login, error } = useBlitzWareAuth();

  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      if (err instanceof BlitzWareError) {
        switch (err.code) {
          case AuthErrorCode.NETWORK_ERROR:
            console.error('Network error:', err.message);
            break;
          case AuthErrorCode.AUTHENTICATION_FAILED:
            console.error('Authentication failed:', err.message);
            break;
          case AuthErrorCode.TOKEN_EXPIRED:
            console.error('Token expired:', err.message);
            break;
          default:
            console.error('Authentication error:', err.message);
        }
      }
    }
  };

  return (
    <View>
      {error && (
        <Text style={{ color: 'red' }}>
          Error: {error.message}
        </Text>
      )}
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
```

## Security Features

### Automatic Token Management
- **Server-side Validation**: Tokens are validated against the server on app initialization
- **Automatic Refresh**: Expired tokens are automatically refreshed before API calls
- **Secure Storage**: Tokens stored using Expo SecureStore (Keychain/Keystore)

### Session Management
- **Real-time Validation**: Use `validateSession()` to check if sessions are still valid
- **Protected Routes**: Validate sessions before accessing sensitive content
- **Automatic Cleanup**: Tokens are cleared on logout or when invalid

### Best Practices
```tsx
// Always validate sessions for sensitive operations
const protectedAction = async () => {
  const isValid = await validateSession();
  if (!isValid) {
    Alert.alert('Session Expired', 'Please log in again');
    return;
  }
  // Proceed with protected action
};

// Use automatic token refresh for API calls
const apiCall = async () => {
  const token = await getAccessToken(); // Automatically refreshed if needed
  // Make API call with fresh token
};
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type { 
  BlitzWareUser, 
  BlitzWareConfig, 
  AuthState,
  BlitzWareError,
  AuthErrorCode
} from 'blitzware-react-native-sdk';
```

## Platform Support

- **Expo**: SDK 49+
- **iOS**: 13.0+
- **Android**: API 21+
- **Web**: Modern browsers
- **React Native**: 0.70+
- **React**: 18.0+

## Example Styles

```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusContainer: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    marginBottom: 20,
  },
  userContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    backgroundColor: '#f0f0f0',
  },
  adminCard: {
    backgroundColor: '#fff3cd',
  },
  premiumCard: {
    backgroundColor: '#d1ecf1',
  },
});
```

## Troubleshooting

### Common Issues

1. **"Unable to open URL" Error**
   - Verify your app scheme matches the `redirectUri` in config
   - Check that URL scheme is properly configured in `app.json`

2. **Session Validation Fails**
   - Ensure your BlitzWare server supports token introspection
   - Check network connectivity
   - Verify client ID configuration

3. **Token Not Persisting**
   - Expo SecureStore requires device authentication (PIN/biometric)
   - Check that SecureStore is available on the device

### Debug Mode

Enable detailed logging in development:

```tsx
const config = {
  clientId: "your-client-id",
  redirectUri: "yourapp://oauth",
  // Add debug logging in development
  ...__DEV__ && { debug: true }
};
```

## Examples

Check the `/examples` directory for complete working implementations:
- Basic authentication flow
- Protected routes with session validation
- API integration with automatic token refresh
- Role-based access control
- Error handling patterns

## Support

- 📚 [Documentation](https://docs.blitzware.xyz)
- 💬 [Community Support](https://community.blitzware.xyz)
- 🐛 [Report Issues](https://github.com/blitzware/blitzware-react-native-sdk/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details.