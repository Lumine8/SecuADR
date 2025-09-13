const ort = require("onnxruntime-node");
const path = require("path");

class ONNXPredictor {
  constructor() {
    this.session = null;
    this.modelLoaded = false;
  }

  async loadModel(modelPath = "./models/gesture_cnn.onnx") {
    try {
      console.log("🔍 Loading ONNX CNN model from:", modelPath);

      const fullPath = path.resolve(__dirname, "..", modelPath);
      this.session = await ort.InferenceSession.create(fullPath);
      this.modelLoaded = true;

      console.log("✅ ONNX CNN model loaded successfully");
      console.log("📊 Model input names:", this.session.inputNames);
      console.log("📊 Model output names:", this.session.outputNames);

      return true;
    } catch (error) {
      console.error("❌ Failed to load ONNX model:", error.message);
      this.modelLoaded = false;
      return false;
    }
  }

  async predict(gestureData) {
    if (!this.session || !this.modelLoaded) {
      throw new Error("Model not loaded");
    }

    try {
      // Preprocess gesture data for your model
      const processedData = this.preprocessGestureData(gestureData);

      // Create input tensor
      const inputTensor = new ort.Tensor("float32", processedData, [
        1,
        processedData.length,
      ]);

      // Run inference
      const results = await this.session.run({
        [this.session.inputNames[0]]: inputTensor,
      });

      // Get confidence score
      const outputTensor = results[this.session.outputNames[0]];
      const confidence = outputTensor.data[0];

      console.log(`🧠 ONNX CNN Result: ${(confidence * 100).toFixed(1)}%`);

      return {
        confidence: confidence,
        prediction: confidence > 0.7 ? "authentic" : "suspicious",
        method: "ONNX CNN",
      };
    } catch (error) {
      console.error("❌ ONNX prediction error:", error);
      throw error;
    }
  }

  preprocessGestureData(gestureData) {
    // Convert gesture points to the format your CNN expects
    // This should match how you trained your model
    const points = gestureData.map((point) => [point.X, point.Y]).flat();

    // Pad or truncate to fixed size (adjust based on your model)
    const targetSize = 128; // Adjust based on your model's input size
    const processedData = new Float32Array(targetSize);

    for (let i = 0; i < Math.min(points.length, targetSize); i++) {
      processedData[i] = points[i] / 300.0; // Normalize to 0-1 range
    }

    return processedData;
  }

  isModelLoaded() {
    return this.modelLoaded;
  }
}

module.exports = ONNXPredictor;
