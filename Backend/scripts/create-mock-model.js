// Proper TensorFlow.js imports for Node.js
const tf = require("@tensorflow/tfjs");
require("@tensorflow/tfjs-node"); // This enables filesystem handlers

const fs = require("fs");
const path = require("path");

async function createMockModel() {
  try {
    console.log("🤖 Creating mock CNN model for SecuADR...");

    // Create a simple mock CNN model for gesture recognition
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [128], units: 64, activation: "relu" }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    // Compile the model
    model.compile({
      optimizer: "adam",
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    // Ensure models directory exists
    const modelsDir = path.join(__dirname, "..", "models");
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
      console.log("📁 Created models directory");
    }

    // Save the model (use relative path from script location)
    const modelPath = path.join(modelsDir, "secuadr-cnn-model");
    await model.save(`file://${modelPath}`);

    console.log("✅ Mock CNN model created successfully at:", modelPath);
    console.log("📊 Model summary:");
    model.summary();
  } catch (error) {
    console.error("❌ Failed to create mock model:", error);
  }
}

// Run the function
createMockModel().then(() => {
  console.log("🎉 Model creation complete!");
  process.exit(0);
});
