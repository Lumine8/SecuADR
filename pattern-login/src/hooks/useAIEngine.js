import { useState, useEffect } from "react";

export const useAIEngine = () => {
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch("/api/cnn-status");
        const status = await response.json();
        setAiStatus(status);

        if (!status.aiEngine.cnn.status === "online") {
          console.warn(
            "⚠️ AI Engine: $1 Recognizer Only (Adaptive AI Unavailable)"
          );
        }
      } catch (error) {
        console.error("Failed to check AI status:", error);
        setAiStatus({
          currentMode: "fallback",
          message: "AI status check failed",
        });
      } finally {
        setLoading(false);
      }
    };

    checkAIStatus();
  }, []);

  return { aiStatus, loading };
};
