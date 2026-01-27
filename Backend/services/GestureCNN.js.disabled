const tf = require("@tensorflow/tfjs-node");
const GesturePreprocessor = require("./GesturePreprocessor");

class GestureCNN {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.userModels = new Map(); // Store personalized models per user
  }

  // Build the CNN architecture
  buildModel() {
    console.log("🧠 Building CNN model architecture...");

    const model = tf.sequential({
      layers: [
        // Input layer: 128 features (64 points × 2 coordinates)
        tf.layers.dense({
          inputShape: [128],
          units: 256,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.3 }),

        // Hidden layers
        tf.layers.dense({
          units: 128,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.2 }),

        tf.layers.dense({
          units: 64,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.2 }),

        // Output layer: Binary classification (authentic vs not)
        tf.layers.dense({
          units: 1,
          activation: "sigmoid",
        }),
      ],
    });

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    return model;
  }

  // Load or create model
  async initializeModel() {
    try {
      console.log("🔍 Attempting to load saved model...");
      this.model = await tf.loadLayersModel(
        "file://./models/gesture_cnn/model.json"
      );
      console.log("✅ Saved model loaded successfully");
    } catch (error) {
      console.log("📊 No saved model found, creating new model...");
      this.model = this.buildModel();
      console.log("✅ New CNN model created");
    }

    this.isModelLoaded = true;
    return this.model;
  }

  // Train model with user data
  async trainWithUserData(username, gestureData, isAuthentic = true) {
    if (!this.isModelLoaded) {
      await this.initializeModel();
    }

    try {
      console.log(`🎯 Training model for user: ${username}`);

      // Preprocess gesture data
      const processedGestures = gestureData.map((gesture) => {
        const normalized = GesturePreprocessor.normalizeGesture(gesture.points);
        return GesturePreprocessor.gestureToTensor(normalized);
      });

      // Create training data
      const xs = tf.tensor2d(processedGestures);
      const ys = tf.tensor2d(
        Array(processedGestures.length).fill([isAuthentic ? 1 : 0])
      );

      // Train for a few epochs
      const history = await this.model.fit(xs, ys, {
        epochs: 10,
        batchSize: Math.min(32, processedGestures.length),
        validationSplit: 0.2,
        verbose: 0,
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      console.log(`✅ Training completed for ${username}`);
      return {
        loss: history.history.loss[history.history.loss.length - 1],
        accuracy: history.history.acc[history.history.acc.length - 1],
      };
    } catch (error) {
      console.error("❌ Training error:", error);
      throw error;
    }
  }

  // Predict authenticity of a gesture
  async predict(username, gesturePoints) {
    if (!this.isModelLoaded) {
      await this.initializeModel();
    }

    try {
      // Preprocess the gesture
      const normalized = GesturePreprocessor.normalizeGesture(gesturePoints);
      const tensorInput = GesturePreprocessor.gestureToTensor(normalized);

      // Create tensor and predict
      const inputTensor = tf.tensor2d([tensorInput]);
      const prediction = this.model.predict(inputTensor);
      const confidence = await prediction.data();

      // Clean up
      inputTensor.dispose();
      prediction.dispose();

      const confidenceScore = confidence[0];
      const isAuthentic = confidenceScore > 0.5;

      console.log(
        `🎯 Prediction for ${username}: ${(confidenceScore * 100).toFixed(
          1
        )}% confidence`
      );

      return {
        confidence: confidenceScore,
        authentic: isAuthentic,
        method: "TensorFlow.js CNN",
        modelLoaded: true,
      };
    } catch (error) {
      console.error("❌ Prediction error:", error);
      // Fallback to mock prediction
      return {
        confidence: Math.random() * 0.3 + 0.4,
        authentic: false,
        method: "Fallback (Error)",
        error: error.message,
      };
    }
  }

  // Save the trained model
  async saveModel() {
    if (!this.model) return;

    try {
      await this.model.save("file://./models/gesture_cnn");
      console.log("✅ Model saved successfully");
    } catch (error) {
      console.error("❌ Failed to save model:", error);
    }
  }

  // Get model status
  getStatus() {
    return {
      modelLoaded: this.isModelLoaded,
      architecture: this.model ? "Dense Neural Network" : "Not loaded",
      framework: "TensorFlow.js",
      inputShape: [128],
      outputShape: [1],
    };
  }
}

module.exports = GestureCNN;
