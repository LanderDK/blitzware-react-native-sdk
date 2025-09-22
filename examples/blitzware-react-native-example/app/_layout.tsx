import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { BlitzWareAuthProvider, BlitzWareConfig } from "blitzware-react-native-sdk";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const blitzWareConfig: BlitzWareConfig = {
    clientId: "2f465572-9a90-4bd1-b4ec-3b03b33fbb66", // Test client ID
    redirectUri: "blitzwarereactnativeexample://oauth", // Using the app scheme from app.json
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
