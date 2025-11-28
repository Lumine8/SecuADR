const authenticateApiKey = (req, res, next) => {
  const apiKey = req.header("x-api-key");

  if (!apiKey || apiKey !== process.env.SECUADR_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key",
    });
  }

  next();
};

module.exports = { authenticateApiKey };
