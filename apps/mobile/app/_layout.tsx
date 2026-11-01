import { useState } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><Stack screenOptions={{ headerShown: false }} /></QueryClientProvider>;
}
