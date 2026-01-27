const ort = require("onnxruntime-node");
const fs = require("fs");
const path = require("path");

class ONNXPredictor {
  constructor() {
    this.session = null;
    this.modelLoaded = false;
    this.labelEncoder = null;
  }

  async loadModel(modelPath) {
    try {
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }

      // Load ONNX model
      this.session = await ort.InferenceSession.create(modelPath);

      // Load label encoder if it exists
      const encoderPath = path.join(
        path.dirname(modelPath),
        "label_encoder.pkl"
      );
      if (fs.existsSync(encoderPath)) {
        // Note: You'd need to implement pickle loading in JS or use Python bridge
        console.log("📊 Label encoder found");
      }

      this.modelLoaded = true;
      console.log("✅ ONNX CNN model loaded successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to load ONNX model:", error.message);
      this.modelLoaded = false;
      throw error;
    }
  }

  async predict(gestureData, username = null) {
    if (!this.modelLoaded || !this.session) {
      throw new Error("Model not loaded");
    }

    try {
      // Preprocess gesture data
      const processedInput = this.preprocessGesture(gestureData);

      // Create input tensor (batch_size=1, max_points=100, features=2)
      const inputTensor = new ort.Tensor(
        "float32",
        processedInput,
        [1, 100, 2]
      );

      // Run inference
      const results = await this.session.run({
        [this.session.inputNames[0]]: inputTensor,
      });

      // Process output
      const outputName = this.session.outputNames[0];
      const output = Array.from(results[outputName].data);

      const confidence = Math.max(...output);
      const predictedClass = output.indexOf(confidence);

      console.log(
        `🧠 CNN Prediction: confidence=${confidence.toFixed(
          3
        )}, class=${predictedClass}`
      );

      return {
        success: true,
        confidence: confidence,
        predictedClass: predictedClass,
        authenticated: confidence > 0.75, // Threshold for authentication
        method: "CNN Deep Learning",
        modelType: "production",
      };
    } catch (error) {
      console.error("❌ ONNX prediction failed:", error);
      throw error;
    }
  }

  preprocessGesture(gesturePoints, maxPoints = 100) {
    // Preprocess gesture data to match training format
    if (!gesturePoints || gesturePoints.length === 0) {
      return new Float32Array(maxPoints * 2).fill(0);
    }

    let points = gesturePoints.map((p) => [p.X || 0, p.Y || 0]);

    // Normalize coordinates (0-1 range)
    const allValues = points.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    if (max > min) {
      points = points.map(([x, y]) => [
        (x - min) / (max - min),
        (y - min) / (max - min),
      ]);
    }

    // Pad or truncate to fixed length
    const result = new Float32Array(maxPoints * 2);
    for (let i = 0; i < Math.min(points.length, maxPoints); i++) {
      result[i * 2] = points[i][0];
      result[i * 2 + 1] = points[i][1];
    }

    return result;
  }

  isModelLoaded() {
    return this.modelLoaded;
  }

  cleanup() {
    if (this.session) {
      // Properly close the session if method exists
      if (typeof this.session.close === "function") {
        this.session.close();
      }
      this.session = null;
      this.modelLoaded = false;
    }
  }
}

module.exports = ONNXPredictor;
