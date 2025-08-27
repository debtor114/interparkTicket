const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 700,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
    title: '티케팅 자동화'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 개발 모드에서 개발자 도구 열기
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// GPU 하드웨어 가속 비활성화 (app.whenReady() 전에 호출해야 함)
app.disableHardwareAcceleration();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 핸들러들
ipcMain.handle('start-ticketing', async (event, config) => {
  try {
    // 티케팅 로직 실행
    return await startTicketingProcess(config);
  } catch (error) {
    console.error('티케팅 에러:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-dialog', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

async function startTicketingProcess(config) {
  // 실제 티케팅 로직은 여기에 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, message: '티케팅이 시작되었습니다!' });
    }, 1000);
  });
}