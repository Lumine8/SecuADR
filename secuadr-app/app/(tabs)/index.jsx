import { View, Text, Button, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
// import secuADR from "../../assets/images/logoRmvBg.png";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/logoRmvBg.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Welcome to SecuADR</Text>
      <Button title="Go to Pattern" onPress={() => router.push("/pattern")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
    resizeMode: "contain",
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
});
