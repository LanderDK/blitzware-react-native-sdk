import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  BlitzWareAuthProvider,
  BlitzWareConfig,
} from "blitzware-react-native-sdk";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const blitzWareConfig: BlitzWareConfig = {
    clientId: "your-client-id",
    redirectUri: "yourapp://oauth", // Must match your app scheme
    responseType: "code", // or "token" for implicit flow
  };

  return (
    <BlitzWareAuthProvider config={blitzWareConfig}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </BlitzWareAuthProvider>
  );
}
