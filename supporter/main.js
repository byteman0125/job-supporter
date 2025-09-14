
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
    this.screenWidth = 0; // Store screen dimensions for cursor calculations
    this.screenHeight = 0;
    
    this.init();
  }

  init() {
    console.log('🚀 Supporter App starting...');
    app.whenReady().then(() => {
      console.log('✅ Supporter App ready');
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
    
    // Log initial window size
    console.log(`📏 INITIAL WINDOW SIZE: ${windowWidth}x${windowHeight}`);
    
    // Smart window management
    this.isProgrammaticResize = false;
    this.resizeTimeout = null;
    this.moveDebounceTimeout = null; // Added for move event debouncing
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
    // Smart aspect ratio resize handling with loop prevention
    this.mainWindow.on('resize', () => {
      if (!this.isProgrammaticResize && this.allowManualResize) {
        // No timeout - immediate response to mouse movement
        
        // Immediate aspect ratio adjustment - no delays
        const [currentWidth, currentHeight] = this.mainWindow.getSize();
        console.log(`📏 WINDOW RESIZED: ${currentWidth}x${currentHeight}`);
        
        // Calculate proper aspect ratio based on original screen resolution
        const aspectRatio = this.firstScreenResolution.width / this.firstScreenResolution.height;
        
        // Calculate what both dimensions should be
        const properHeightFromWidth = Math.round(currentWidth / aspectRatio);
        const properWidthFromHeight = Math.round(currentHeight * aspectRatio);
        
        // Detect resize direction more accurately
        const widthChange = Math.abs(currentWidth - this.initialWindowSize.width);
        const heightChange = Math.abs(currentHeight - this.initialWindowSize.height);
        
        let newWidth = currentWidth;
        let newHeight = currentHeight;
        
        // Only adjust aspect ratio when user stops dragging (larger changes)
        if (widthChange > 20) {
          // Width changed significantly - adjust height to maintain aspect ratio
          newHeight = properHeightFromWidth;
        } else if (heightChange > 20) {
          // Height changed significantly - adjust width to maintain aspect ratio
          newWidth = properWidthFromHeight;
        }
        
        // Immediately apply the calculated size to maintain aspect ratio
        if (newWidth !== currentWidth || newHeight !== currentHeight) {
          this.isProgrammaticResize = true;
          this.mainWindow.setSize(newWidth, newHeight);
          this.isProgrammaticResize = false;
          this.initialWindowSize = { width: newWidth, height: newHeight };
        } else {
          // No adjustment needed, just update stored size
          this.initialWindowSize = { width: currentWidth, height: currentHeight };
        }
      }
    });

    // Handle resize end to ensure constraints are properly set
    this.mainWindow.on('resized', () => {
      if (!this.isProgrammaticResize && this.allowManualResize) {
        // Resize is complete - ensure flexible constraints are maintained
        this.ensureFlexibleConstraints();
      }
    });

    // Simplified move protection with debouncing
    this.mainWindow.on('move', () => {
      // Debounce the size check to prevent visual artifacts
      if (this.moveDebounceTimeout) {
        clearTimeout(this.moveDebounceTimeout);
      }
      this.moveDebounceTimeout = setTimeout(() => {
        this.checkAndRestoreSize();
      }, 10); // Small delay to prevent rapid-fire calls
    });

    // Add will-resize event for real-time aspect ratio adjustment during drag
    this.mainWindow.on('will-resize', (event, newBounds) => {
      if (!this.isProgrammaticResize && this.allowManualResize) {
        this.adjustAspectRatioDuringResize(newBounds);
      }
    });


    // Handle window state changes
    this.mainWindow.on('maximize', () => {
      // Prevent maximizing
      this.mainWindow.unmaximize();
    });

    this.mainWindow.on('unmaximize', () => {
      // Ensure size is correct after unmaximize
      this.restoreWindowSize();
    });

  }

  restoreWindowSize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    // Instantly restore window size using remembered resolution
    this.isProgrammaticResize = true;
    this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
    this.isProgrammaticResize = false;
  }

  checkAndRestoreSize() {
    if (!this.isProgrammaticResize) {
      const [currentWidth, currentHeight] = this.mainWindow.getSize();
      if (currentWidth !== this.initialWindowSize.width || currentHeight !== this.initialWindowSize.height) {
        // Size changed during move - restore with minimal visual impact
        this.isProgrammaticResize = true;
        this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
        this.isProgrammaticResize = false;
      }
    }
  }

  forceWindowSizeRestore() {
    if (!this.isProgrammaticResize) {
      // Temporarily disable manual resize
      const wasManualResizeAllowed = this.allowManualResize;
      this.allowManualResize = false;
      
      // Force restore size immediately
      this.isProgrammaticResize = true;
      this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
      this.isProgrammaticResize = false;
      
      // Re-enable manual resize after a short delay
      setTimeout(() => {
        this.allowManualResize = wasManualResizeAllowed;
      }, 100);
    }
  }


  adjustAspectRatioDuringResize(newBounds) {
    const currentWidth = newBounds.width;
    const currentHeight = newBounds.height;
    
    // Calculate proper aspect ratio
    const aspectRatio = this.firstScreenResolution.width / this.firstScreenResolution.height;
    
    // Calculate what both dimensions should be
    const properHeightFromWidth = Math.round(currentWidth / aspectRatio);
    const properWidthFromHeight = Math.round(currentHeight * aspectRatio);
    
    // Detect which dimension changed more during drag
    const widthChange = Math.abs(currentWidth - this.initialWindowSize.width);
    const heightChange = Math.abs(currentHeight - this.initialWindowSize.height);
    
    let newWidth = currentWidth;
    let newHeight = currentHeight;
    
    if (widthChange > heightChange && widthChange > 2) {
      // User is dragging width - adjust height
      newHeight = properHeightFromWidth;
    } else if (heightChange > widthChange && heightChange > 2) {
      // User is dragging height - adjust width
      newWidth = properWidthFromHeight;
    }
    
    // Apply the calculated size if different
    if (newWidth !== currentWidth || newHeight !== currentHeight) {
      this.isProgrammaticResize = true;
      newBounds.width = newWidth;
      newBounds.height = newHeight;
      this.isProgrammaticResize = false;
    }
  }

  adjustAspectRatioImmediately() {
    const [currentWidth, currentHeight] = this.mainWindow.getSize();
    
    // Calculate proper aspect ratio
    const aspectRatio = this.firstScreenResolution.width / this.firstScreenResolution.height;
    
    // Calculate what both dimensions should be
    const properHeightFromWidth = Math.round(currentWidth / aspectRatio);
    const properWidthFromHeight = Math.round(currentHeight * aspectRatio);
    
    // Detect which dimension changed more during drag
    const widthChange = Math.abs(currentWidth - this.initialWindowSize.width);
    const heightChange = Math.abs(currentHeight - this.initialWindowSize.height);
    
    let newWidth = currentWidth;
    let newHeight = currentHeight;
    
    if (widthChange > heightChange && widthChange > 1) {
      // User is dragging width - adjust height
      newHeight = properHeightFromWidth;
    } else if (heightChange > widthChange && heightChange > 1) {
      // User is dragging height - adjust width
      newWidth = properWidthFromHeight;
    }
    
    // Apply the calculated size if different
    if (newWidth !== currentWidth || newHeight !== currentHeight) {
      this.isProgrammaticResize = true;
      this.mainWindow.setSize(newWidth, newHeight);
      this.isProgrammaticResize = false;
      this.initialWindowSize = { width: newWidth, height: newHeight };
    }
  }

  ensureFlexibleConstraints() {
    // Ensure window has flexible constraints for manual resizing
    this.mainWindow.setMinimumSize(400, 300);
    this.mainWindow.setMaximumSize(this.firstScreenResolution.width, this.firstScreenResolution.height);
  }

  calculateOptimalSize(targetWidth, targetHeight) {
    // Instantly calculate optimal size using remembered first screen resolution
    const { width: screenWidth, height: screenHeight } = this.firstScreenResolution;
    
    // Calculate optimal window size to fit the first screen while maintaining aspect ratio
    const aspectRatio = targetWidth / targetHeight;
    let windowWidth = Math.min(targetWidth, screenWidth - 100);
    let windowHeight = Math.round(windowWidth / aspectRatio);
    
    // If height is too big, scale down based on height
    if (windowHeight > screenHeight - 100) {
      windowHeight = screenHeight - 100;
      windowWidth = Math.round(windowHeight * aspectRatio);
    }
    
    return { width: windowWidth, height: windowHeight };
  }

  professionalResize(width, height) {
    // Clear any pending resize operations
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Set programmatic resize flag
    this.isProgrammaticResize = true;
    this.allowManualResize = false; // Temporarily disable manual resize

    // Instantly set the new size using remembered resolution
    this.mainWindow.setSize(width, height);

    // Instantly update stored size
    this.initialWindowSize = { width, height };

    // Instantly restore flexible constraints and re-enable manual resize
    this.ensureFlexibleConstraints();
    this.isProgrammaticResize = false;
    this.allowManualResize = true;
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
      console.log('🖱️ CURSOR: Ready to receive mouse position data');
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
      
      // Store screen dimensions for cursor calculations
      if (data.width && data.height) {
        this.screenWidth = data.width;
        this.screenHeight = data.height;
      }
      
      // Log screen data with mouse position to terminal
      if (data.mouseX !== null && data.mouseY !== null) {
        // Calculate current position and window size
        const windowWidth = this.mainWindow.getBounds().width;
        const windowHeight = this.mainWindow.getBounds().height;
        const currentX = (data.mouseX * windowWidth) / this.screenWidth;
        const currentY = (data.mouseY * windowHeight) / this.screenHeight;
        
        console.log(`🖱️ Origin: Pos(${data.mouseX},${data.mouseY}) Size(${this.screenWidth}x${this.screenHeight}) → Current: Pos(${currentX.toFixed(1)},${currentY.toFixed(1)}) Size(${windowWidth}x${windowHeight})`);
        console.log(`📏 WINDOW SIZE: ${windowWidth}x${windowHeight}`);
        
        // Calculate and show scale rate
        const scaleRateX = (windowWidth / this.screenWidth) * 100;
        const scaleRateY = (windowHeight / this.screenHeight) * 100;
        console.log(`📊 SCALE RATE: ${scaleRateX.toFixed(1)}% x ${scaleRateY.toFixed(1)}%`);
      }
      
      // Calculate cursor position for screen data
      let cursorData = null;
      if (data.mouseX !== null && data.mouseY !== null && this.screenWidth && this.screenHeight) {
        const windowWidth = this.mainWindow.getBounds().width;
        const windowHeight = this.mainWindow.getBounds().height;
        
        const scaledX = (data.mouseX * windowWidth) / this.screenWidth;
        const scaledY = (data.mouseY * windowHeight) / this.screenHeight;
        
        cursorData = {
          mouseX: data.mouseX,
          mouseY: data.mouseY,
          scaledX: scaledX,
          scaledY: scaledY,
          screenWidth: this.screenWidth,
          screenHeight: this.screenHeight,
          windowWidth: windowWidth,
          windowHeight: windowHeight,
          cursorVisible: data.cursorVisible || false
        };
      }

      // Send screen data to renderer with delta compression support
      this.mainWindow.webContents.send('screen-data', {
        image: data.image || data, // Handle both old and new format
        timestamp: data.timestamp || Date.now(),
        quality: data.quality || 'medium',
        isFullFrame: data.isFullFrame || true,
        regions: data.regions || null,
        cursor: cursorData,
        changedPixels: data.changedPixels || 0
      });
    });

    this.socket.on('highFreqMouse', (data) => {
      // Calculate scale rate and position for terminal display
      if (this.screenWidth && this.screenHeight) {
        const windowWidth = this.mainWindow.getBounds().width;
        const windowHeight = this.mainWindow.getBounds().height;
        
        // Calculate current position
        const currentX = (data.mouseX * windowWidth) / this.screenWidth;
        const currentY = (data.mouseY * windowHeight) / this.screenHeight;
        
        // Single log with all required info
        console.log(`🖱️ Origin: Pos(${data.mouseX},${data.mouseY}) Size(${this.screenWidth}x${this.screenHeight}) → Current: Pos(${currentX.toFixed(1)},${currentY.toFixed(1)}) Size(${windowWidth}x${windowHeight})`);
        console.log(`📏 WINDOW SIZE: ${windowWidth}x${windowHeight}`);
      }
      
      // Calculate final cursor position for renderer
      if (this.screenWidth && this.screenHeight) {
        const windowWidth = this.mainWindow.getBounds().width;
        const windowHeight = this.mainWindow.getBounds().height;
        
        // Calculate scaled position
        const scaledX = (data.mouseX * windowWidth) / this.screenWidth;
        const scaledY = (data.mouseY * windowHeight) / this.screenHeight;
        
        // Send calculated position to renderer
        this.mainWindow.webContents.send('high-freq-mouse', {
          mouseX: data.mouseX,
          mouseY: data.mouseY,
          scaledX: scaledX,
          scaledY: scaledY,
          screenWidth: this.screenWidth,
          screenHeight: this.screenHeight,
          windowWidth: windowWidth,
          windowHeight: windowHeight,
          cursorWidth: data.cursorWidth,
          cursorHeight: data.cursorHeight,
          timestamp: data.timestamp
        });
      }
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

    // Mouse cursor is now captured directly in screen images (cursor: true)

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
        // Instantly calculate optimal size using remembered resolution
        const optimalSize = this.calculateOptimalSize(width, height);
        
        // Instantly resize with calculated size
        this.professionalResize(optimalSize.width, optimalSize.height);
        
        // Don't center - let user position window wherever they want
      }
    });

    ipcMain.on('reset-window-size', () => {
      if (this.mainWindow) {
        // Instantly calculate optimal size using remembered resolution (default 1200x800)
        const optimalSize = this.calculateOptimalSize(1200, 800);
        
        // Instantly resize with calculated size
        this.professionalResize(optimalSize.width, optimalSize.height);
        
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
