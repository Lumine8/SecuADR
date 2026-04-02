import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Configuration object
const config = {
  // Server
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/secuadr",
    dbName: process.env.MONGODB_DBNAME || "secuadr",
  },

  // JWT & Security
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-key",
    expiresIn: process.env.JWT_EXPIRY || "7d",
  },

  // SFAM Service (Python)
  sfam: {
    serviceUrl: process.env.SFAM_SERVICE_URL || "http://localhost:8000",
    timeoutMs: parseInt(process.env.SFAM_TIMEOUT_MS || "30000", 10),
  },

  // Firebase (optional)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "demo-project",
    privateKey: process.env.FIREBASE_PRIVATE_KEY || "demo-key",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "demo@example.com",
  },

  // CORS
  cors: {
    origin: (
      process.env.CORS_ORIGIN || "http://localhost:3001,http://localhost:5173"
    ).split(","),
    credentials: true,
  },

  // Feature Flags
  features: {
    enableRlfsAnomaly: process.env.ENABLE_RLFS_ANOMALY_DETECTION === "true",
    enableSadrResponse: process.env.ENABLE_SADR_ADAPTIVE_RESPONSE === "true",
    enableProfileAutoUpdate: process.env.ENABLE_PROFILE_AUTO_UPDATE === "true",
  },

  // Thresholds
  thresholds: {
    sfamHashDistance: parseFloat(
      process.env.SFAM_HASH_DISTANCE_THRESHOLD || "0.15",
    ),
    rlfsBaseAnomaly: parseFloat(
      process.env.RLFS_BASE_ANOMALY_THRESHOLD || "0.40",
    ),
    rlfsHighConfidence: parseFloat(
      process.env.RLFS_HIGH_CONFIDENCE_THRESHOLD || "0.15",
    ),
    rlfsMedianConfidence: parseFloat(
      process.env.RLFS_MEDIUM_CONFIDENCE_THRESHOLD || "0.40",
    ),
    rlfsLowConfidence: parseFloat(
      process.env.RLFS_LOW_CONFIDENCE_THRESHOLD || "0.65",
    ),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "debug",
    format: process.env.LOG_FORMAT || "json",
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },
};

// Validation
if (!config.mongodb.uri) {
  console.warn("⚠️  MONGODB_URI not set, using default. Update .env file.");
}

if (config.nodeEnv === "production" && config.jwt.secret === "dev-secret-key") {
  throw new Error("❌ JWT_SECRET must be changed in production!");
}

export default config;
