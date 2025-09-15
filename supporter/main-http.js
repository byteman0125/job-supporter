const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

class SupporterApp {
  constructor() {
    this.mainWindow = null;
    this.isConnected = false;
    this.currentTesterId = null;
    this.pollingInterval = null;
    this.heartbeatInterval = null;
    this.lastScreenData = null;
    this.screenWidth = 1920;
    this.screenHeight = 1080;
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      title: 'Code Supporter - Supporter'
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.setupIpcHandlers();
  }

  async connectToTester(testerId) {
    this.currentTesterId = testerId;
    
    // Stop any existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    try {
      // Register as supporter using HTTP
      const response = await fetch(`https://screen-relay-vercel.vercel.app/register-supporter?testerId=${testerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Connected to relay service');
        console.log('📋 Registered as supporter for tester:', testerId);
        
        if (data.testerOnline) {
          console.log('✅ Tester is online');
          this.isConnected = true;
          this.mainWindow.webContents.send('connection-status', { connected: true, testerId });
        } else {
          console.log('⏳ Waiting for tester to come online...');
          this.mainWindow.webContents.send('connection-status', { 
            connected: false, 
            message: `Waiting for tester ${testerId} to come online...` 
          });
        }
        
        // Start polling for screen data
        this.startScreenPolling();
        
        // Start heartbeat
        this.startHeartbeat();
        
      } else {
        throw new Error('Registration failed');
      }
      
    } catch (error) {
      console.error('❌ Connection error:', error.message);
      this.isConnected = false;
      this.mainWindow.webContents.send('connection-status', { connected: false, error: error.message });
    }
  }
  
  // Poll for screen data from tester
  startScreenPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`https://screen-relay-vercel.vercel.app/get-screen?testerId=${this.currentTesterId}`);
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.data) {
            const data = result.data;
            this.lastScreenData = data;
            
            if (data.width && data.height) {
              this.screenWidth = data.width;
              this.screenHeight = data.height;
            }
            
            // Calculate cursor position if mouse data is available
            let cursorData = null;
            if (data.mouseX !== null && data.mouseY !== null) {
              cursorData = {
                x: data.mouseX,
                y: data.mouseY,
                visible: data.cursorVisible !== false
              };
            }
            
            this.mainWindow.webContents.send('screen-data', {
              image: data.image || data,
              timestamp: data.timestamp || Date.now(),
              quality: data.quality || 'medium',
              isFullFrame: data.isFullFrame || true,
              regions: data.regions || null,
              cursor: cursorData,
              changedPixels: data.changedPixels || 0
            });
          }
          
          // Update connection status based on tester availability
          if (result.testerOnline && !this.isConnected) {
            console.log('✅ Tester came online');
            this.isConnected = true;
            this.mainWindow.webContents.send('connection-status', { connected: true, testerId: this.currentTesterId });
          } else if (!result.testerOnline && this.isConnected) {
            console.log('🔌 Tester went offline');
            this.isConnected = false;
            this.mainWindow.webContents.send('connection-status', { connected: false });
          }
        }
        
      } catch (error) {
        // Ignore polling errors to avoid flooding logs
      }
    }, 100); // Poll every 100ms for smooth video
  }
  
  // Send heartbeat to keep connection alive
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        await fetch(`https://screen-relay-vercel.vercel.app/heartbeat?testerId=${this.currentTesterId}&type=supporter`, {
          method: 'POST'
        });
      } catch (error) {
        // Ignore heartbeat errors
      }
    }, 15000); // Every 15 seconds
  }

  disconnectFromTester() {
    console.log('🔌 Disconnecting from tester...');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.isConnected = false;
    this.currentTesterId = null;
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('connection-status', { connected: false });
    }
  }

  setupIpcHandlers() {
    ipcMain.on('connect-to-tester', (event, { testerId }) => {
      this.connectToTester(testerId);
    });

    ipcMain.on('disconnect-from-tester', () => {
      this.disconnectFromTester();
    });

    ipcMain.on('show-connection-modal', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-connection-modal');
      }
    });

    ipcMain.on('capture-screenshot', async () => {
      if (this.lastScreenData && this.lastScreenData.image) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `screenshot-${timestamp}.png`;
          const filePath = path.join(__dirname, 'images', fileName);
          
          // Ensure images directory exists
          const imagesDir = path.join(__dirname, 'images');
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
          }
          
          // Convert base64 to buffer and save
          const base64Data = this.lastScreenData.image.replace(/^data:image\/[a-z]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
          
          console.log(`📸 Screenshot saved: ${fileName}`);
          
          // Show save dialog
          const result = await dialog.showSaveDialog(this.mainWindow, {
            defaultPath: fileName,
            filters: [
              { name: 'PNG Images', extensions: ['png'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });
          
          if (!result.canceled) {
            fs.copyFileSync(filePath, result.filePath);
            shell.showItemInFolder(result.filePath);
          }
        } catch (error) {
          console.error('❌ Screenshot failed:', error);
        }
      }
    });
  }

  init() {
    app.whenReady().then(() => {
      this.createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      this.disconnectFromTester();
    });
  }
}

const supporterApp = new SupporterApp();
supporterApp.init();
