const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const notifier = require('node-notifier');
const fs = require('fs');

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
      width: 1000, // Reduced width
      height: 700, // Reduced height  
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false, // Disable for better performance
        enableRemoteModule: false // Disable deprecated remote module
      },
      icon: path.join(__dirname, 'assets/icon.png'),
      titleBarStyle: 'default' // Use native title bar for better performance
    });

    this.mainWindow.loadFile('renderer/index.html');
    // this.mainWindow.webContents.openDevTools(); // Commented out for production
  }

  connectToTester(testerIP, port = 8080) {
    const io = require('socket.io-client');
    
    console.log(`Attempting to connect to tester at ${testerIP}:${port}`);
    
    this.socket = io(`http://${testerIP}:${port}`, {
      timeout: 5000,
      forceNew: true
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to tester:', testerIP);
      this.isConnected = true;
      this.mainWindow.webContents.send('connection-status', { connected: true, testerIP });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      this.isConnected = false;
      this.mainWindow.webContents.send('connection-status', { 
        connected: false, 
        error: error.message 
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
      
      // Send screen data to renderer
      this.mainWindow.webContents.send('screen-data', {
        data: data
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
      
      // Notify the renderer that screenshot was saved
      this.mainWindow.webContents.send('screenshot-saved', { success: true, filepath });
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
  }

  setupAudio() {
    // Audio setup will be implemented with WebRTC or similar
    // For now, placeholder
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
  }
}

new SupporterApp();
