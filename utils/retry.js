const logger = require('../config/logger');

/**
 * Retry utility with exponential backoff
 */
class RetryManager {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @returns {Promise<any>} - Function result
   */
  async executeWithRetry(fn, options = {}) {
    const {
      maxRetries = this.maxRetries,
      baseDelay = this.baseDelay,
      shouldRetry = this.defaultShouldRetry,
      onRetry = this.defaultOnRetry
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt, baseDelay);
        await onRetry(error, attempt, delay);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {number} - Delay in milliseconds
   */
  calculateDelay(attempt, baseDelay) {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Default retry condition
   * @param {Error} error - The error that occurred
   * @returns {boolean} - Whether to retry
   */
  defaultShouldRetry(error) {
    // Retry on network errors, rate limits, and server errors
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EAI_AGAIN'
    ];

    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

    // Check for network errors
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // Check for HTTP status codes
    if (error.status && retryableStatusCodes.includes(error.status)) {
      return true;
    }

    // Check for Notion API specific errors
    if (error.code === 'rate_limited' || error.code === 'service_unavailable') {
      return true;
    }

    // Check for Supabase specific errors
    if (error.message && error.message.includes('connection')) {
      return true;
    }

    return false;
  }

  /**
   * Default retry callback
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number
   * @param {number} delay - Delay before next attempt
   */
  defaultOnRetry(error, attempt, delay) {
    logger.warn('Retrying operation', {
      attempt: attempt + 1,
      maxRetries: this.maxRetries,
      delay,
      error: error.message,
      errorCode: error.code || error.status
    });
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch retry for multiple operations
   * @param {Array<Function>} operations - Array of functions to execute
   * @param {Object} options - Retry options
   * @returns {Promise<Array>} - Results array
   */
  async executeBatchWithRetry(operations, options = {}) {
    const results = [];
    const errors = [];

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await this.executeWithRetry(operations[i], options);
        results.push({ index: i, success: true, data: result });
      } catch (error) {
        errors.push({ index: i, success: false, error: error.message });
        results.push({ index: i, success: false, error: error.message });
      }
    }

    if (errors.length > 0) {
      logger.warn('Batch operation completed with errors', {
        total: operations.length,
        successful: results.filter(r => r.success).length,
        failed: errors.length,
        errors: errors.slice(0, 5) // Log first 5 errors
      });
    }

    return results;
  }
}

module.exports = RetryManager; 