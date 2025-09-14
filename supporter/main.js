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
    this.audioDevices = {
      input: null,
      output: null
    };
    this.isVoiceMuted = true; // Voice muted by default
    this.chatMessages = new Map(); // Store chat messages per client
    this.isAudioEnabled = false; // Audio disabled - no speaker module
    
    this.init();
  }

  init() {
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupAudio();
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
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1200,
      minHeight: 800,
      maxWidth: 1200,
      maxHeight: 800,
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
      resizable: false // Prevent resizing
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    // Register global shortcut for connection modal
    this.registerGlobalShortcuts();
    
    // this.mainWindow.webContents.openDevTools(); // Commented out for production
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

    this.socket.on('audioData', (data) => {
      // Play received audio data
      if (data.audio) {
        this.playAudioData(data.audio);
      }
    });
  }

  setupAudio() {
    // Audio playback disabled - no speaker module
  }

  playAudioData(audioData) {
    // Audio playback disabled - no speaker module
  }

  toggleAudio() {
    // Audio is permanently disabled - no speaker module
    return false;
  }

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
        // Temporarily enable resizing to change size
        this.mainWindow.setResizable(true);
        
        // Set the window size to match the tester's screen resolution
        this.mainWindow.setSize(width, height);
        
        // Disable resizing again to prevent further size changes
        this.mainWindow.setResizable(false);
        
        // Don't center - let user position window wherever they want
      }
    });

    ipcMain.on('reset-window-size', () => {
      if (this.mainWindow) {
        // Temporarily enable resizing to change size
        this.mainWindow.setResizable(true);
        
        // Reset to default size
        this.mainWindow.setSize(1200, 800);
        
        // Disable resizing again to prevent further size changes
        this.mainWindow.setResizable(false);
        
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

    ipcMain.handle('get-audio-devices', () => {
      // Return available audio devices
      return {
        input: [], // Will be populated with actual devices
        output: []
      };
    });

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

    ipcMain.handle('toggle-audio', (event) => {
      return this.toggleAudio();
    });

    ipcMain.handle('get-audio-status', (event) => {
      return this.isAudioEnabled;
    });

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
