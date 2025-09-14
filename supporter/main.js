
const { app, BrowserWindow, ipcMain, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const notifier = require('node-notifier');
const fs = require('fs');
// Audio playback disabled - speaker module removed

class SupporterApp {
  constructor() {
    this.mainWindow = null;
    this.server = null;
    this.io = null;
    this.connectedClients = new Map();
    this.isControlMode = false;
    this.screenData = null;
    this.chatMessages = new Map(); // Store chat messages per client
    this.isAudioEnabled = false; // Audio disabled
    
    this.init();
  }

  init() {
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupIpcHandlers();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  createMainWindow() {
    // Get screen dimensions to calculate optimal window size
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Calculate window size to fit screen while maintaining aspect ratio
    const aspectRatio = 1200 / 800; // 1.5
    let windowWidth = Math.min(1200, screenWidth - 100); // Leave some margin
    let windowHeight = Math.round(windowWidth / aspectRatio);
    
    // If height is too big, scale down based on height
    if (windowHeight > screenHeight - 100) {
      windowHeight = screenHeight - 100;
      windowWidth = Math.round(windowHeight * aspectRatio);
    }
    
    this.mainWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      minWidth: 400, // Allow smaller sizes
      minHeight: 300,
      maxWidth: screenWidth, // Allow up to full screen
      maxHeight: screenHeight,
      title: 'Remote Desktop Manager', // Disguise as Remote Desktop Manager
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false, // Disable for better performance
        enableRemoteModule: false // Disable deprecated remote module
      },
      icon: path.join(__dirname, 'assets/icon.png'),
      titleBarStyle: 'hidden', // Remove title bar and menubar
      frame: false, // Remove window frame
      fullscreenable: false,
      resizable: true, // Allow manual resizing
      maximizable: false, // Prevent maximizing
      minimizable: true, // Allow minimizing
      closable: true // Allow closing
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    // Store the initial window size and first screen resolution
    this.initialWindowSize = { width: windowWidth, height: windowHeight };
    this.firstScreenResolution = { width: screenWidth, height: screenHeight };
    
    // Smart window management
    this.isProgrammaticResize = false;
    this.resizeTimeout = null;
    this.allowManualResize = true; // Allow user to resize manually
    
    // Add window event handlers for smart management
    this.setupWindowEventHandlers();
    
    // Ensure flexible constraints are set initially
    this.ensureFlexibleConstraints();
    
    // Register global shortcut for connection modal
    this.registerGlobalShortcuts();
    
    // this.mainWindow.webContents.openDevTools(); // Commented out for production
  }

  setupWindowEventHandlers() {
    // Allow manual resizing but prevent unwanted changes
    this.mainWindow.on('resize', () => {
      if (!this.isProgrammaticResize && this.allowManualResize) {
        // User is manually resizing - allow it and update stored size
        const [currentWidth, currentHeight] = this.mainWindow.getSize();
        this.initialWindowSize = { width: currentWidth, height: currentHeight };
      }
    });

    // Prevent size changes when moving window (but allow manual resize)
    this.mainWindow.on('move', () => {
      if (!this.isProgrammaticResize && !this.allowManualResize) {
        // Check if size changed during move and restore if needed
        this.checkAndRestoreSize();
      }
    });

    // Handle window state changes
    this.mainWindow.on('maximize', () => {
      // Prevent maximizing
      this.mainWindow.unmaximize();
    });

    this.mainWindow.on('unmaximize', () => {
      // Ensure size is correct after unmaximize
      if (!this.allowManualResize) {
        this.restoreWindowSize();
      }
    });
  }

  restoreWindowSize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = setTimeout(() => {
      this.isProgrammaticResize = true;
      this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
      setTimeout(() => {
        this.isProgrammaticResize = false;
      }, 50);
    }, 10);
  }

  checkAndRestoreSize() {
    const [currentWidth, currentHeight] = this.mainWindow.getSize();
    if (currentWidth !== this.initialWindowSize.width || currentHeight !== this.initialWindowSize.height) {
      this.restoreWindowSize();
    }
  }

  ensureFlexibleConstraints() {
    // Ensure window has flexible constraints for manual resizing
    this.mainWindow.setMinimumSize(400, 300);
    this.mainWindow.setMaximumSize(this.firstScreenResolution.width, this.firstScreenResolution.height);
  }

  professionalResize(width, height) {
    // Clear any pending resize operations
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Set programmatic resize flag
    this.isProgrammaticResize = true;
    this.allowManualResize = false; // Temporarily disable manual resize

    // Set the new size
    this.mainWindow.setSize(width, height);

    // Update stored size
    this.initialWindowSize = { width, height };

    // Reset flags and restore flexible constraints after a short delay
    setTimeout(() => {
      this.isProgrammaticResize = false;
      this.allowManualResize = true; // Re-enable manual resize
      
      // Restore flexible constraints to allow manual resizing
      this.ensureFlexibleConstraints();
    }, 100);
  }

  registerGlobalShortcuts() {
    // Register Ctrl+Shift+H to show connection modal
    globalShortcut.register('Ctrl+Shift+H', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-connection-modal');
      }
    });
  }

  connectToTester(testerIP, port = 3000) {
    const io = require('socket.io-client');
    
    
    // Disconnect existing connection if any
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.socket = io(`http://${testerIP}:${port}`, {
      timeout: 20000,
      forceNew: true,
      transports: ['polling']
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to tester:', testerIP);
      console.log('Socket ID:', this.socket.id);
      this.isConnected = true;
      this.mainWindow.webContents.send('connection-status', { connected: true, testerIP });
      
      // Automatically start screen sharing when connected
      console.log('🖥️ Starting screen sharing...');
      this.socket.emit('start-screen-sharing');
    });

    this.socket.on('connecting', () => {
      console.log('🔄 Connecting to tester...');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      console.error('Error details:', error);
      this.isConnected = false;
      this.mainWindow.webContents.send('connection-status', { 
        connected: false, 
        error: error.message 
      });
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.isConnected = false;
      this.mainWindow.webContents.send('connection-status', { 
        connected: false, 
        error: 'Socket error: ' + error.message 
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from tester:', reason);
      this.isConnected = false;
      this.mainWindow.webContents.send('connection-status', { connected: false });
    });

    this.socket.on('screenData', (data) => {
      // Store last screen data for screenshot capture
      this.lastScreenData = data;
      
      // Send screen data to renderer with delta compression support
      this.mainWindow.webContents.send('screen-data', {
        image: data.image || data, // Handle both old and new format
        mouseX: data.mouseX || 0,
        mouseY: data.mouseY || 0,
        timestamp: data.timestamp || Date.now(),
        quality: data.quality || 'medium',
        isFullFrame: data.isFullFrame || true,
        regions: data.regions || null,
        changedPixels: data.changedPixels || 0
      });
    });

    this.socket.on('screenshot-data', (data) => {
      // Save the full-quality screenshot
      const imageDir = path.join(__dirname, 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(imageDir, filename);
      
      const buffer = Buffer.from(data, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      // Copy image to clipboard
      try {
        const { clipboard, nativeImage } = require('electron');
        const image = nativeImage.createFromBuffer(buffer);
        clipboard.writeImage(image);
      } catch (error) {
        console.error('❌ Failed to copy to clipboard:', error);
      }
      
      // Notify the renderer that screenshot was saved and copied to clipboard
      this.mainWindow.webContents.send('screenshot-saved', { 
        success: true, 
        filepath,
        clipboardSuccess: true
      });
    });

    this.socket.on('screen-resolution', (data) => {
      // Handle the locked screen resolution from tester
      console.log(`🔒 Received locked screen resolution: ${data.width}x${data.height}`);
      
      // Send the resolution to renderer to resize window
      if (this.mainWindow) {
        this.mainWindow.webContents.send('resize-window-to-screen', {
          width: data.width,
          height: data.height
        });
      }
    });

    this.socket.on('chatMessage', (message) => {
      // Store message locally
      if (!this.chatMessages.has('tester')) {
        this.chatMessages.set('tester', []);
      }
      
      this.chatMessages.get('tester').push({
        type: 'tester',
        message: message,
        timestamp: new Date()
      });
      
      // Send to renderer
      this.mainWindow.webContents.send('chat-message', {
        message: message,
        sender: 'tester'
      });
    });

    this.socket.on('captured-image', (data) => {
      // Save the captured image from tester
      const imageDir = path.join(__dirname, 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tester-captured-${timestamp}.png`;
      const filepath = path.join(imageDir, filename);
      
      const buffer = Buffer.from(data.imageData, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      // Copy image to clipboard
      try {
        const { clipboard, nativeImage } = require('electron');
        const image = nativeImage.createFromBuffer(buffer);
        clipboard.writeImage(image);
      } catch (error) {
        console.error('❌ Failed to copy tester captured image to clipboard:', error);
      }
      
      // Notify the renderer that tester captured image was received
      this.mainWindow.webContents.send('tester-image-received', { 
        success: true, 
        filepath,
        clipboardSuccess: true
      });
    });

    // Audio data handling removed
  }

  // Audio methods removed

  // IPC handlers
  setupIpcHandlers() {
    ipcMain.on('connect-to-tester', (event, { ip, port }) => {
      this.connectToTester(ip, port);
    });

    ipcMain.on('disconnect-from-tester', () => {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
        this.mainWindow.webContents.send('connection-status', { connected: false });
      }
    });

    ipcMain.on('show-connection-modal', () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-connection-modal');
      }
    });

    ipcMain.on('resize-window-to-screen', (event, { width, height }) => {
      if (this.mainWindow) {
        // Use the first screen resolution (remembered from startup)
        const { width: screenWidth, height: screenHeight } = this.firstScreenResolution;
        
        // Calculate optimal window size to fit the first screen while maintaining aspect ratio
        const aspectRatio = width / height;
        let windowWidth = Math.min(width, screenWidth - 100);
        let windowHeight = Math.round(windowWidth / aspectRatio);
        
        // If height is too big, scale down based on height
        if (windowHeight > screenHeight - 100) {
          windowHeight = screenHeight - 100;
          windowWidth = Math.round(windowHeight * aspectRatio);
        }
        
        // Professional resize with proper constraints
        this.professionalResize(windowWidth, windowHeight);
        
        // Don't center - let user position window wherever they want
      }
    });

    ipcMain.on('reset-window-size', () => {
      if (this.mainWindow) {
        // Use the first screen resolution (remembered from startup)
        const { width: screenWidth, height: screenHeight } = this.firstScreenResolution;
        
        // Calculate optimal window size to fit first screen while maintaining aspect ratio
        const aspectRatio = 1200 / 800; // 1.5
        let windowWidth = Math.min(1200, screenWidth - 100);
        let windowHeight = Math.round(windowWidth / aspectRatio);
        
        // If height is too big, scale down based on height
        if (windowHeight > screenHeight - 100) {
          windowHeight = screenHeight - 100;
          windowWidth = Math.round(windowHeight * aspectRatio);
        }
        
        // Professional resize with proper constraints
        this.professionalResize(windowWidth, windowHeight);
        
        // Don't center - maintain user's preferred position
      }
    });



    ipcMain.handle('send-data-to-tester', (event, data) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('receiveData', data);
        return true;
      }
      return false;
    });

    ipcMain.handle('capture-screenshot', (event) => {
      if (this.socket && this.isConnected) {
        // Request a fresh, full-quality screenshot from tester
        this.socket.emit('request-screenshot');
        return { success: true, message: 'Screenshot requested from tester' };
      }
      return { success: false, message: 'Not connected to tester' };
    });

    ipcMain.handle('set-control-mode', (event, mode) => {
      this.isControlMode = mode;
      return true;
    });

    // Audio devices removed

    ipcMain.handle('send-mouse-move', (event, { x, y }) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('mouseMove', { x, y });
        return true;
      }
      return false;
    });

    ipcMain.handle('send-mouse-click', (event, { x, y, button }) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('mouseClick', { x, y, button });
        return true;
      }
      return false;
    });

    ipcMain.handle('send-key-press', (event, { key, modifiers }) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('keyPress', { key, modifiers });
        return true;
      }
      return false;
    });

    ipcMain.handle('send-chat-message', (event, message) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('chatMessage', message);
        
        // Store message locally
        if (!this.chatMessages.has('tester')) {
          this.chatMessages.set('tester', []);
        }
        
        this.chatMessages.get('tester').push({
          type: 'supporter',
          message: message,
          timestamp: new Date()
        });
        
        return true;
      }
      return false;
    });

    ipcMain.handle('get-chat-messages', (event) => {
      return this.chatMessages.get('tester') || [];
    });

    ipcMain.handle('toggle-voice-mute', (event) => {
      this.isVoiceMuted = !this.isVoiceMuted;
      return this.isVoiceMuted;
    });

    // Audio toggle and status removed

    ipcMain.handle('start-screen-sharing', () => {
      if (this.socket && this.isConnected) {
        this.socket.emit('start-screen-sharing');
        return true;
      }
      return false;
    });

    ipcMain.handle('stop-screen-sharing', () => {
      if (this.socket && this.isConnected) {
        this.socket.emit('stop-screen-sharing');
        return true;
      }
      return false;
    });
  }
}

new SupporterApp();
