import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // hide header by default
      }}
    >
      {/* Auth flow */}
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register" options={{ headerShown: false }} />
      <Stack.Screen name="auth/fallback" options={{ headerShown: false }} />

      {/* Tabs (main app after login) */}
      <Stack.Screen name="tabs" options={{ headerShown: false }} />

      {/* 404 page */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
