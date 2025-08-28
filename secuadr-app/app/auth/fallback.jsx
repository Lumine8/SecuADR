// app/auth/fallback.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";

export default function FallbackAuth() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(
        "https://your-backend.com/api/auth/send-otp",
        { email }
      );
      setLoading(false);

      if (data.success) {
        setOtpSent(true);
        Alert.alert("OTP Sent", `An OTP has been sent to ${email}`);
      } else {
        Alert.alert("Error", data.message || "Failed to send OTP");
      }
    } catch (error) {
      setLoading(false);
      console.error("Send OTP error:", error);
      Alert.alert("Error", "Unable to send OTP. Please try again.");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert("Error", "Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(
        "https://your-backend.com/api/auth/verify-otp",
        { email, otp }
      );
      setLoading(false);

      if (data.success) {
        router.replace("/tabs"); // success -> main app
      } else {
        Alert.alert("Invalid OTP", data.message || "Please try again");
      }
    } catch (error) {
      setLoading(false);
      console.error("Verify OTP error:", error);
      Alert.alert("Error", "Unable to verify OTP. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fallback Authentication</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {otpSent && (
        <TextInput
          style={styles.input}
          placeholder="Enter OTP"
          placeholderTextColor="#888"
          value={otp}
          onChangeText={setOtp}
          keyboardType="numeric"
        />
      )}

      {!otpSent ? (
        <TouchableOpacity
          style={styles.button}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={handleVerifyOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  link: { color: "#007AFF", textAlign: "center", marginTop: 10, fontSize: 14 },
});
