const logger = require('../config/logger');
const SchemaManager = require('./schemaManager');

/**
 * Transform Notion property values to Supabase-compatible format
 * @param {Object} notionProperty - The Notion property object
 * @returns {any} - Transformed value
 */
function transformNotionProperty(notionProperty) {
  if (!notionProperty) return null;

  try {
    const { type, ...propertyData } = notionProperty;

    switch (type) {
      case 'title':
        return extractTextContent(propertyData.title);
      
      case 'rich_text':
        return extractTextContent(propertyData.rich_text);
      
      case 'select':
        return propertyData.select?.name || null;
      
      case 'multi_select':
        return propertyData.multi_select?.map(item => item.name) || [];
      
      case 'date':
        return propertyData.date?.start || null;
      
      case 'checkbox':
        return propertyData.checkbox || false;
      
      case 'number':
        return propertyData.number || null;
      
      case 'url':
        return propertyData.url || null;
      
      case 'email':
        return propertyData.email || null;
      
      case 'phone_number':
        return propertyData.phone_number || null;
      
      case 'files':
        return transformFiles(propertyData.files);
      
      case 'people':
        return transformPeople(propertyData.people);
      
      case 'relation':
        return propertyData.relation?.map(rel => rel.id) || [];
      
      case 'formula':
        return transformFormula(propertyData.formula);
      
      case 'rollup':
        return transformRollup(propertyData.rollup);
      
      case 'created_time':
        return propertyData.created_time || null;
      
      case 'created_by':
        return propertyData.created_by?.id || null;
      
      case 'last_edited_time':
        return propertyData.last_edited_time || null;
      
      case 'last_edited_by':
        return propertyData.last_edited_by?.id || null;
      
      case 'status':
        return propertyData.status?.name || null;
      
      default:
        logger.warn(`Unknown Notion property type: ${type}`, { propertyData });
        return null;
    }
  } catch (error) {
    logger.error('Error transforming Notion property', { 
      error: error.message, 
      property: notionProperty 
    });
    return null;
  }
}

/**
 * Extract text content from Notion text arrays
 * @param {Array} textArray - Array of Notion text objects
 * @returns {string} - Concatenated text content
 */
function extractTextContent(textArray) {
  if (!Array.isArray(textArray)) return '';
  
  return textArray
    .map(textObj => textObj?.plain_text || '')
    .join('')
    .trim();
}

/**
 * Transform Notion files to URLs
 * @param {Array} files - Array of Notion file objects
 * @returns {Array} - Array of file URLs
 */
function transformFiles(files) {
  if (!Array.isArray(files)) return [];
  
  return files.map(file => {
    if (file.type === 'external') {
      return file.external?.url || null;
    } else if (file.type === 'file') {
      return file.file?.url || null;
    }
    return null;
  }).filter(Boolean);
}

/**
 * Transform Notion people to user IDs
 * @param {Array} people - Array of Notion user objects
 * @returns {Array} - Array of user IDs
 */
function transformPeople(people) {
  if (!Array.isArray(people)) return [];
  
  return people.map(person => person?.id || null).filter(Boolean);
}

/**
 * Transform Notion formula results
 * @param {Object} formula - Notion formula object
 * @returns {any} - Formula result
 */
function transformFormula(formula) {
  if (!formula) return null;
  
  const { type, ...formulaData } = formula;
  
  switch (type) {
    case 'string':
      return formulaData.string || '';
    case 'number':
      return formulaData.number || null;
    case 'boolean':
      return formulaData.boolean || false;
    case 'date':
      return formulaData.date?.start || null;
    default:
      return null;
  }
}

/**
 * Transform Notion rollup results
 * @param {Object} rollup - Notion rollup object
 * @returns {any} - Rollup result
 */
function transformRollup(rollup) {
  if (!rollup) return null;
  
  const { type, ...rollupData } = rollup;
  
  switch (type) {
    case 'array':
      return rollupData.array?.map(item => transformNotionProperty(item)) || [];
    case 'number':
      return rollupData.number || null;
    case 'date':
      return rollupData.date?.start || null;
    default:
      return null;
  }
}

/**
 * Clean and format data for Supabase insertion
 * @param {Object} notionPage - Raw Notion page data
 * @returns {Object} - Cleaned and formatted data
 */
function transformNotionPage(notionPage) {
  try {
    const { id, created_time, last_edited_time, properties, ...otherProps } = notionPage;
    
    // Transform all properties
    const transformedProperties = {};
    for (const [key, value] of Object.entries(properties)) {
      const transformedValue = transformNotionProperty(value);
      if (transformedValue !== null) {
        // Use SchemaManager for consistent property name conversion
        const cleanKey = SchemaManager.convertToSnakeCase(key);
        transformedProperties[cleanKey] = transformedValue;
      }
    }
    
    // Add metadata and filter out system fields that shouldn't be columns
    const systemFields = [
      'archived', 'icon', 'cover', 'parent', 'object', 'type',
      'created_by', 'last_edited_by', 'in_trash', 'url', 'public_url'
    ];
    const filteredOtherProps = Object.fromEntries(
      Object.entries(otherProps).filter(([key, value]) => 
        !systemFields.includes(key) && value !== null && value !== undefined
      )
    );
    
    const transformedData = {
      notion_id: id,
      created_at: created_time,
      updated_at: last_edited_time,
      last_edited_time: last_edited_time, // Add this explicitly
      ...transformedProperties,
      ...filteredOtherProps
    };
    
    // Remove null and undefined values
    const cleanedData = Object.fromEntries(
      Object.entries(transformedData).filter(([_, value]) => 
        value !== null && value !== undefined
      )
    );
    
    return cleanedData;
  } catch (error) {
    logger.error('Error transforming Notion page', { 
      error: error.message, 
      pageId: notionPage?.id 
    });
    throw error;
  }
}

/**
 * Validate transformed data before insertion
 * @param {Object} data - Transformed data
 * @returns {boolean} - Whether data is valid
 */
function validateTransformedData(data) {
  if (!data || typeof data !== 'object') {
    logger.error('Invalid data structure', { data });
    return false;
  }
  
  if (!data.notion_id) {
    logger.error('Missing required notion_id field', { data });
    return false;
  }
  
  return true;
}

module.exports = {
  transformNotionProperty,
  transformNotionPage,
  validateTransformedData,
  extractTextContent
}; 