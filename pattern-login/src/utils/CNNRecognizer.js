import * as tf from "@tensorflow/tfjs";

class CNNRecognizer {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.canvasSize = 64;
  }

  async loadModel(modelUrl = "/models/secuadr-cnn/model.json") {
    if (this.model || this.isLoading) return this.model;

    this.isLoading = true;
    console.log("🧠 Loading CNN model from:", modelUrl);

    try {
      this.model = await tf.loadLayersModel(modelUrl);
      console.log("✅ CNN model loaded successfully");
      console.log("Model input shape:", this.model.inputs[0].shape);
      return this.model;
    } catch (error) {
      console.error("❌ Failed to load CNN model:", error);
      throw new Error(`CNN model loading failed: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  pointsToTensor(points) {
    /**Convert gesture points to tensor for CNN prediction*/
    if (!points || points.length < 2) {
      return tf.zeros([1, this.canvasSize, this.canvasSize, 1]);
    }

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = this.canvasSize;
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // Get bounding box
    const xs = points.map((p) => p.X);
    const ys = points.map((p) => p.Y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);

    // Draw normalized gesture
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    points.forEach((point, i) => {
      const x = ((point.X - minX) / width) * (this.canvasSize - 4) + 2;
      const y = ((point.Y - minY) / height) * (this.canvasSize - 4) + 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Convert to tensor
    const tensor = tf.browser
      .fromPixels(canvas, 1) // Grayscale
      .div(255.0) // Normalize to [0,1]
      .expandDims(0); // Add batch dimension

    return tensor;
  }

  async predict(points) {
    /**Make prediction using loaded CNN model*/
    if (!this.model) {
      throw new Error("CNN model not loaded. Call loadModel() first.");
    }

    const inputTensor = this.pointsToTensor(points);

    try {
      const prediction = this.model.predict(inputTensor);
      const confidence = await prediction.data();

      // Cleanup tensors to prevent memory leaks
      inputTensor.dispose();
      prediction.dispose();

      return {
        confidence: confidence[0],
        isMatch: confidence[0] > 0.92,
        method: "cnn",
      };
    } catch (error) {
      console.error("❌ CNN prediction error:", error);
      inputTensor.dispose();
      throw error;
    }
  }

  dispose() {
    /**Cleanup model and free memory*/
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

export default CNNRecognizer;
