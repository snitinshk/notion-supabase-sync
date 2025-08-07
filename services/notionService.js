const { Client } = require('@notionhq/client');
const logger = require('../config/logger');
const RetryManager = require('../utils/retry');

/**
 * Notion API service for database operations
 */
class NotionService {
  constructor(token) {
    this.client = new Client({ auth: token });
    this.retryManager = new RetryManager();
  }

  /**
   * Fetch database schema
   * @param {string} databaseId - Notion database ID
   * @returns {Promise<Object>} - Database schema
   */
  async getDatabaseSchema(databaseId) {
    try {
      const response = await this.retryManager.executeWithRetry(async () => {
        return await this.client.databases.retrieve({ database_id: databaseId });
      });

      logger.info('Database schema retrieved', { databaseId });
      return response;
    } catch (error) {
      logger.error('Error fetching database schema', { 
        error: error.message, 
        databaseId 
      });
      throw error;
    }
  }

  /**
   * Fetch pages from database with incremental sync support
   * @param {string} databaseId - Notion database ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of pages
   */
  async getDatabasePages(databaseId, options = {}) {
    const {
      startCursor = undefined,
      pageSize = 100,
      filter = undefined,
      sorts = undefined,
      lastSyncTime = null
    } = options;

    try {
      // Build filter for incremental sync
      let finalFilter = filter;
      if (lastSyncTime) {
        // Use the correct filter format for last_edited_time
        const timeFilter = {
          timestamp: 'last_edited_time',
          last_edited_time: {
            after: lastSyncTime
          }
        };

        if (filter) {
          finalFilter = {
            and: [filter, timeFilter]
          };
        } else {
          finalFilter = timeFilter;
        }
      }

      const queryParams = {
        database_id: databaseId,
        page_size: pageSize,
        start_cursor: startCursor,
        filter: finalFilter,
        sorts: sorts
      };

      const response = await this.retryManager.executeWithRetry(async () => {
        return await this.client.databases.query(queryParams);
      });

      logger.info('Database pages fetched', {
        databaseId,
        pageCount: response.results.length,
        hasMore: response.has_more,
        nextCursor: response.next_cursor
      });

      return response;
    } catch (error) {
      logger.error('Error fetching database pages', {
        error: error.message,
        databaseId,
        options
      });
      throw error;
    }
  }

  /**
   * Fetch all pages from database with pagination
   * @param {string} databaseId - Notion database ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - All pages
   */
  async getAllDatabasePages(databaseId, options = {}) {
    const {
      pageSize = 100,
      filter = undefined,
      sorts = undefined,
      lastSyncTime = null
    } = options;

    const allPages = [];
    let hasMore = true;
    let startCursor = undefined;

    try {
      while (hasMore) {
        const response = await this.getDatabasePages(databaseId, {
          startCursor,
          pageSize,
          filter,
          sorts,
          lastSyncTime
        });

        allPages.push(...response.results);
        hasMore = response.has_more;
        startCursor = response.next_cursor;

        // Add small delay to respect rate limits
        if (hasMore) {
          await this.retryManager.sleep(100);
        }
      }

      logger.info('All database pages fetched', {
        databaseId,
        totalPages: allPages.length
      });

      return allPages;
    } catch (error) {
      logger.error('Error fetching all database pages', {
        error: error.message,
        databaseId,
        pagesFetched: allPages.length
      });
      throw error;
    }
  }

  /**
   * Get a specific page by ID
   * @param {string} pageId - Notion page ID
   * @returns {Promise<Object>} - Page data
   */
  async getPage(pageId) {
    try {
      const response = await this.retryManager.executeWithRetry(async () => {
        return await this.client.pages.retrieve({ page_id: pageId });
      });

      logger.info('Page retrieved', { pageId });
      return response;
    } catch (error) {
      logger.error('Error fetching page', {
        error: error.message,
        pageId
      });
      throw error;
    }
  }

  /**
   * Get multiple pages by IDs
   * @param {Array<string>} pageIds - Array of Notion page IDs
   * @returns {Promise<Array>} - Array of page data
   */
  async getPages(pageIds) {
    try {
      const operations = pageIds.map(pageId => 
        () => this.getPage(pageId)
      );

      const results = await this.retryManager.executeBatchWithRetry(operations);

      const successfulPages = results
        .filter(result => result.success)
        .map(result => result.data);

      logger.info('Multiple pages retrieved', {
        requested: pageIds.length,
        successful: successfulPages.length,
        failed: pageIds.length - successfulPages.length
      });

      return successfulPages;
    } catch (error) {
      logger.error('Error fetching multiple pages', {
        error: error.message,
        pageIds
      });
      throw error;
    }
  }

  /**
   * Search for pages in a database
   * @param {string} databaseId - Notion database ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchPages(databaseId, query, options = {}) {
    const {
      pageSize = 100,
      startCursor = undefined
    } = options;

    try {
      const response = await this.retryManager.executeWithRetry(async () => {
        return await this.client.search({
          query,
          filter: {
            property: 'object',
            value: 'page'
          },
          database_id: databaseId,
          page_size: pageSize,
          start_cursor: startCursor
        });
      });

      logger.info('Pages searched', {
        databaseId,
        query,
        resultCount: response.results.length
      });

      return response;
    } catch (error) {
      logger.error('Error searching pages', {
        error: error.message,
        databaseId,
        query
      });
      throw error;
    }
  }

  /**
   * Validate Notion token and permissions
   * @returns {Promise<boolean>} - Whether token is valid
   */
  async validateToken() {
    try {
      await this.retryManager.executeWithRetry(async () => {
        return await this.client.users.me();
      });

      logger.info('Notion token validated successfully');
      return true;
    } catch (error) {
      logger.error('Invalid Notion token', { error: error.message });
      return false;
    }
  }

  /**
   * Get rate limit information from response headers
   * @param {Object} response - API response
   * @returns {Object} - Rate limit info
   */
  getRateLimitInfo(response) {
    const headers = response?.headers || {};
    
    return {
      limit: headers['x-ratelimit-limit'],
      remaining: headers['x-ratelimit-remaining'],
      reset: headers['x-ratelimit-reset'],
      retryAfter: headers['retry-after']
    };
  }
}

module.exports = NotionService; 