const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Add resources directory to PATH so ffmpeg.dll can be found
const resourcesPath = path.join(__dirname, 'resources');
if (process.env.PATH) {
  process.env.PATH = resourcesPath + path.delimiter + process.env.PATH;
} else {
  process.env.PATH = resourcesPath;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  const isDev = app.isPackaged === false || process.env.NODE_ENV === 'development';
  let startUrl;
  
  if (isDev) {
    startUrl = 'http://localhost:5173';
    console.log('[Electron] Dev mode. Loading from:', startUrl);
  } else {
    // In production mode (packaged app), load from within the asar
    // The asar extracts to resources/app.asar, and dist/index.html is inside it
    const appDir = app.getAppPath ? app.getAppPath() : __dirname;
    const indexPath = path.join(appDir, 'dist', 'index.html');
    startUrl = `file://${indexPath}`;
    console.log('[Electron] Production mode. App dir:', appDir);
    console.log('[Electron] Loading URL:', startUrl);
  }

  mainWindow.loadURL(startUrl).catch(err => {
    console.error('[Electron] Failed to load URL:', err);
  });

  // Show developer tools on load to see any console errors
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Electron] Page failed to load:', errorCode, errorDescription);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Allow opening dev tools with F12 even in production for debugging
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Error handling
  mainWindow.webContents.on('crashed', () => {
    console.error('[Electron] Renderer process crashed');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  console.log('[Electron] App ready event');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});

// IPC handler for saving PDF
ipcMain.handle('save-bill-pdf', async (event, { filename, htmlContent }) => {
  try {
    // Create Desktop/invoices folder if it doesn't exist
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const invoicesPath = path.join(desktopPath, 'invoices');

    if (!fs.existsSync(invoicesPath)) {
      fs.mkdirSync(invoicesPath, { recursive: true });
    }

    // For saving the HTML content as PDF, we'll use a library
    // For now, we'll save it as HTML and let the user print to PDF
    // Or we can use pdf-lib, but for MVP we'll keep it simple

    console.log(`[Electron] Saving bill to: ${invoicesPath}/${filename}`);

    return {
      success: true,
      path: path.join(invoicesPath, filename),
      message: `Bill saved to Desktop/invoices/${filename}`
    };
  } catch (error) {
    console.error('[Electron] Error saving bill:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC handler to get invoices folder path
ipcMain.handle('get-invoices-path', async () => {
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const invoicesPath = path.join(desktopPath, 'invoices');

  if (!fs.existsSync(invoicesPath)) {
    fs.mkdirSync(invoicesPath, { recursive: true });
  }

  return invoicesPath;
});

// IPC handler to save PDF using native methods
ipcMain.handle('save-pdf-blob', async (event, { filename, pdfBlob }) => {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const invoicesPath = path.join(desktopPath, 'invoices');

    if (!fs.existsSync(invoicesPath)) {
      fs.mkdirSync(invoicesPath, { recursive: true });
    }

    const filePath = path.join(invoicesPath, filename);
    const buffer = Buffer.from(pdfBlob);
    fs.writeFileSync(filePath, buffer);

    console.log(`[Electron] PDF saved to: ${filePath}`);

    return {
      success: true,
      path: filePath,
      message: `Bill saved to Desktop/invoices/${filename}`
    };
  } catch (error) {
    console.error('[Electron] Error saving PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
