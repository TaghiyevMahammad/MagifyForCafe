import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "Magify",
    backgroundColor: '#0a0a0a',
    show: false
  });

  // In development, load from the dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // In production, load the built index.html
    // Since main.js is in dist/, index.html is in the same folder
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window close event
  mainWindow.on('close', (e) => {
    if (isQuitting) return;

    e.preventDefault();
    
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      buttons: ['Bəli', 'Xeyr'],
      defaultId: 1,
      title: 'Çıxış',
      message: 'Proqramdan çıxmaq istədiyinizə əminsiniz?',
      cancelId: 1
    });

    if (choice === 0) {
      isQuitting = true;
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Start the Express server
  if (process.env.NODE_ENV !== 'production') {
     // In dev, we assume the server is started via npm run dev
  } else {
    serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        USER_DATA_PATH: app.getPath('userData')
      }
    });
  }
  
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
