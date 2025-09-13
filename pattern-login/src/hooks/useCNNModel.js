// src/hooks/useCNNModel.js
import { useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";

export const useCNNModel = () => {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await tf.loadLayersModel(
          "/models/secuadr-cnn-model/model.json"
        );
        setModel(loadedModel);
        console.log("✅ Frontend CNN model loaded");
        setError(null);
      } catch (err) {
        console.warn("⚠️ CNN model failed to load, using API fallback");
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, []);

  return { model, loading, error };
};
