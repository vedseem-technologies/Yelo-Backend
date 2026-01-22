module.exports = function errorHandler(err, req, res, next) {
  console.error("Error:", err);

  // Don't interfere with CORS errors - let cors middleware handle them
  if (err.message && err.message.includes('CORS')) {
    return next(err);
  }

  // Default error
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

