/**
 * Analyzer module for processing SQL AST from node-sql-parser
 * Extracts database structure information and returns a clean summary
 */

/**
 * Analyzes SQL AST and extracts structured information
 * @param {Array|Object} ast - The AST from node-sql-parser
 * @returns {Object} Structured summary of the SQL database
 */
function analyzeSqlAst(ast) {
  const result = {
    databaseName: null,
    totalTables: 0,
    tables: []
  };

  // Ensure ast is an array for consistent processing
  const statements = Array.isArray(ast) ? ast : [ast];
  
  // Track tables to avoid duplicates and count inserts
  const tableMap = new Map();

  statements.forEach(statement => {
    if (!statement || typeof statement !== 'object') return;

    switch (statement.type) {
      case 'use':
        // Extract database name from USE statement - it's directly in statement.db
        if (statement.db) {
          result.databaseName = typeof statement.db === 'string' ? statement.db : statement.db.db || statement.db;
        }
        break;

      case 'create':
        // Handle CREATE TABLE statements
        if (statement.keyword === 'table' && statement.table) {
          const tableName = extractTableName(statement.table);
          if (tableName) {
            const tableInfo = {
              tableName: tableName,
              columns: extractColumns(statement.create_definitions),
              rowCount: 0
            };
            tableMap.set(tableName, tableInfo);
          }
        }
        break;

      case 'insert':
        // Handle INSERT statements to count rows
        if (statement.table) {
          const tableName = extractTableName(statement.table);
          if (tableName && tableMap.has(tableName)) {
            const tableInfo = tableMap.get(tableName);
            // Count the number of value sets being inserted
            if (statement.values && Array.isArray(statement.values)) {
              tableInfo.rowCount += statement.values.length;
            } else {
              tableInfo.rowCount += 1; // Single insert
            }
          }
        }
        break;
    }
  });

  // Convert map to array and update totals
  result.tables = Array.from(tableMap.values());
  result.totalTables = result.tables.length;

  return result;
}

/**
 * Extracts table name from various table reference formats
 * @param {Array|Object|String} tableRef - Table reference from AST
 * @returns {String|null} Table name
 */
function extractTableName(tableRef) {
  if (typeof tableRef === 'string') {
    return tableRef;
  }
  
  if (Array.isArray(tableRef) && tableRef.length > 0) {
    const firstTable = tableRef[0];
    if (typeof firstTable === 'string') {
      return firstTable;
    }
    if (firstTable && firstTable.table) {
      return typeof firstTable.table === 'string' ? firstTable.table : firstTable.table.table;
    }
  }
  
  if (tableRef && typeof tableRef === 'object') {
    if (typeof tableRef.table === 'string') {
      return tableRef.table;
    }
    if (tableRef.table && tableRef.table.table) {
      return tableRef.table.table;
    }
  }
  
  return null;
}

/**
 * Extracts column information from CREATE TABLE definitions
 * @param {Array} definitions - Column definitions from AST
 * @returns {Array} Array of column objects
 */
function extractColumns(definitions) {
  if (!Array.isArray(definitions)) {
    return [];
  }

  return definitions
    .filter(def => def && def.resource === 'column')
    .map(def => {
      const column = {
        columnName: extractColumnName(def),
        dataType: buildDataType(def.definition)
      };
      return column;
    });
}

/**
 * Extracts the actual column name string from various AST formats
 * @param {Object} def - Column definition object
 * @returns {String} Column name as string
 */
function extractColumnName(def) {
  // Try different possible paths for column name
  if (typeof def.column === 'string') {
    return def.column;
  }
  
  if (def.column && typeof def.column.column === 'string') {
    return def.column.column;
  }
  
  if (def.column && def.column.column && typeof def.column.column.column === 'string') {
    return def.column.column.column;
  }
  
  return 'unknown';
}

/**
 * Builds data type string from column definition
 * @param {Object} definition - Column definition object
 * @returns {String} Formatted data type string
 */
function buildDataType(definition) {
  if (!definition) {
    return 'unknown';
  }

  let dataType = 'unknown';
  let length = null;
  let scale = null;

  // Extract data type - try different possible paths
  if (typeof definition.dataType === 'string') {
    dataType = definition.dataType.toUpperCase();
  } else if (definition.dataType && typeof definition.dataType.dataType === 'string') {
    dataType = definition.dataType.dataType.toUpperCase();
  }

  // Extract length - try different possible paths
  if (definition.length !== undefined && definition.length !== null) {
    length = definition.length;
  } else if (definition.dataType && definition.dataType.length !== undefined && definition.dataType.length !== null) {
    length = definition.dataType.length;
  }

  // Extract scale - try different possible paths
  if (definition.scale !== undefined && definition.scale !== null) {
    scale = definition.scale;
  } else if (definition.dataType && definition.dataType.scale !== undefined && definition.dataType.scale !== null) {
    scale = definition.dataType.scale;
  }

  // Build the final data type string
  if (length !== null && length !== undefined) {
    if (scale !== null && scale !== undefined) {
      // For DECIMAL types with precision and scale
      dataType += `(${length},${scale})`;
    } else {
      // For types with just length
      dataType += `(${length})`;
    }
  }

  return dataType;
}

module.exports = {
  analyzeSqlAst
};
