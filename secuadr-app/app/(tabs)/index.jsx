import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SecuADR 🔐</Text>
      <Text style={styles.subtitle}>
        Your secure gesture-based authentication app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f9fafb", // light background
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827", // dark text
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563", // gray text
    textAlign: "center",
  },
});
