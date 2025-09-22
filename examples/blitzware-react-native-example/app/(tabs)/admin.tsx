import React from "react";
import { StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useBlitzWareAuth } from "blitzware-react-native-sdk";

export default function AdminScreen() {
  const { isAuthenticated, user, isLoading, error, hasRole } =
    useBlitzWareAuth();
  const isAdmin = hasRole("admin");

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
            <ThemedText>ID: {user.id}</ThemedText>
            <ThemedText>Email: {user.email || "N/A"}</ThemedText>
            <ThemedText>Name: {user.username || "N/A"}</ThemedText>
            <ThemedText>
              Roles: {(user.roles || []).join(", ") || "N/A"}
            </ThemedText>
            <ThemedText>Is Admin: {isAdmin ? "Yes" : "No"}</ThemedText>
          </ThemedView>
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
});
