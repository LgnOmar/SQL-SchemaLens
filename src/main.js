const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { Parser } = require('node-sql-parser');
const { analyzeSqlAst } = require('./analyzer');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // SQL parsing functionality
  try {
    // Read the SQL file from the project root directory
    // Note: In Electron Forge with Webpack, __dirname points to .webpack/main, 
    // so we need to go up two directories to reach the project root
    const sqlFilePath = path.join(__dirname, '..', '..', 'gmdb_basique.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Create a new SQL parser instance
    const parser = new Parser();

    // Parse the SQL content into an Abstract Syntax Tree (AST)
    const ast = parser.astify(sqlContent);

    // Analyze the AST and extract structured information
    const analysis = analyzeSqlAst(ast);

    // Log the clean, structured analysis instead of the raw AST
    console.log('SQL Database Analysis:', JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error('Error parsing SQL file:', error.message);
    console.error('Make sure the gmdb_basique.sql file exists in the project root directory');
    console.error('Expected path:', path.join(__dirname, '..', '..', 'gmdb_basique.sql'));
  }

  // IPC handler for opening file dialog
  ipcMain.handle('open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        
        // Read the selected SQL file
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        // Create a new SQL parser instance
        const parser = new Parser();
        
        // Parse the SQL content into an Abstract Syntax Tree (AST)
        const ast = parser.astify(sqlContent);
        
        // Analyze the AST and extract structured information
        const analysis = analyzeSqlAst(ast);
        
        // Log the analysis for debugging
        console.log('SQL Database Analysis:', JSON.stringify(analysis, null, 2));
        
        return { success: true, analysis };
      } else {
        return { success: false, message: 'No file selected' };
      }
    } catch (error) {
      console.error('Error processing SQL file:', error.message);
      return { success: false, message: error.message };
    }
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.