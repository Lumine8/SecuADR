const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const path = require("path");

class CNNTrainingService {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.trainingProgress = {
      epoch: 0,
      loss: 0,
      accuracy: 0,
      status: "idle",
    };
  }

  // Create CNN model architecture
  createModel(numUsers, maxPoints = 100) {
    const model = tf.sequential({
      layers: [
        // Input layer - expecting [batch, 100, 2] (100 points with X,Y coordinates)
        tf.layers.reshape({
          inputShape: [maxPoints * 2],
          targetShape: [maxPoints, 2, 1],
        }),

        // First convolutional block
        tf.layers.conv2d({
          filters: 32,
          kernelSize: [3, 1],
          activation: "relu",
          padding: "same",
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({
          poolSize: [2, 1],
          strides: [2, 1],
        }),
        tf.layers.dropout({ rate: 0.25 }),

        // Second convolutional block
        tf.layers.conv2d({
          filters: 64,
          kernelSize: [3, 1],
          activation: "relu",
          padding: "same",
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({
          poolSize: [2, 1],
          strides: [2, 1],
        }),
        tf.layers.dropout({ rate: 0.25 }),

        // Dense layers
        tf.layers.flatten(),
        tf.layers.dense({
          units: 128,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: numUsers,
          activation: "softmax",
        }),
      ],
    });

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "sparseCategoricalCrossentropy",
      metrics: ["accuracy"],
    });

    return model;
  }

  // Preprocess gesture data
  preprocessGesture(gesturePoints, maxPoints = 100) {
    if (!gesturePoints || gesturePoints.length === 0) {
      return new Array(maxPoints * 2).fill(0);
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
    const result = new Array(maxPoints * 2);
    for (let i = 0; i < Math.min(points.length, maxPoints); i++) {
      result[i * 2] = points[i];
      result[i * 2 + 1] = points[i][16];
    }

    // Fill remaining with zeros
    for (let i = points.length * 2; i < maxPoints * 2; i++) {
      result[i] = 0;
    }

    return result;
  }

  // Prepare training data from MongoDB
  async prepareTrainingData() {
    try {
      const Pattern = require("../models/Pattern"); // Your pattern model
      const patterns = await Pattern.find({}).lean();

      if (patterns.length < 10) {
        throw new Error(
          `Need at least 10 patterns to train. Found: ${patterns.length}`
        );
      }

      console.log(`📊 Found ${patterns.length} patterns for training`);

      // Group by username and create labels
      const userMap = new Map();
      const X = [];
      const y = [];

      patterns.forEach((pattern, index) => {
        const username = pattern.username;

        if (!userMap.has(username)) {
          userMap.set(username, userMap.size);
        }

        const processedPattern = this.preprocessGesture(pattern.pattern);
        X.push(processedPattern);
        y.push(userMap.get(username));
      });

      console.log(`✅ Prepared data for ${userMap.size} users`);
      console.log(`   Users: ${Array.from(userMap.keys()).join(", ")}`);

      return {
        X: tf.tensor2d(X),
        y: tf.tensor1d(y, "int32"),
        userMap: userMap,
        numUsers: userMap.size,
      };
    } catch (error) {
      console.error("❌ Error preparing training data:", error);
      throw error;
    }
  }

  // Train the model
  async trainModel() {
    if (this.isTraining) {
      throw new Error("Training already in progress");
    }

    try {
      this.isTraining = true;
      this.trainingProgress.status = "preparing_data";

      console.log("🚀 Starting CNN training on server...");

      // Prepare data
      const { X, y, userMap, numUsers } = await this.prepareTrainingData();

      // Create model
      this.model = this.createModel(numUsers);

      console.log("🏗️ Model architecture:");
      this.model.summary();

      this.trainingProgress.status = "training";

      // Training configuration
      const epochs = 50;
      const batchSize = Math.min(16, Math.floor(X.shape / 4));

      // Train model with callbacks
      const history = await this.model.fit(X, y, {
        epochs: epochs,
        batchSize: batchSize,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            this.trainingProgress = {
              epoch: epoch + 1,
              loss: logs.loss,
              accuracy: logs.acc,
              valLoss: logs.val_loss,
              valAccuracy: logs.val_acc,
              status: "training",
            };
            console.log(
              `Epoch ${epoch + 1}/${epochs} - Loss: ${logs.loss.toFixed(
                4
              )}, Accuracy: ${logs.acc.toFixed(4)}`
            );
          },
        },
      });

      // Save model
      const modelsDir = path.join(__dirname, "../models");
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }

      const modelPath = `file://${modelsDir}/gesture_cnn_model`;
      await this.model.save(modelPath);

      // Save user mapping
      const userMapPath = path.join(modelsDir, "user_mapping.json");
      fs.writeFileSync(
        userMapPath,
        JSON.stringify(Object.fromEntries(userMap))
      );

      console.log(`✅ Model saved to: ${modelsDir}/gesture_cnn_model`);
      console.log(`✅ User mapping saved to: ${userMapPath}`);

      this.trainingProgress.status = "completed";

      // Cleanup tensors
      X.dispose();
      y.dispose();

      return {
        success: true,
        finalAccuracy:
          this.trainingProgress.valAccuracy || this.trainingProgress.accuracy,
        epochs: epochs,
        modelPath: modelPath,
      };
    } catch (error) {
      console.error("❌ Training failed:", error);
      this.trainingProgress.status = "failed";
      this.trainingProgress.error = error.message;
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  // Load trained model
  async loadTrainedModel() {
    try {
      const modelsDir = path.join(__dirname, "../models");
      const modelPath = `file://${modelsDir}/gesture_cnn_model`;

      if (fs.existsSync(path.join(modelsDir, "model.json"))) {
        this.model = await tf.loadLayersModel(modelPath);
        console.log("✅ Trained CNN model loaded successfully");
        return true;
      } else {
        console.log("⚠️ No trained model found");
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to load trained model:", error);
      return false;
    }
  }

  // Predict using trained model
  async predict(gestureData) {
    if (!this.model) {
      throw new Error("No trained model available");
    }

    try {
      const processedInput = this.preprocessGesture(gestureData);
      const inputTensor = tf.tensor2d([processedInput]);

      const prediction = this.model.predict(inputTensor);
      const probabilities = await prediction.data();

      const confidence = Math.max(...probabilities);
      const predictedClass = probabilities.indexOf(confidence);

      // Cleanup tensors
      inputTensor.dispose();
      prediction.dispose();

      return {
        success: true,
        confidence: confidence,
        predictedClass: predictedClass,
        authenticated: confidence > 0.8,
        method: "Server-side CNN Training",
        modelType: "production",
      };
    } catch (error) {
      console.error("❌ CNN prediction failed:", error);
      throw error;
    }
  }

  // Get training progress
  getTrainingProgress() {
    return this.trainingProgress;
  }

  // Check if model is trained and ready
  isModelReady() {
    return this.model !== null && this.trainingProgress.status === "completed";
  }
}

module.exports = CNNTrainingService;
