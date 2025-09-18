
const { app, BrowserWindow, ipcMain, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const notifier = require('node-notifier');
const fs = require('fs');
// Audio playback disabled - speaker module removed

class ViewerApp {
  constructor() {
    this.mainWindow = null;
    this.server = null;
    this.io = null;
    this.connectedClients = new Map();
    this.isControlMode = false;
    this.socket = null;          // Main connection
    this.mouseSocket = null;     // High-speed mouse control connection  
    this.isConnected = false;
    this.isMouseConnected = false;
    this.screenData = null;
    this.chatMessages = new Map(); // Store chat messages per client
    this.isAudioEnabled = false; // Audio disabled
    this.screenWidth = 0; // Store screen dimensions for cursor calculations
    this.screenHeight = 0;
    
    this.init();
  }

  init() {
    console.log('🚀 Viewer App starting...');
    app.whenReady().then(() => {
      console.log('✅ Viewer App ready');
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
      fullscreenable: false, // Disable fullscreen
      resizable: true, // Allow manual resizing
      maximizable: false, // Prevent maximizing
      minimizable: true, // Allow minimizing
      closable: true, // Allow closing
      skipTaskbar: false, // Show in taskbar
      alwaysOnTop: false // Not always on top
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    // Store the initial window size and first screen resolution
    this.initialWindowSize = { width: windowWidth, height: windowHeight };
    this.firstScreenResolution = { width: screenWidth, height: screenHeight };
    
    // Log initial window size
    
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
    // Prevent infinite resize loops
    this.resizeInProgress = false;
    this.lastResizeTime = 0;
    
    // Smart aspect ratio resize handling with loop prevention
    this.mainWindow.on('resize', () => {
      // Prevent recursive calls and rapid fire events
      if (this.isProgrammaticResize || this.resizeInProgress || !this.allowManualResize) {
        return;
      }
      
      const now = Date.now();
      if (now - this.lastResizeTime < 50) {
        return; // Debounce rapid resize events
      }
      this.lastResizeTime = now;
      
      this.resizeInProgress = true;
      
      try {
        const [currentWidth, currentHeight] = this.mainWindow.getSize();
        console.log(`📏 WINDOW RESIZED: ${currentWidth}x${currentHeight}`);
        
        // Validate window size is reasonable
        if (currentWidth < 100 || currentHeight < 100 || currentWidth > 5000 || currentHeight > 5000) {
          console.warn('⚠️ Invalid window size detected, skipping resize');
          this.resizeInProgress = false;
          return;
        }
        
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
        
        // Validate new dimensions
        if (newWidth < 100 || newHeight < 100 || newWidth > 5000 || newHeight > 5000) {
          console.warn('⚠️ Invalid calculated size, using current size');
          newWidth = currentWidth;
          newHeight = currentHeight;
        }
        
        // Apply the calculated size to maintain aspect ratio
        if (Math.abs(newWidth - currentWidth) > 2 || Math.abs(newHeight - currentHeight) > 2) {
          this.isProgrammaticResize = true;
          setTimeout(() => {
            try {
              this.mainWindow.setSize(newWidth, newHeight);
              this.initialWindowSize = { width: newWidth, height: newHeight };
            } catch (error) {
              console.error('❌ Error setting window size:', error);
            }
            this.isProgrammaticResize = false;
          }, 10);
        } else {
          // No adjustment needed, just update stored size
          this.initialWindowSize = { width: currentWidth, height: currentHeight };
        }
      } catch (error) {
        console.error('❌ Error in resize handler:', error);
      }
      
      this.resizeInProgress = false;
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
      // Skip if already processing resize
      if (this.isProgrammaticResize || this.resizeInProgress) {
        return;
      }
      
      // Debounce the size check to prevent visual artifacts
      if (this.moveDebounceTimeout) {
        clearTimeout(this.moveDebounceTimeout);
      }
      this.moveDebounceTimeout = setTimeout(() => {
        if (!this.isProgrammaticResize && !this.resizeInProgress) {
          this.checkAndRestoreSize();
        }
      }, 50); // Longer delay to prevent rapid-fire calls
    });

    // Add will-resize event for real-time aspect ratio adjustment during drag
    this.mainWindow.on('will-resize', (event, newBounds) => {
      if (!this.isProgrammaticResize && !this.resizeInProgress && this.allowManualResize) {
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

    // Prevent fullscreen mode
    this.mainWindow.on('enter-full-screen', () => {
      console.log('🚫 Preventing fullscreen mode');
      this.mainWindow.setFullScreen(false);
    });

    // Disable F11 and other fullscreen shortcuts, plus control mode input blocking
    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      // In control mode - capture and send ALL keys to server except Ctrl+Alt (exit control mode)
      if (this.isControlMode) {
        // Allow only Ctrl+Alt to exit control mode locally
        if (input.control && input.alt && !input.meta && !input.shift) {
          return; // Allow this combination to pass through for exiting control mode
        }
        
        // Capture and send ALL other keys to the remote server
        event.preventDefault();
        
        // Send to renderer which will forward to server
        this.mainWindow.webContents.send('capture-system-key', {
          key: input.key,
          type: input.type, // 'keyDown' or 'keyUp'
          modifiers: {
            ctrl: input.control,
            alt: input.alt,
            meta: input.meta,
            shift: input.shift
          }
        });
        
        console.log('🎮 System key captured and sent to server:', input.key, 'type:', input.type);
        return;
      }
      
      // Normal mode - only block problematic keys
      // Block F11 key (fullscreen toggle)
      if (input.key === 'F11') {
        event.preventDefault();
        console.log('🚫 F11 key blocked to prevent fullscreen');
      }
      // Block Alt+Enter (fullscreen shortcut)
      if (input.alt && input.key === 'Enter') {
        event.preventDefault();
        console.log('🚫 Alt+Enter blocked to prevent fullscreen');
      }
    });

  }

  restoreWindowSize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    if (this.resizeInProgress || this.isProgrammaticResize) {
      return; // Prevent recursive calls
    }
    
    // Instantly restore window size using remembered resolution
    this.isProgrammaticResize = true;
    this.resizeInProgress = true;
    
    try {
      this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
    } catch (error) {
      console.error('❌ Error restoring window size:', error);
    }
    
    this.isProgrammaticResize = false;
    this.resizeInProgress = false;
  }

  checkAndRestoreSize() {
    if (this.isProgrammaticResize || this.resizeInProgress) {
      return; // Prevent recursive calls
    }
    
    try {
      const [currentWidth, currentHeight] = this.mainWindow.getSize();
      if (currentWidth !== this.initialWindowSize.width || currentHeight !== this.initialWindowSize.height) {
        // Size changed during move - restore with minimal visual impact
        this.isProgrammaticResize = true;
        this.resizeInProgress = true;
        
        this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
        
        this.isProgrammaticResize = false;
        this.resizeInProgress = false;
      }
    } catch (error) {
      console.error('❌ Error checking and restoring size:', error);
      this.isProgrammaticResize = false;
      this.resizeInProgress = false;
    }
  }

  forceWindowSizeRestore() {
    if (this.isProgrammaticResize || this.resizeInProgress) {
      return; // Prevent recursive calls
    }
    
    // Temporarily disable manual resize
    const wasManualResizeAllowed = this.allowManualResize;
    this.allowManualResize = false;
    
    // Force restore size immediately
    this.isProgrammaticResize = true;
    this.resizeInProgress = true;
    
    try {
      this.mainWindow.setSize(this.initialWindowSize.width, this.initialWindowSize.height);
    } catch (error) {
      console.error('❌ Error in force window size restore:', error);
    }
    
    this.isProgrammaticResize = false;
    this.resizeInProgress = false;
    
    // Re-enable manual resize after a short delay
    setTimeout(() => {
      this.allowManualResize = wasManualResizeAllowed;
    }, 100);
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
    if (this.isProgrammaticResize || this.resizeInProgress) {
      return; // Prevent recursive calls
    }
    
    // Clear any pending resize operations
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Set programmatic resize flag
    this.isProgrammaticResize = true;
    this.resizeInProgress = true;
    this.allowManualResize = false; // Temporarily disable manual resize

    try {
      // Instantly set the new size using remembered resolution
      this.mainWindow.setSize(width, height);

      // Instantly update stored size
      this.initialWindowSize = { width, height };

      // Instantly restore flexible constraints
      this.ensureFlexibleConstraints();
    } catch (error) {
      console.error('❌ Error in professional resize:', error);
    }
    
    this.isProgrammaticResize = false;
    this.resizeInProgress = false;
    this.allowManualResize = true;
  }

  registerGlobalShortcuts() {
    // Register Ctrl+Shift+H to show connection modal
    globalShortcut.register('Ctrl+Shift+H', () => {
      if (this.mainWindow && !this.isControlMode) { // Don't allow in control mode
        this.mainWindow.webContents.send('show-connection-modal');
      }
    });
  }

  // Block system-level shortcuts in control mode
  enableControlModeSystemBlocking() {
    console.log('🔒 Enabling system-level input blocking for control mode');
    
    // Disable all global shortcuts temporarily
    globalShortcut.unregisterAll();
    
    // Set window to always be on top to capture input
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    
    // Disable window movement and resizing
    this.mainWindow.setMovable(false);
    this.mainWindow.setResizable(false);
    
    // Focus the window to ensure it receives all input
    this.mainWindow.focus();
    this.mainWindow.show();
    
    console.log('🔒 Window movement and resizing disabled for control mode');
  }

  // Re-enable system shortcuts when exiting control mode
  disableControlModeSystemBlocking() {
    console.log('🔓 Disabling system-level input blocking - returning to normal mode');
    
    // Re-register normal global shortcuts
    this.registerGlobalShortcuts();
    
    // Remove always on top
    this.mainWindow.setAlwaysOnTop(false);
    
    // Re-enable window movement and resizing
    this.mainWindow.setMovable(true);
    this.mainWindow.setResizable(true);
    
    console.log('🔓 Window movement and resizing re-enabled');
  }

  connectToServer(serverId, port = 3000) {
    const io = require('socket.io-client');
    
    // Disconnect existing connections if any
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.mouseSocket) {
      this.mouseSocket.disconnect();
      this.mouseSocket = null;
    }
    
    this.isConnected = false;
    this.isMouseConnected = false;
    
    // Connect to Railway relay service optimized for high-quality frames
    this.socket = io('https://screen-relay-vercel-production.up.railway.app', {
      timeout: 20000,             // Longer timeout for large frames
      forceNew: true,
      transports: ['websocket'],  // WebSocket only for best performance
      upgrade: true,              // Allow transport upgrades
      rememberUpgrade: true,      // Remember successful upgrades
      compress: true,             // Enable compression for large high-quality frames
      perMessageDeflate: true,    // Enable compression to handle 1080p data
      maxHttpBufferSize: 1e8      // 100MB buffer for high-quality frames
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to Railway relay service');
      console.log('Socket ID:', this.socket.id);
      
      // Register as viewer for specific server
      this.socket.emit('register-viewer', serverId);
    });
    
    this.socket.on('registered', (data) => {
      if (data.type === 'viewer') {
        console.log('📋 Registered as viewer for server:', data.serverId);
        console.log('⏳ Waiting for server to connect...');
      }
    });
    
    this.socket.on('server-connected', (data) => {
      console.log('✅ Server connected:', data.serverId);
      console.log('🖱️ CURSOR: Ready to receive mouse position data');
      
      this.isConnected = true;
      this.mainWindow.webContents.send('connection-status', { connected: true, serverId });
      
      console.log('🖥️ Starting screen sharing...');
      this.socket.emit('start-screen-sharing');
      
      // High-speed mouse control port (temporarily disabled due to timeouts)
      // this.connectToMouseControl(serverId);
      console.log('🖱️ High-speed mouse connection disabled - using fallback mode');
    });
    
    this.socket.on('waiting-for-server', (data) => {
      console.log('⏳ Waiting for server:', data.serverId);
      this.mainWindow.webContents.send('connection-status', { 
        connected: false, 
        message: `Waiting for server ${data.serverId} to come online...` 
      });
    });

    this.socket.on('connecting', () => {
      console.log('🔄 Connecting to server...');
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
      console.log('🔌 Disconnected from server:', reason);
      this.isConnected = false;
      this.mainWindow.webContents.send('connection-status', { connected: false });
    });

    // Handle H.264 video data (new format)
    this.socket.on('videoData', (data) => {
      // Forward H.264 video data to renderer
      this.mainWindow.webContents.send('video-data', {
        data: data.data,
        format: data.format,
        width: data.width,
        height: data.height,
        timestamp: data.timestamp,
        bitrate: data.bitrate
      });
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
        
        
        // Calculate and show scale rate
        const scaleRateX = (windowWidth / this.screenWidth) * 100;
        const scaleRateY = (windowHeight / this.screenHeight) * 100;
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
      // Handle the locked screen resolution from server
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
      if (!this.chatMessages.has('server')) {
        this.chatMessages.set('server', []);
      }
      
      this.chatMessages.get('server').push({
        type: 'server',
        message: message,
        timestamp: new Date()
      });
      
      // Send to renderer
      this.mainWindow.webContents.send('chat-message', {
        message: message,
        sender: 'server'
      });
    });

    this.socket.on('captured-image', (data) => {
      // Save the captured image from server
      const imageDir = path.join(__dirname, 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `server-captured-${timestamp}.png`;
      const filepath = path.join(imageDir, filename);
      
      const buffer = Buffer.from(data.imageData, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      // Copy image to clipboard
      try {
        const { clipboard, nativeImage } = require('electron');
        const image = nativeImage.createFromBuffer(buffer);
        clipboard.writeImage(image);
      } catch (error) {
        console.error('❌ Failed to copy server captured image to clipboard:', error);
      }
      
      // Notify the renderer that server captured image was received
      this.mainWindow.webContents.send('server-image-received', { 
        success: true, 
        filepath,
        clipboardSuccess: true
      });
    });

    // Audio data handling removed
  }

  // Connect to high-speed mouse control port
  connectToMouseControl(serverId) {
    const io = require('socket.io-client');
    
    console.log('🖱️⚡ Connecting to high-speed mouse control port...');
    
    // Connect to high-speed mouse control port (3001)
    this.mouseSocket = io('https://screen-relay-vercel-production.up.railway.app:3001', {
      timeout: 5000,               // Short timeout for responsiveness
      forceNew: true,
      transports: ['websocket'],   // WebSocket only for speed
      upgrade: false,              // No transport upgrades
      rememberUpgrade: false,
      compress: false,             // No compression for speed
      perMessageDeflate: false,
      maxHttpBufferSize: 1e4       // Small buffer for mouse data only
    });
    
    this.mouseSocket.on('connect', () => {
      console.log('🖱️⚡ Connected to high-speed mouse control port');
      console.log('🖱️ Mouse Socket ID:', this.mouseSocket.id);
      
      // Register as mouse viewer
      this.mouseSocket.emit('register-mouse-viewer', serverId);
    });
    
    this.mouseSocket.on('mouse-registered', (data) => {
      if (data.type === 'mouse-viewer') {
        console.log('🖱️✅ Registered as mouse viewer for server:', data.serverId);
        this.isMouseConnected = true;
      }
    });
    
    this.mouseSocket.on('mouse-server-connected', (data) => {
      console.log('🖱️✅ Mouse server connected:', data.serverId);
      this.isMouseConnected = true;
    });
    
    this.mouseSocket.on('connect_error', (error) => {
      console.error('🖱️❌ Mouse control connection error:', error.message);
      this.isMouseConnected = false;
    });
    
    this.mouseSocket.on('disconnect', (reason) => {
      console.log('🖱️🔌 Disconnected from mouse control:', reason);
      this.isMouseConnected = false;
    });
  }

  // Audio methods removed

  // IPC handlers
  setupIpcHandlers() {
    ipcMain.on('connect-to-server', (event, { serverId }) => {
      this.connectToServer(serverId);
    });

    ipcMain.on('disconnect-from-server', () => {
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
        // Disabled automatic window resizing - let image scale within existing window
        console.log('📺 Window resize request ignored - image will scale to fit existing window');
      }
    });

    ipcMain.on('resize-window-for-screen', (event, { width, height, remoteWidth, remoteHeight }) => {
      if (this.mainWindow) {
        const currentSize = this.mainWindow.getSize();
        const currentBounds = this.mainWindow.getBounds();
        
        console.log('📐 Resizing window for optimal screen viewing:');
        console.log('  📺 Current window:', currentSize[0], 'x', currentSize[1]);
        console.log('  🖥️ Remote screen:', remoteWidth, 'x', remoteHeight);
        console.log('  🎯 Target size:', width, 'x', height);
        console.log('  📊 Remote aspect ratio:', (remoteWidth / remoteHeight).toFixed(2));
        
        // Store the remote screen info
        this.remoteScreenWidth = remoteWidth;
        this.remoteScreenHeight = remoteHeight;
        
        // Get screen constraints
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const workArea = primaryDisplay.workAreaSize;
        console.log('  🖥️ Available workspace:', workArea.width, 'x', workArea.height);
        
        // Ensure size doesn't exceed screen
        const finalWidth = Math.min(width, workArea.width - 100);
        const finalHeight = Math.min(height, workArea.height - 100);
        
        console.log('  ✅ Final window size:', finalWidth, 'x', finalHeight);
        
        // Resize window to optimal size
        this.mainWindow.setSize(finalWidth, finalHeight);
        this.mainWindow.center(); // Center the resized window
        
        // Log final result
        const newSize = this.mainWindow.getSize();
        console.log('  🎉 Window actually resized to:', newSize[0], 'x', newSize[1]);
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



    ipcMain.handle('send-data-to-server', (event, data) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('receiveData', data);
        return true;
      }
      return false;
    });

    ipcMain.handle('capture-screenshot', (event) => {
      if (this.socket && this.isConnected) {
        // Request a fresh, full-quality screenshot from server
        this.socket.emit('request-screenshot');
        return { success: true, message: 'Screenshot requested from server' };
      }
      return { success: false, message: 'Not connected to server' };
    });

    ipcMain.handle('set-control-mode', (event, mode) => {
      this.isControlMode = mode;
      
      if (mode) {
        // Entering control mode - enable system blocking
        this.enableControlModeSystemBlocking();
      } else {
        // Exiting control mode - disable system blocking
        this.disableControlModeSystemBlocking();
      }
      
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
        if (!this.chatMessages.has('server')) {
          this.chatMessages.set('server', []);
        }
        
        this.chatMessages.get('server').push({
          type: 'viewer',
          message: message,
          timestamp: new Date()
        });
        
        return true;
      }
      return false;
    });

    ipcMain.handle('get-chat-messages', (event) => {
      return this.chatMessages.get('server') || [];
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

    // Control message handling
    ipcMain.handle('send-control-message', (event, message) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('control-message', message);
        return true;
      }
      return false;
    });

    // Ultra-fast click handler (fire-and-forget, no response)
    ipcMain.on('send-control-message-fast', (event, message) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('control-message', message);
      }
    });

    // High-speed mouse input handling
    ipcMain.handle('send-mouse-input', (event, mouseData) => {
      if (this.mouseSocket && this.isMouseConnected && this.isControlMode) {
        // Send via high-speed mouse port for maximum responsiveness
        this.mouseSocket.emit('mouse-input', mouseData);
        return true;
      }
      return false;
    });
  }
}

new ViewerApp();
