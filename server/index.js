require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const fallbackRoutes = require('./routes/fallback');
const fallbackAuthRoutes = require('./routes/fallback-auth');
const savePattern = require('./routes/save-pattern');
const getPattern = require('./routes/get-pattern');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Mount your route handlers
app.use('/api', savePattern);
app.use('/api', getPattern);
app.use('/api', fallbackRoutes);
app.use('/api', fallbackAuthRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
