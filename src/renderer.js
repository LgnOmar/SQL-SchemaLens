/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

console.log('👋 This message is being logged by "renderer.js", included via webpack');

// Global variable to store analysis data for PDF export
let currentAnalysis = null;

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', () => {
  const loadFileBtn = document.getElementById('loadFileBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const dbNameElement = document.getElementById('db-name');
  const totalTablesElement = document.getElementById('total-tables');
  const totalColumnsElement = document.getElementById('total-columns');
  const totalRecordsElement = document.getElementById('total-records');
  const schemaTree = document.getElementById('schema-tree');
  const tableInfo = document.getElementById('table-info');

  // Set up IPC listeners for receiving analysis data
  window.electronAPI.on('analysis-complete', (event, analysis) => {
    displayAnalysisResults(analysis);
  });

  window.electronAPI.on('analysis-error', (event, error) => {
    showError(error);
  });

  // Add click event listener to the Export PDF button
  exportPdfBtn.addEventListener('click', () => {
    if (currentAnalysis) {
      generatePdf(currentAnalysis);
    } else {
      showError('No analysis data available. Please load a SQL file first.');
    }
  });

  // Add click event listener to the Load SQL File button
  loadFileBtn.addEventListener('click', async () => {
    try {
      // Disable button and show loading state
      loadFileBtn.disabled = true;
      loadFileBtn.textContent = 'Loading...';

      // Call the main process to open file dialog and analyze SQL
      const result = await window.electronAPI.openFileDialog();

      if (result.success) {
        const analysis = result.analysis;
        
        // Use the new display function
        displayAnalysisResults(analysis);
        
        console.log('Analysis loaded successfully:', analysis);
      } else {
        console.error('Failed to load file:', result.message);
        showError(result.message);
      }
    } catch (error) {
      console.error('Error loading SQL file:', error);
      showError('Failed to load SQL file');
    } finally {
      // Re-enable button
      loadFileBtn.disabled = false;
      loadFileBtn.textContent = 'Load SQL File';
    }
  });

  function displayAnalysisResults(analysis) {
    // Store analysis data globally for PDF export
    currentAnalysis = analysis;
    
    // Clear any previous content
    clearPreviousContent();
    
    // Populate dashboard with statistics
    dbNameElement.textContent = analysis.databaseName || 'Unknown';
    totalTablesElement.textContent = analysis.totalTables;
    
    // Calculate and display total columns
    const totalColumns = analysis.tables.reduce((sum, table) => sum + table.columns.length, 0);
    totalColumnsElement.textContent = totalColumns;
    
    // Calculate and display total records
    const totalRecords = analysis.tables.reduce((sum, table) => sum + table.rowCount, 0);
    totalRecordsElement.textContent = totalRecords;
    
    // Dynamically create list items for each table
    analysis.tables.forEach(table => {
      const tableItem = document.createElement('li');
      tableItem.className = 'table-item';
      tableItem.textContent = `📊 ${table.tableName} (${table.rowCount} rows)`;
      
      // Add click event listener to show table details
      tableItem.addEventListener('click', () => displayTableDetails(table));
      
      schemaTree.appendChild(tableItem);
      
      // Add columns as sub-items
      table.columns.forEach(column => {
        const columnItem = document.createElement('li');
        columnItem.className = 'column-item';
        columnItem.textContent = `${column.columnName}: ${column.dataType}`;
        schemaTree.appendChild(columnItem);
      });
    });
  }

  function displayTableDetails(tableObject) {
    // Clear the table-details div
    tableInfo.innerHTML = '';
    
    // Display table name, column count, and row count
    const tableHeader = document.createElement('h3');
    tableHeader.textContent = tableObject.tableName;
    tableInfo.appendChild(tableHeader);
    
    const columnCount = document.createElement('p');
    columnCount.innerHTML = `<strong>Total Columns:</strong> ${tableObject.columns.length}`;
    tableInfo.appendChild(columnCount);
    
    const rowCount = document.createElement('p');
    rowCount.innerHTML = `<strong>Total Rows:</strong> ${tableObject.rowCount}`;
    tableInfo.appendChild(rowCount);
    
    // Create and display HTML table with columns
    const tableStructureDiv = document.createElement('div');
    tableStructureDiv.className = 'table-structure';
    
    const structureTitle = document.createElement('h4');
    structureTitle.textContent = 'Column Structure';
    tableStructureDiv.appendChild(structureTitle);
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Column Name</th>
          <th>Data Type</th>
        </tr>
      </thead>
      <tbody>
        ${tableObject.columns.map(column => `
          <tr>
            <td>${column.columnName}</td>
            <td>${column.dataType}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    tableStructureDiv.appendChild(table);
    tableInfo.appendChild(tableStructureDiv);
  }

  function clearPreviousContent() {
    // Clear dashboard (reset to default values)
    dbNameElement.textContent = '-';
    totalTablesElement.textContent = '0';
    totalColumnsElement.textContent = '0';
    totalRecordsElement.textContent = '0';
    
    // Clear schema tree
    schemaTree.innerHTML = '';
    
    // Clear table details
    tableInfo.innerHTML = '<p>Select a table from the schema to view details</p>';
  }

  function showError(message) {
    tableInfo.innerHTML = `<p style="color: #ff6b6b;">Error: ${message}</p>`;
  }

  function generatePdf(analysis) {
    try {
      // Create new jsPDF document
      const doc = new jsPDF();
      
      // Set document properties
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      let yPosition = margin;
      
      // Add main title
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      const databaseName = analysis.databaseName || 'Unknown Database';
      doc.text(`Database Analysis Report for: ${databaseName}`, margin, yPosition);
      yPosition += 20;
      
      // Add summary statistics
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Summary Statistics', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      
      const totalColumns = analysis.tables.reduce((sum, table) => sum + table.columns.length, 0);
      const totalRecords = analysis.tables.reduce((sum, table) => sum + table.rowCount, 0);
      
      doc.text(`Total Tables: ${analysis.totalTables}`, margin, yPosition);
      yPosition += 8;
      doc.text(`Total Columns: ${totalColumns}`, margin, yPosition);
      yPosition += 8;
      doc.text(`Total Records: ${totalRecords}`, margin, yPosition);
      yPosition += 20;
      
      // Add table details
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Table Details', margin, yPosition);
      yPosition += 15;
      
      // Iterate through each table and create a table for its columns
      analysis.tables.forEach((table, index) => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Add table name as title
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`${table.tableName} (${table.rowCount} rows)`, margin, yPosition);
        yPosition += 10;
        
        // Prepare data for autoTable
        const tableData = table.columns.map(column => [
          column.columnName,
          column.dataType
        ]);
        
        // Create table using autoTable - CORRECTED FUNCTION CALL
        autoTable(doc, {
          startY: yPosition,
          head: [['Column Name', 'Data Type']],
          body: tableData,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 10,
            cellPadding: 3
          },
          headStyles: {
            fillColor: [70, 130, 180],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          }
        });
        
        // Update yPosition to after the table
        yPosition = doc.lastAutoTable.finalY + 15;
      });
      
      // Save the PDF
      doc.save('sql-analysis-report.pdf');
      
      console.log('PDF generated successfully');
      
      // Show success message temporarily
      const originalContent = tableInfo.innerHTML;
      tableInfo.innerHTML = '<p style="color: #4CAF50;">✅ PDF report generated successfully!</p>';
      setTimeout(() => {
        tableInfo.innerHTML = originalContent;
      }, 3000);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate PDF report: ${error.message}`);
    }
  }
});
