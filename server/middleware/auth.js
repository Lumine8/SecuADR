const jwt = require('jsonwebtoken');

// Authentication middleware for securing routes
const auth = (req, res, next) => {
  try {
    // Extract token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // For development, allow without token
      // In production, uncomment the next line:
      // return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = auth;
