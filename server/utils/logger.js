const winston = require("winston");
const path = require("path");

// Log format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Log format for development (colored console)
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Determine environment
const isProduction = process.env.NODE_ENV === "production";

// Create logger instance
const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: isProduction ? productionFormat : developmentFormat,
  defaultMeta: {
    service: "myshop-api",
    environment: process.env.NODE_ENV || "development"
  },
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: isProduction ? productionFormat : developmentFormat
    }),
    // File transport for errors (always enabled)
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs (development only)
    ...(isProduction ? [] : [
      new winston.transports.File({
        filename: path.join(__dirname, "../logs/combined.log"),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    ])
  ],
});

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });
  next();
};

// Export logger for use in controllers/services
module.exports = logger;
