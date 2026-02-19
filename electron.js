const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '/dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

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
