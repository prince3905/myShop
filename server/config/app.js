/**
 * Centralized application configuration
 * All environment variables and constants should be accessed through this module
 */

// ========================================
// JWT CONFIGURATION
// ========================================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is not set");
  process.exit(1);
}

// Warn if JWT_SECRET is too weak (less than 32 characters)
if (JWT_SECRET.length < 32) {
  console.warn("WARNING: JWT_SECRET is less than 32 characters. Consider using a stronger secret key.");
}

// ========================================
// SESSION CONFIGURATION
// ========================================
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes idle timeout
const MAX_SESSIONS_PER_USER = 20;

// ========================================
// RATE LIMITING CONFIGURATION
// ========================================
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_RATE_LIMIT_MAX_REQUESTS = 20;

// ========================================
// PRICING CONFIGURATION
// ========================================
const MAX_STAFF_DISCOUNT_PERCENT = 10; // Max discount staff/manager can apply

// ========================================
// PAGINATION CONFIGURATION
// ========================================
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

// ========================================
// EXPORTS
// ========================================
module.exports = {
  // JWT
  JWT_SECRET,
  JWT_EXPIRES_IN,

  // Session
  SESSION_TTL,
  MAX_SESSIONS_PER_USER,

  // Rate Limiting
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX_REQUESTS,

  // Pricing
  MAX_STAFF_DISCOUNT_PERCENT,

  // Pagination
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
};
