import React from "react";
import { StyleSheet, Pressable, Alert } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBlitzWareAuth } from "blitzware-react-native-sdk";

export default function HomeScreen() {
  const { login, logout, isAuthenticated, user, isLoading, error, hasRole } =
    useBlitzWareAuth();

  const handleLogin = async () => {
    console.log("Login button pressed");
    try {
      console.log("Calling login method...");
      const result = await login();
      console.log("Login result:", result);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      console.log("Logout successful");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">BlitzWare SDK Test</ThemedText>
      </ThemedView>

      <ThemedView style={styles.statusContainer}>
        <ThemedText type="subtitle">Authentication Status:</ThemedText>
        <ThemedText>
          {isLoading
            ? "Loading..."
            : isAuthenticated
              ? "Authenticated"
              : "Not Authenticated"}
        </ThemedText>

        {error && (
          <ThemedView style={styles.errorContainer}>
            <ThemedText type="subtitle">Error:</ThemedText>
            <ThemedText>{error.message}</ThemedText>
          </ThemedView>
        )}

        {user && (
          <ThemedView style={styles.userContainer}>
            <ThemedText type="subtitle">User Info:</ThemedText>
            <ThemedText>ID: {user.sub}</ThemedText>
            <ThemedText>Email: {user.email || "N/A"}</ThemedText>
            <ThemedText>Name: {user.name || "N/A"}</ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      <ThemedView style={styles.buttonContainer}>
        {!isAuthenticated ? (
          <Pressable
            style={styles.button}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <ThemedText style={styles.buttonText}>
              Login with BlitzWare
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={styles.button}
            onPress={handleLogout}
            disabled={isLoading}
          >
            <ThemedText style={styles.buttonText}>Logout</ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  statusContainer: {
    marginBottom: 40,
    padding: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  userContainer: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  errorContainer: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "rgba(255,0,0,0.1)",
  },
  buttonContainer: {
    alignItems: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
