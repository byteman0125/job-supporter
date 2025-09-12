const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const io = require('socket.io-client');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const screenshot = require('screenshot-desktop');
const notifier = require('node-notifier');

class TesterApp {
  constructor() {
    this.mainWindow = null;
    this.settingsWindow = null;
    this.chatWindow = null;
    this.tray = null;
    this.socket = null;
    this.isConnected = false;
    this.tempData = '';
    this.isSharing = false;
    this.isScreenSharingDetected = false; // Track if screen sharing is detected from any source
    this.isAlwaysInvisible = false; // Track if always invisible mode is enabled
    this.audioDevices = {
      input: null,
      output: null
    };
    this.chatMessages = [];
    
    this.init();
  }

  init() {
    app.whenReady().then(() => {
      console.log('App is ready, creating main window...');
      this.createMainWindow();
      this.createTray();
      this.registerGlobalShortcuts();
      this.setupAudio();
      this.setupIpcHandlers();
      
      // Auto-start server on app launch with default TCP port
      setTimeout(() => {
        this.startServer(8080, 'medium');
      }, 1000); // Small delay to ensure UI is ready
      
      console.log('Tester app initialized successfully');
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle app termination gracefully
    app.on('before-quit', (event) => {
      if (this.socket) {
        this.socket.disconnect();
      }
      if (this.isSharing) {
        this.stopScreenSharing();
      }
    });

    // Handle second instance (prevent multiple instances)
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      console.log('Another instance is already running, quitting...');
      app.quit();
    } else {
      app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (this.mainWindow) {
          if (this.mainWindow.isMinimized()) this.mainWindow.restore();
          this.mainWindow.focus();
        }
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 500,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        enableRemoteModule: false
      },
      show: true, // Visible to you (the tester)
      icon: path.join(__dirname, 'assets/icon.png'),
      skipTaskbar: false, // Show in taskbar for you
      alwaysOnTop: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      titleBarStyle: 'default',
      // Advanced stealth properties
      transparent: false,
      frame: true,
      hasShadow: true
    });

    this.mainWindow.loadFile('renderer/index.html');

    // Hide window when sharing screen - completely invisible
    this.mainWindow.on('minimize', () => {
      if (this.isSharing) {
        this.mainWindow.hide();
      }
    });

    this.mainWindow.on('close', (event) => {
      if (!app.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
        // Show a notification that app is running in tray
        if (this.tray) {
          this.tray.displayBalloon({
            title: 'Code Supporter - Tester',
            content: 'Application is running in system tray. Right-click tray icon to show window.',
            icon: path.join(__dirname, 'assets', 'icon.png')
          });
        }
      }
    });

    // Advanced stealth protection - multiple layers
    this.mainWindow.setContentProtection(true); // Prevents screen capture
    this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
    
    // Keep window visible to you, but protected from capture
    this.mainWindow.setSkipTaskbar(false); // Show in taskbar for you
    this.mainWindow.setAlwaysOnTop(false); // Don't stay on top
    this.mainWindow.setFocusable(true); // You can focus it normally
    
    // Additional protection when window is ready
    this.mainWindow.webContents.once('did-finish-load', () => {
      // Enable content protection after page loads
      this.mainWindow.setContentProtection(true);
    });

    // Monitor for screen sharing detection
    this.setupScreenSharingDetection();
  }

  // Removed createChatWindow function - chat is now integrated in main window

  showMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.setFocusable(true);
      this.mainWindow.setSkipTaskbar(false);
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  showMainWindowTemporarily() {
    if (this.mainWindow) {
      // Window is already visible, just focus it
      this.mainWindow.setFocusable(true);
      this.mainWindow.setSkipTaskbar(false);
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  forceShowWindow() {
    if (this.mainWindow) {
      // Temporarily disable content protection
      this.mainWindow.setContentProtection(false);
      this.mainWindow.setVisibleOnAllWorkspaces(true);
      this.mainWindow.setFocusable(true);
      this.mainWindow.setSkipTaskbar(false);
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Re-enable protection after 10 seconds
      setTimeout(() => {
        if (this.mainWindow) {
          this.mainWindow.setContentProtection(true);
          this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
        }
      }, 10000);
    }
  }

  setupScreenSharingDetection() {
    // ALWAYS INVISIBLE MODE - No detection needed, always protected
    this.enableAlwaysInvisibleMode();
    
    // Refresh content protection every second to ensure it stays active
    setInterval(() => {
      if (this.mainWindow) {
        this.mainWindow.setContentProtection(true);
        this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      }
    }, 1000);
    
    console.log('Always invisible mode enabled - window permanently protected from screen capture');
  }

  enableAlwaysInvisibleMode() {
    // Immediately apply stealth protection
    if (this.mainWindow) {
      this.mainWindow.setContentProtection(true);
      this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
      this.mainWindow.setFocusable(true);
      this.mainWindow.setSkipTaskbar(false);
      this.mainWindow.show();
    }
    
    // Set flag to indicate always invisible mode
    this.isAlwaysInvisible = true;
    this.isScreenSharingDetected = true; // Keep this true for UI purposes
    
    console.log('Always invisible mode activated - window is permanently invisible to screen capture');
  }

  checkScreenSharingStopped() {
    // In always invisible mode, never restore window visibility
    if (this.isAlwaysInvisible) {
      return;
    }
    
    if (this.isScreenSharingDetected) {
      if (process.platform === 'win32') {
        this.checkScreenSharingStoppedWindows();
      } else if (process.platform === 'linux') {
        this.checkScreenSharingStoppedLinux();
      } else if (process.platform === 'darwin') {
        this.checkScreenSharingStoppedMac();
      }
    }
  }

  checkScreenSharingStoppedWindows() {
    const { exec } = require('child_process');
    const screenSharingApps = [
      'zoom.exe', 'teams.exe', 'skype.exe', 'discord.exe', 'obs64.exe', 'obs32.exe',
      'chrome.exe', 'msedge.exe', 'firefox.exe', 'slack.exe', 'webexmta.exe',
      'gotomeeting.exe', 'bluejeans.exe', 'jitsi.exe', 'whereby.exe'
    ];
    
    let anyAppRunning = false;
    let checkedApps = 0;
    
    screenSharingApps.forEach(app => {
      exec(`tasklist /FI "IMAGENAME eq ${app}" /FO CSV`, (error, stdout) => {
        checkedApps++;
        if (!error && stdout.includes(app)) {
          anyAppRunning = true;
        }
        
        // If we've checked all apps and none are running, restore window
        if (checkedApps === screenSharingApps.length && !anyAppRunning) {
          this.handleScreenSharingStopped();
        }
      });
    });
  }

  checkScreenSharingStoppedLinux() {
    const { exec } = require('child_process');
    const screenSharingApps = [
      'zoom', 'teams', 'skype', 'discord', 'obs', 'obs-studio',
      'chrome', 'chromium', 'firefox', 'slack', 'webex',
      'gotomeeting', 'bluejeans', 'jitsi', 'whereby', 'signal',
      'telegram', 'element', 'mattermost', 'rocketchat'
    ];
    
    let anyAppRunning = false;
    let checkedApps = 0;
    
    screenSharingApps.forEach(app => {
      exec(`ps aux | grep -i ${app} | grep -v grep`, (error, stdout) => {
        checkedApps++;
        if (!error && stdout.trim()) {
          anyAppRunning = true;
        }
        
        // If we've checked all apps and none are running, restore window
        if (checkedApps === screenSharingApps.length && !anyAppRunning) {
          this.handleScreenSharingStopped();
        }
      });
    });
  }

  checkScreenSharingStoppedMac() {
    const { exec } = require('child_process');
    const screenSharingApps = [
      'zoom', 'teams', 'skype', 'discord', 'obs', 'obs-studio',
      'chrome', 'firefox', 'slack', 'webex', 'gotomeeting',
      'bluejeans', 'jitsi', 'whereby', 'signal', 'telegram'
    ];
    
    let anyAppRunning = false;
    let checkedApps = 0;
    
    screenSharingApps.forEach(app => {
      exec(`ps aux | grep -i ${app} | grep -v grep`, (error, stdout) => {
        checkedApps++;
        if (!error && stdout.trim()) {
          anyAppRunning = true;
        }
        
        // If we've checked all apps and none are running, restore window
        if (checkedApps === screenSharingApps.length && !anyAppRunning) {
          this.handleScreenSharingStopped();
        }
      });
    });
  }

  detectScreenSharing() {
    // Check for common screen sharing applications
    const { exec } = require('child_process');
    
    if (process.platform === 'win32') {
      this.detectScreenSharingWindows();
    } else if (process.platform === 'linux') {
      this.detectScreenSharingLinux();
    } else if (process.platform === 'darwin') {
      this.detectScreenSharingMac();
    }
  }

  detectScreenSharingWindows() {
    const { exec } = require('child_process');
    
    // List of common screen sharing applications on Windows
    const screenSharingApps = [
      'zoom.exe', 'teams.exe', 'skype.exe', 'discord.exe', 'obs64.exe', 'obs32.exe',
      'chrome.exe', 'msedge.exe', 'firefox.exe', 'slack.exe', 'webexmta.exe',
      'gotomeeting.exe', 'bluejeans.exe', 'jitsi.exe', 'whereby.exe'
    ];
    
    // Check for running screen sharing applications
    screenSharingApps.forEach(app => {
      exec(`tasklist /FI "IMAGENAME eq ${app}" /FO CSV`, (error, stdout) => {
        if (!error && stdout.includes(app)) {
          this.handleScreenSharingDetected();
        }
      });
    });
    
    // Additional check: Monitor for screen capture activity
    this.monitorScreenCaptureWindows();
  }

  detectScreenSharingLinux() {
    const { exec } = require('child_process');
    
    // List of common screen sharing applications on Linux
    const screenSharingApps = [
      'zoom', 'teams', 'skype', 'discord', 'obs', 'obs-studio',
      'chrome', 'chromium', 'firefox', 'slack', 'webex',
      'gotomeeting', 'bluejeans', 'jitsi', 'whereby', 'signal',
      'telegram', 'element', 'mattermost', 'rocketchat'
    ];
    
    // Check for running screen sharing applications using ps
    screenSharingApps.forEach(app => {
      exec(`ps aux | grep -i ${app} | grep -v grep`, (error, stdout) => {
        if (!error && stdout.trim()) {
          this.handleScreenSharingDetected();
        }
      });
    });
    
    // Check for screen sharing using pgrep
    exec('pgrep -f "zoom\\|teams\\|discord\\|obs\\|chrome.*--enable-features=WebRTC"', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
    
    // Additional check: Monitor for screen capture activity
    this.monitorScreenCaptureLinux();
  }

  detectScreenSharingMac() {
    const { exec } = require('child_process');
    
    // List of common screen sharing applications on macOS
    const screenSharingApps = [
      'zoom', 'teams', 'skype', 'discord', 'obs', 'obs-studio',
      'chrome', 'firefox', 'slack', 'webex', 'gotomeeting',
      'bluejeans', 'jitsi', 'whereby', 'signal', 'telegram'
    ];
    
    // Check for running screen sharing applications using ps
    screenSharingApps.forEach(app => {
      exec(`ps aux | grep -i ${app} | grep -v grep`, (error, stdout) => {
        if (!error && stdout.trim()) {
          this.handleScreenSharingDetected();
        }
      });
    });
    
    // Check for screen sharing using pgrep
    exec('pgrep -f "zoom\\|teams\\|discord\\|obs\\|chrome.*--enable-features=WebRTC"', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
  }

  monitorScreenCaptureWindows() {
    // Check if screen capture is happening by monitoring system resources on Windows
    const { exec } = require('child_process');
    
    // Check for processes that might be capturing screen
    exec('wmic process where "name like \'%obs%\' or name like \'%bandicam%\' or name like \'%fraps%\' or name like \'%camtasia%\'" get name', (error, stdout) => {
      if (!error && stdout.trim() && !stdout.includes('No Instance(s) Available')) {
        this.handleScreenSharingDetected();
      }
    });
    
    // Check for browser processes that might be screen sharing
    exec('wmic process where "name=\'chrome.exe\' or name=\'msedge.exe\' or name=\'firefox.exe\'" get commandline', (error, stdout) => {
      if (!error && stdout.includes('--enable-features=WebRTC')) {
        this.handleScreenSharingDetected();
      }
    });
  }

  monitorScreenCaptureLinux() {
    // Check if screen capture is happening by monitoring system resources on Linux
    const { exec } = require('child_process');
    
    // Check for screen recording software
    exec('ps aux | grep -i "obs\\|kazam\\|simplescreenrecorder\\|recordmydesktop\\|ffmpeg.*x11grab" | grep -v grep', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
    
    // Check for browser processes with screen sharing flags
    exec('ps aux | grep -E "chrome.*--enable-features=WebRTC|firefox.*--enable-features=WebRTC|chromium.*--enable-features=WebRTC" | grep -v grep', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
    
    // Check for Wayland screen sharing
    exec('ps aux | grep -i "wayland.*screen\\|gnome-shell.*screen\\|kde.*screen" | grep -v grep', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
  }

  monitorScreenCaptureMac() {
    // Check if screen capture is happening by monitoring system resources on macOS
    const { exec } = require('child_process');
    
    // Check for screen recording software
    exec('ps aux | grep -i "obs\\|quicktime\\|screenflow\\|camtasia" | grep -v grep', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
    
    // Check for browser processes with screen sharing flags
    exec('ps aux | grep -E "chrome.*--enable-features=WebRTC|firefox.*--enable-features=WebRTC" | grep -v grep', (error, stdout) => {
      if (!error && stdout.trim()) {
        this.handleScreenSharingDetected();
      }
    });
  }

  handleScreenSharingDetected() {
    if (!this.isScreenSharingDetected) {
      this.isScreenSharingDetected = true;
      console.log('Screen sharing detected - making window invisible to screen capture');
      
      // Make window invisible to screen capture but keep it visible to user
      if (this.mainWindow) {
        this.mainWindow.setContentProtection(true); // Prevents screen capture
        this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
        // Keep window visible and focusable for user
        this.mainWindow.setFocusable(true);
        this.mainWindow.setSkipTaskbar(false);
        this.mainWindow.show(); // Ensure it's visible to user
      }
      
      // Show notification
      this.showStealthNotification();
    }
  }

  handleScreenSharingStopped() {
    // In always invisible mode, never restore window visibility
    if (this.isAlwaysInvisible) {
      return;
    }
    
    if (this.isScreenSharingDetected) {
      this.isScreenSharingDetected = false;
      console.log('Screen sharing stopped - restoring normal window behavior');
      
      // Restore normal window behavior
      if (this.mainWindow) {
        this.mainWindow.setContentProtection(false); // Allow screen capture again
        this.mainWindow.setVisibleOnAllWorkspaces(true); // Show on all workspaces
        this.mainWindow.setFocusable(true);
        this.mainWindow.setSkipTaskbar(false);
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }
  }

  showStealthNotification() {
    // Show a brief notification that stealth mode is active
    if (this.mainWindow) {
      this.mainWindow.webContents.executeJavaScript(`
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = \`
          position: fixed;
          top: 20px;
          right: 20px;
          background: #2d2d2d;
          color: #fff;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          z-index: 10000;
          border: 1px solid #444;
        \`;
        notification.textContent = '🥷 Always Invisible Mode - Permanently Protected';
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      `);
    }
  }

  createTray() {
    const iconPath = path.join(__dirname, 'assets/tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    
    this.tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: this.isAlwaysInvisible ? '🥷 Always Invisible Mode' : 'Show Main Window',
        click: () => this.showMainWindowTemporarily()
      },
      {
        label: 'Show Settings',
        click: () => this.showSettings()
      },
      { type: 'separator' },
      {
        label: 'Force Show Window',
        click: () => this.forceShowWindow()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Code Supporter - Tester');
    
    this.tray.on('click', () => {
      this.showMainWindowTemporarily();
    });
  }

  showSettings() {
    if (!this.settingsWindow) {
      this.settingsWindow = new BrowserWindow({
        width: 500,
        height: 400,
        parent: this.mainWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      this.settingsWindow.loadFile('renderer/settings.html');
      
      this.settingsWindow.on('closed', () => {
        this.settingsWindow = null;
      });
    }
    
    this.settingsWindow.show();
  }

  showConnectionDialog() {
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  registerGlobalShortcuts() {
    // ALT+L: Input one word at a time
    globalShortcut.register('Alt+L', () => {
      this.inputWordByWord();
    });

    // ALT+K: Input one line at a time
    globalShortcut.register('Alt+K', () => {
      this.inputLineByLine();
    });

    // ALT+C: Copy clipboard to temp data
    globalShortcut.register('Alt+C', () => {
      this.copyClipboardToTemp();
    });
  }

  async inputWordByWord() {
    if (!this.tempData) return;
    
    // TODO: Implement with robotjs when compatibility is fixed
    console.log('Input word by word:', this.tempData);
    this.playNotificationSound();
  }

  async inputLineByLine() {
    if (!this.tempData) return;
    
    // TODO: Implement with robotjs when compatibility is fixed
    console.log('Input line by line:', this.tempData);
    this.playNotificationSound();
  }

  copyClipboardToTemp() {
    const { clipboard } = require('electron');
    this.tempData = clipboard.readText();
    this.playNotificationSound();
  }

  startServer(port = 8080, quality = 'medium') {
    const express = require('express');
    const http = require('http');
    const socketIo = require('socket.io');
    
    const expressApp = express();
    this.server = http.createServer(expressApp);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Supporter connected:', socket.id);
      
      this.socket = socket;
      this.isConnected = true;
      this.screenQuality = quality; // Store quality setting
      this.playNotificationSound();
      this.startScreenSharing();
      
      // Handle supporter disconnection
      socket.on('disconnect', () => {
        this.isConnected = false;
        this.stopScreenSharing();
        this.mainWindow.webContents.send('connection-status', { connected: false });
      });
    });

    this.server.listen(port, () => {
      console.log(`Tester server running on port ${port} with ${quality} quality`);
      this.mainWindow.webContents.send('server-started', port);
    });
  }

  // Handle supporter events
  handleSupporterEvents(socket) {
    socket.on('receiveData', (data) => {
      this.tempData = data;
      this.playNotificationSound();
    });

    socket.on('chatMessage', (message) => {
      this.chatMessages.push({
        type: 'supporter',
        message: message,
        timestamp: new Date()
      });
      
      // Send to main window chat
      this.mainWindow.webContents.send('chat-message', {
        message: message,
        sender: 'supporter'
      });
      
      // Update chat window if open
      if (this.chatWindow) {
        this.chatWindow.webContents.send('new-message', {
          type: 'supporter',
          message: message,
          timestamp: new Date()
        });
      }
      
      this.playNotificationSound();
    });

    socket.on('request-screenshot', async () => {
      try {
        // Take a fresh, full-quality screenshot
        const screenshot = require('screenshot-desktop');
        const img = await screenshot({ format: 'png', quality: 1.0, screen: 0 });
        const base64Data = img.toString('base64');
        
        // Send the full-quality screenshot back to supporter
        socket.emit('screenshot-data', base64Data);
        console.log('Screenshot captured and sent to supporter');
      } catch (error) {
        console.error('Error capturing screenshot:', error);
      }
    });

    socket.on('mouseMove', (data) => {
      if (this.isSharing) {
        // TODO: Implement with robotjs when compatibility is fixed
        console.log('Mouse move:', data);
      }
    });

    socket.on('mouseClick', (data) => {
      if (this.isSharing) {
        // TODO: Implement with robotjs when compatibility is fixed
        console.log('Mouse click:', data);
      }
    });

    socket.on('keyPress', (data) => {
      if (this.isSharing) {
        // TODO: Implement with robotjs when compatibility is fixed
        console.log('Key press:', data);
      }
    });
  }

  async startScreenSharing() {
    this.isSharing = true;
    
    // AGGRESSIVE STEALTH - Actually hide the window during screen sharing
    if (this.mainWindow) {
      // Hide window completely - this is the only way to be truly invisible
      this.mainWindow.hide();
      this.mainWindow.setSkipTaskbar(true); // Hide from taskbar too
      this.mainWindow.setFocusable(false); // Can't be focused
      this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
    }
    
    if (this.settingsWindow) {
      this.settingsWindow.hide();
      this.settingsWindow.setSkipTaskbar(true);
      this.settingsWindow.setFocusable(false);
    }
    
    if (this.chatWindow) {
      this.chatWindow.hide();
      this.chatWindow.setSkipTaskbar(true);
      this.chatWindow.setFocusable(false);
    }
    
    // Set up screen capture based on quality setting
    this.setupScreenCapture();
    
    console.log('Screen sharing started - WINDOW COMPLETELY HIDDEN FOR STEALTH');
  }

  setupScreenCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }

    const quality = this.screenQuality || 'medium';
    let captureOptions, interval;

    switch (quality) {
      case 'high':
        captureOptions = {
          format: 'png',
          quality: 1.0,
          screen: 0
        };
        interval = 100; // 10 FPS
        break;
      case 'medium':
        captureOptions = {
          format: 'jpeg',
          quality: 0.9,
          screen: 0
        };
        interval = 125; // 8 FPS
        break;
      case 'low':
        captureOptions = {
          format: 'jpeg',
          quality: 0.7,
          screen: 0
        };
        interval = 200; // 5 FPS
        break;
      default:
        captureOptions = {
          format: 'jpeg',
          quality: 0.9,
          screen: 0
        };
        interval = 125;
    }

    this.captureInterval = setInterval(async () => {
      if (this.isSharing && this.socket) {
        try {
          const img = await screenshot(captureOptions);
          this.socket.emit('screenData', img.toString('base64'));
        } catch (error) {
          console.error('Screen capture error:', error);
        }
      }
    }, interval);
  }

  stopScreenSharing() {
    this.isSharing = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Restore window visibility when sharing stops
    if (this.mainWindow) {
      this.mainWindow.setSkipTaskbar(false); // Show in taskbar again
      this.mainWindow.setFocusable(true); // Can be focused again
      this.mainWindow.show(); // Show the window again
    }
    
    console.log('Screen sharing stopped - window restored and visible');
  }

  playNotificationSound() {
    // Play a short notification sound
    notifier.notify({
      title: 'Code Supporter',
      message: 'Data received',
      sound: true
    });
  }

  setupAudio() {
    // Audio setup will be implemented with WebRTC or similar
    // For now, placeholder
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setupIpcHandlers() {
    // Server auto-starts, no manual start/stop needed

    ipcMain.on('change-quality', (event, quality) => {
      this.screenQuality = quality;
      if (this.isSharing) {
        this.setupScreenCapture();
      }
    });

    ipcMain.handle('send-chat-message', (event, message) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('chat-message', { message, sender: 'tester' });
        return true;
      }
      return false;
    });

    ipcMain.on('save-settings', (event, settings) => {
      // Save settings to localStorage or file
      localStorage.setItem('tester-settings', JSON.stringify(settings));
      event.reply('settings-saved', true);
    });

    ipcMain.on('get-audio-devices', (event) => {
      // Return available audio devices
      event.reply('audio-devices', {
        input: [], // Will be populated with actual devices
        output: []
      });
    });

    ipcMain.on('test-audio-device', (event, { type, device }) => {
      // Test audio device
      console.log(`Testing ${type} device:`, device);
    });

    ipcMain.on('send-chat-message', (event, message) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('chatMessage', message);
        
        // Add to local chat messages
        this.chatMessages.push({
          type: 'tester',
          message: message,
          timestamp: new Date()
        });
      }
    });

    ipcMain.on('get-chat-messages', (event) => {
      event.reply('chat-messages', this.chatMessages);
    });
  }
}

new TesterApp();
