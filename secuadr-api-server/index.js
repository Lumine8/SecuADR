const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const authenticateRoutes = require("./routes/authenticate");
const enrollSfamRoutes = require("./routes/enrollSfam");
const oidcRoutes = require("./routes/oidc"); // optional

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// Routes
app.use("/api/authenticate", authenticateRoutes);
app.use("/api/sfam/enroll", enrollSfamRoutes);
app.use("/api/oidc", oidcRoutes);

// Health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SecuADR Backend",
    sfam: "external",
    uptime: process.uptime(),
  });
});

// Start
app.listen(port, () => {
  console.log(`🚀 SecuADR API running on port ${port}`);
});
