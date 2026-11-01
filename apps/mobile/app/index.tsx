import { useQuery } from "@tanstack/react-query";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { createApiClient } from "@nb-hub/core/api";

const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080");

export default function HomeScreen() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["mobile", "health"],
    queryFn: api.getHealth,
    refetchInterval: 10_000,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.heading}>nb-hub</Text>
        <Text>Mobile owns this native screen.</Text>
        <Text accessibilityRole="text">
          API: {isPending ? "Connecting…" : error ? `Unavailable: ${error.message}` : data?.status}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Check again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  heading: { fontSize: 32, fontWeight: "700" },
  button: { backgroundColor: "#111827", borderRadius: 8, padding: 14, alignSelf: "flex-start" },
  buttonText: { color: "white", fontWeight: "600" },
});
