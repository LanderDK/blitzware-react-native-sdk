# BlitzWare React Native SDK

Authentication SDK for React Native applications, providing secure user authentication and role-based access control.

## Features

- 🔐 **Secure Authentication**: OAuth 2.0 with PKCE (authorization code flow)
- 📱 **Cross-Platform**: iOS and Android support
- 🔑 **Token Management**: Automatic token refresh and secure storage
- 👥 **Role-Based Access**: Built-in role checking and authorization
- ⚡ **React Hooks**: Modern React patterns with hooks and context
- 🛡️ **Security First**: Keychain/Keystore storage for sensitive data
- 🔄 **State Management**: Reactive authentication state updates
- 🔍 **Auto-Discovery**: Automatically discovers OAuth 2.0 endpoints

## Installation

```bash
npm install blitzware-react-native-sdk
# or
yarn add blitzware-react-native-sdk
```

### iOS Setup

1. Install CocoaPods dependencies:
```bash
cd ios && pod install
```

2. Add URL scheme to `ios/YourApp/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>auth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>yourapp</string>
    </array>
  </dict>
</array>
```

### Android Setup

1. Add intent filter to `android/app/src/main/AndroidManifest.xml`:
```xml
<activity
  android:name=".MainActivity"
  android:exported="true"
  android:launchMode="singleTask">
  <intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="yourapp" />
  </intent-filter>
</activity>
```

## Quick Start

### 1. Setup Provider

```tsx
import React from 'react';
import { BlitzWareAuthProvider } from 'blitzware-react-native-sdk';
import App from './App';

const config = {
  clientId: 'your-client-id',
  redirectUri: 'yourapp://callback',
  responseType: 'code' // Optional: 'code' (default) or 'token'
};

export default function Root() {
  return (
    <BlitzWareAuthProvider config={config}>
      <App />
    </BlitzWareAuthProvider>
  );
}
```

### 2. Use Authentication

```tsx
import React from 'react';
import { View, Button, Text } from 'react-native';
import { useBlitzWareAuth, useUser, useIsAuthenticated } from 'blitzware-react-native-sdk';

export default function LoginScreen() {
  const { login, logout, isLoading } = useBlitzWareAuth();
  const user = useUser();
  const isAuthenticated = useIsAuthenticated();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={{ padding: 20 }}>
      {isAuthenticated ? (
        <View>
          <Text>Welcome, {user?.name || user?.email}!</Text>
          <Button title="Logout" onPress={logout} />
        </View>
      ) : (
        <Button title="Login" onPress={login} />
      )}
    </View>
  );
}
```

### 3. Role-Based Access Control

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useUser, useHasRole } from '@blitzware/react-native-sdk';

export default function Dashboard() {
  const user = useUser();
  const isAdmin = useHasRole('admin');
  const isPremium = useHasRole('premium');

  return (
    <View style={{ padding: 20 }}>
      <Text>User Roles: {user?.roles?.join(', ')}</Text>
      
      {isAdmin && (
        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#fff3cd' }}>
          <Text style={{ fontWeight: 'bold' }}>Admin Panel</Text>
          <Text>You have administrative access</Text>
        </View>
      )}
      
      {isPremium && (
        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#d1ecf1' }}>
          <Text style={{ fontWeight: 'bold' }}>Premium Features</Text>
          <Text>Access to premium content</Text>
        </View>
      )}
    </View>
  );
}
```

## API Reference

### BlitzWareAuthProvider

Main provider component that wraps your app.

```tsx
interface BlitzWareConfig {
  clientId: string;
  domain: string;
  redirectUri: string;
  scopes?: string[];
  customScheme?: string;
  useRefreshTokens?: boolean;
  usePKCE?: boolean;
  additionalParameters?: Record<string, string>;
  additionalHeaders?: Record<string, string>;
}

<BlitzWareAuthProvider config={config}>
  {children}
</BlitzWareAuthProvider>
```

### Hooks

#### useBlitzWareAuth()
Main authentication hook with full auth state and methods.

```tsx
const {
  isAuthenticated,
  isLoading,
  user,
  error,
  login,
  logout,
  getAccessToken,
  hasRole,
  refresh
} = useBlitzWareAuth();
```

#### useUser()
Get current authenticated user.

```tsx
const user = useUser(); // BlitzWareUser | null
```

#### useIsAuthenticated()
Check if user is authenticated.

```tsx
const isAuthenticated = useIsAuthenticated(); // boolean
```

#### useHasRole(role: string)
Check if user has specific role.

```tsx
const isAdmin = useHasRole('admin'); // boolean
```

#### useAccessToken()
Get function to retrieve access token.

```tsx
const getAccessToken = useAccessToken();
const token = await getAccessToken(); // string | null
```

### Utility Functions

#### hasRole(user, roleName)
```tsx
import { hasRole } from '@blitzware/react-native-sdk';

const userHasAdminRole = hasRole(user, 'admin');
```

#### hasAnyRole(user, roleNames)
```tsx
import { hasAnyRole } from '@blitzware/react-native-sdk';

const userHasElevatedRole = hasAnyRole(user, ['admin', 'moderator']);
```

#### getUserDisplayName(user)
```tsx
import { getUserDisplayName } from '@blitzware/react-native-sdk';

const displayName = getUserDisplayName(user); // "John Doe" or "User"
```

## Error Handling

```tsx
import { useBlitzWareAuth, BlitzWareError, AuthErrorCode } from '@blitzware/react-native-sdk';

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
          default:
            console.error('Unknown error:', err.message);
        }
      }
    }
  };

  return (
    <View>
      {error && <Text style={{ color: 'red' }}>{error.message}</Text>}
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```tsx
import type { 
  BlitzWareUser, 
  BlitzWareConfig, 
  AuthState 
} from '@blitzware/react-native-sdk';

interface AppUser extends BlitzWareUser {
  customField?: string;
}
```

## Security Considerations

- **Token Storage**: Access and refresh tokens are stored securely using Keychain (iOS) and Keystore (Android)
- **PKCE**: Proof Key for Code Exchange is enabled by default for enhanced security
- **Automatic Refresh**: Tokens are automatically refreshed when expired
- **Deep Linking**: Secure handling of authentication redirects

## Platform Support

- **iOS**: 11.0+
- **Android**: API 21+
- **React Native**: 0.60+
- **React**: 16.8+ (hooks support)

## Examples

See the [examples](./examples) directory for complete sample applications demonstrating:

- Basic authentication flow
- Role-based access control
- API calls with authenticated requests
- Error handling and loading states

## Troubleshooting

### Common Issues

1. **"Unable to open URL" on iOS**
   - Ensure URL scheme is properly configured in Info.plist
   - Check that the scheme matches your redirect URI

2. **Authentication not working on Android**
   - Verify intent filter is correctly added to AndroidManifest.xml
   - Ensure the activity has `android:launchMode="singleTask"`

3. **Token not persisting**
   - Check that Keychain/Keystore permissions are properly configured
   - Ensure the app has necessary security permissions

### Debug Mode

Enable debug logging:

```tsx
const config = {
  // ... other config
  dangerouslyAllowInsecureHttpRequests: __DEV__, // Only for development
};
```

## Support

- 📚 [Documentation](https://docs.blitzware.xyz)
- 💬 [Community Support](https://community.blitzware.xyz)
- 🐛 [Report Issues](https://github.com/blitzware/blitzware-react-native-sdk/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details.