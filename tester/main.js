const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, desktopCapturer, screen } = require('electron');
const path = require('path');
const io = require('socket.io-client');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const screenshot = require('screenshot-desktop');
const notifier = require('node-notifier');
const record = require('node-record-lpcm16');
const WindowsControl = require('./windows-control');
const WindowsGraphicsCapture = require('./windows-graphics-capture');
const DirectXCapture = require('./directx-capture');
const WindowsAPICapture = require('./windows-api-capture');

class TesterApp {
  constructor() {
    this.mainWindow = null;
    // Removed settingsWindow and chatWindow - now integrated into main window tabs
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
    this.audioRecorder = null;
    this.isAudioEnabled = true; // Audio enabled by default
    this.useElectronCapture = false; // Disable WebRTC to focus on optimized screenshot method
    this.lastQualityAdjustment = 0; // Track last quality adjustment time
    
    // Delta compression for efficient screen sharing
    this.lastScreenBuffer = null;
    this.lastScreenWidth = 0;
    this.lastScreenHeight = 0;
    this.pixelmatch = null; // Will be loaded dynamically
    
    // Windows control with manifest privileges
    this.windowsControl = new WindowsControl();
    
    // Multiple screen capture methods for reliability
    this.windowsGraphicsCapture = new WindowsGraphicsCapture();
    this.directXCapture = new DirectXCapture();
    this.windowsAPICapture = new WindowsAPICapture();
    
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
      
      // Check input tools availability
      this.checkInputTools();
      
      // Auto-start server on app launch with default TCP port
      // Use lower quality on Windows for better performance
      const defaultQuality = process.platform === 'win32' ? 'low' : 'medium';
      setTimeout(() => {
        this.startServer(8080, defaultQuality);
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
      // Clean up aggressive protection interval
      if (this.aggressiveProtectionInterval) {
        clearInterval(this.aggressiveProtectionInterval);
        this.aggressiveProtectionInterval = null;
      }
    });

    // Handle uncaught exceptions gracefully
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      if (error.message.includes('spawn sox ENOENT') || 
          error.message.includes('spawn rec ENOENT') || 
          error.message.includes('spawn arecord ENOENT')) {
        console.log('⚠️ Audio tool not found - audio features disabled');
        // Don't crash the app for missing audio tools
        return;
      }
      // For other errors, let them bubble up
      throw error;
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
      // icon: path.join(__dirname, 'assets/icon.png'), // Commented out due to empty file
      skipTaskbar: true, // Hide from taskbar
      alwaysOnTop: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      titleBarStyle: 'default',
      // Advanced stealth properties
      transparent: false,
      frame: true,
      hasShadow: true,
      // Additional stealth properties
      fullscreenable: false,
      simpleFullscreen: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    });

    this.mainWindow.loadFile('renderer/index.html');

    // Don't hide window when minimized - keep it accessible
    this.mainWindow.on('minimize', () => {
      // Window stays in taskbar when minimized
    });

    this.mainWindow.on('close', (event) => {
      if (!app.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
        // No notification - app runs silently in tray
      }
    });

    // Advanced stealth protection - multiple layers
    this.mainWindow.setContentProtection(true); // Prevents screen capture
    this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
    
    // Keep window visible to you, but protected from capture
    this.mainWindow.setSkipTaskbar(true); // Hide from taskbar as requested
    this.mainWindow.setAlwaysOnTop(false); // Don't stay on top
    this.mainWindow.setFocusable(true); // You can focus it normally
    
    // Additional protection when window is ready
    this.mainWindow.webContents.once('did-finish-load', () => {
      // Enable content protection after page loads
      this.mainWindow.setContentProtection(true);
      
      // Inject JavaScript to handle combobox clicks and hide dropdowns
      this.injectStealthScript();
    });

    // Monitor for screen sharing detection
    this.setupScreenSharingDetection();
  }

  injectStealthScript() {
    // Inject JavaScript to handle combobox and dropdown visibility
    const stealthScript = `
      (function() {
        console.log('🥷 Stealth script injected');
        
        // Hide all select dropdowns and comboboxes from screen capture
        function hideDropdowns() {
          const selects = document.querySelectorAll('select');
          const comboboxes = document.querySelectorAll('[role="combobox"]');
          const dropdowns = document.querySelectorAll('[role="listbox"]');
          
          selects.forEach(select => {
            select.style.setProperty('visibility', 'hidden', 'important');
            select.style.setProperty('opacity', '0', 'important');
            select.style.setProperty('pointer-events', 'none', 'important');
          });
          
          comboboxes.forEach(combobox => {
            combobox.style.setProperty('visibility', 'hidden', 'important');
            combobox.style.setProperty('opacity', '0', 'important');
            combobox.style.setProperty('pointer-events', 'none', 'important');
          });
          
          dropdowns.forEach(dropdown => {
            dropdown.style.setProperty('visibility', 'hidden', 'important');
            dropdown.style.setProperty('opacity', '0', 'important');
            dropdown.style.setProperty('pointer-events', 'none', 'important');
          });
        }
        
        // Hide dropdowns immediately
        hideDropdowns();
        
        // Hide dropdowns when they appear
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
              hideDropdowns();
            }
          });
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Also hide on any click or focus events
        document.addEventListener('click', hideDropdowns, true);
        document.addEventListener('focus', hideDropdowns, true);
        document.addEventListener('mousedown', hideDropdowns, true);
        
        // Hide dropdowns every 100ms as backup
        setInterval(hideDropdowns, 100);
        
        console.log('🥷 Dropdown hiding active');
      })();
    `;
    
    this.mainWindow.webContents.executeJavaScript(stealthScript).catch(error => {
      console.error('Error injecting stealth script:', error);
    });
  }

  // Removed createChatWindow function - chat is now integrated in main window

  showMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.setFocusable(true);
      this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  showMainWindowTemporarily() {
    if (this.mainWindow) {
      // Window is already visible, just focus it
      this.mainWindow.setFocusable(true);
      this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
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
      this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
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
      this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
      this.mainWindow.show();
      
      // Additional protection for native UI elements
      this.mainWindow.setContentProtection(true);
      
      // Hide window from screen capture more aggressively
      this.mainWindow.setAlwaysOnTop(false);
      this.mainWindow.setSkipTaskbar(true);
      
      // Set window to be invisible to screen capture
      this.mainWindow.setVisibleOnAllWorkspaces(false, { 
        visibleOnFullScreen: false,
        visibleOnAllWorkspaces: false 
      });
    }
    
    // Set flag to indicate always invisible mode
    this.isAlwaysInvisible = true;
    this.isScreenSharingDetected = true; // Keep this true for UI purposes
    
    // Start aggressive protection loop
    this.startAggressiveProtection();
    
    console.log('Always invisible mode activated - window is permanently invisible to screen capture');
  }

  startAggressiveProtection() {
    // More frequent protection refresh to handle native UI elements
    if (this.aggressiveProtectionInterval) {
      clearInterval(this.aggressiveProtectionInterval);
    }
    
    this.aggressiveProtectionInterval = setInterval(() => {
      if (this.mainWindow && this.isAlwaysInvisible) {
        // Reapply protection every 500ms to catch native UI elements
        this.mainWindow.setContentProtection(true);
        this.mainWindow.setVisibleOnAllWorkspaces(false, { 
          visibleOnFullScreen: false,
          visibleOnAllWorkspaces: false 
        });
        this.mainWindow.setSkipTaskbar(true);
        
        // Additional protection for native elements
        this.hideNativeUIElements();
      }
    }, 500);
  }

  hideNativeUIElements() {
    // Hide native UI elements that might appear (like dropdowns, tooltips, etc.)
    if (process.platform === 'win32') {
      this.hideNativeUIElementsWindows();
    } else if (process.platform === 'linux') {
      this.hideNativeUIElementsLinux();
    } else if (process.platform === 'darwin') {
      this.hideNativeUIElementsMac();
    }
  }

  hideNativeUIElementsWindows() {
    const { exec } = require('child_process');
    
    // Hide common native UI elements on Windows
    const hideScript = `
      # Hide tooltips and dropdowns
      Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")]
          public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        }
"@
      
      # Hide tooltip windows
      $tooltipWindows = @("tooltips_class32", "tooltips_class64")
      foreach ($className in $tooltipWindows) {
        $hwnd = [Win32]::FindWindow($className, $null)
        if ($hwnd -ne [IntPtr]::Zero) {
          [Win32]::ShowWindow($hwnd, 0) # SW_HIDE
        }
      }
      
      # Hide dropdown menus
      $dropdownWindows = @("ComboBox", "ComboBoxEx32")
      foreach ($className in $dropdownWindows) {
        $hwnd = [Win32]::FindWindow($className, $null)
        if ($hwnd -ne [IntPtr]::Zero) {
          [Win32]::ShowWindow($hwnd, 0) # SW_HIDE
        }
      }
    `;
    
    exec(`powershell -command "${hideScript}"`, (error) => {
      if (error) {
        // Silently fail - this is just additional protection
      }
    });
  }

  hideNativeUIElementsLinux() {
    const { exec } = require('child_process');
    
    // Hide native UI elements on Linux using xdotool
    exec(`xdotool search --class "tooltip" windowunmap --sync`, (error) => {
      // Silently fail - this is just additional protection
    });
    
    exec(`xdotool search --class "dropdown" windowunmap --sync`, (error) => {
      // Silently fail - this is just additional protection
    });
    
    exec(`xdotool search --class "menu" windowunmap --sync`, (error) => {
      // Silently fail - this is just additional protection
    });
  }

  hideNativeUIElementsMac() {
    const { exec } = require('child_process');
    
    // Hide native UI elements on macOS using osascript
    const hideScript = `
      tell application "System Events"
        try
          set tooltipWindows to every window whose name contains "tooltip"
          repeat with w in tooltipWindows
            set visible of w to false
          end repeat
          
          set dropdownWindows to every window whose name contains "dropdown"
          repeat with w in dropdownWindows
            set visible of w to false
          end repeat
        end try
      end tell
    `;
    
    exec(`osascript -e '${hideScript}'`, (error) => {
      // Silently fail - this is just additional protection
    });
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
        this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
        this.mainWindow.show(); // Ensure it's visible to user
      }
      
      // No notification - stealth mode activated silently
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
        this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }
  }

  // Removed showStealthNotification - no notifications needed

  createTray() {
    // Create a simple default icon since tray-icon.png is empty
    const icon = nativeImage.createEmpty();
    
    this.tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: this.isAlwaysInvisible ? '🥷 Always Invisible Mode' : 'Show Main Window',
        click: () => this.showMainWindowTemporarily()
      },
      {
        label: 'Show Settings',
        click: () => this.showMainWindowTemporarily() // Settings now in main window tabs
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

  // Removed showSettings - settings now integrated into main window tabs

  showConnectionDialog() {
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  registerGlobalShortcuts() {
    // CTRL+SHIFT+L: Input only the first word
    globalShortcut.register('Ctrl+Shift+L', () => {
      this.inputWordByWord();
    });

    // CTRL+SHIFT+K: Input only the first line
    globalShortcut.register('Ctrl+Shift+K', () => {
      this.inputLineByLine();
    });

    // CTRL+SHIFT+C: Copy clipboard to temp data
    globalShortcut.register('Ctrl+Shift+C', () => {
      this.copyClipboardToTemp();
    });
  }

  async inputWordByWord() {
    if (!this.tempData) {
      console.log('No answer data available to input');
      return;
    }
    
    console.log('Inputting ONE word from:', this.tempData.substring(0, 100) + '...');
    
    // Get only the first word
    const firstWord = this.tempData.split(' ')[0];
    if (firstWord.trim()) {
      console.log('First word to type:', firstWord);
      await this.typeText(firstWord);
    }
  }

  async inputLineByLine() {
    if (!this.tempData) {
      console.log('No answer data available to input');
      return;
    }
    
    console.log('Inputting ONE line from:', this.tempData.substring(0, 100) + '...');
    
    // Get only the first line
    const firstLine = this.tempData.split('\n')[0];
    if (firstLine.trim()) {
      console.log('First line to type:', firstLine.substring(0, 100) + '...');
      await this.typeText(firstLine);
    }
  }

  async typeText(text) {
    const { exec } = require('child_process');
    
    console.log('🔤 Attempting to type text:', text);
    console.log('🔤 Platform:', process.platform);
    console.log('🔤 Text length:', text.length);
    console.log('🔤 First 50 chars:', text.substring(0, 50));
    
    // Limit text length to prevent issues
    if (text.length > 1000) {
      console.log('⚠️ Text too long, truncating to 1000 characters');
      text = text.substring(0, 1000);
    }
    
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to send text character by character (safer)
      const escapedText = text.replace(/"/g, '""').replace(/\{/g, '{{').replace(/\}/g, '}}');
      return new Promise((resolve) => {
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`, (error) => {
          if (error) {
            console.error('Error typing text with SendKeys:', error);
            // Fallback: try using VBScript
            const vbsText = text.replace(/"/g, '""');
            exec(`cscript //nologo -e:vbscript <(echo "CreateObject(\"WScript.Shell\").SendKeys \"${vbsText}\"")`, (error2) => {
              if (error2) console.error('Error typing text with VBScript:', error2);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool to type character by character (safe method)
      return new Promise((resolve) => {
        // Simple escaping for xdotool - only escape quotes and backslashes
        const escapedText = text.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
        
        console.log('🔤 Linux command:', `xdotool type "${escapedText}"`);
        exec(`xdotool type "${escapedText}"`, (error) => {
          if (error) {
            console.error('Error typing text with xdotool:', error);
            // Fallback: try ydotool if available
            exec(`ydotool type "${escapedText}"`, (error2) => {
              if (error2) {
                console.error('Error typing text with ydotool:', error2);
                // Last resort: try xvkbd
                exec(`xvkbd -text "${escapedText}"`, (error3) => {
                  if (error3) {
                    console.error('All typing methods failed. Please install xdotool: sudo apt install xdotool');
                  }
                  resolve();
                });
              } else {
                resolve();
              }
            });
          } else {
            console.log('✅ Successfully typed text with xdotool');
            resolve();
          }
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: Use osascript to type character by character (safe method)
      const escapedText = text.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
      return new Promise((resolve) => {
        exec(`osascript -e 'tell application "System Events" to keystroke "${escapedText}"'`, (error) => {
          if (error) {
            console.error('Error typing text with osascript:', error);
            // Fallback: try using pbcopy + pbpaste (but this is less safe)
            console.log('Falling back to clipboard method (less safe)');
            exec(`echo "${escapedText}" | pbcopy && osascript -e 'tell application "System Events" to keystroke "v" using command down'`, (error2) => {
              if (error2) console.error('Error with clipboard fallback:', error2);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    }
  }

  async pressKey(key, modifiers = []) {
    const { exec } = require('child_process');
    
    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        console.log(`⌨️ Windows key press: ${key} with modifiers: ${modifiers.join(', ')}`);
        
        // Build modifier string for Windows
        let keyString = '';
        if (modifiers.includes('ctrl')) keyString += '^';
        if (modifiers.includes('alt')) keyString += '%';
        if (modifiers.includes('shift')) keyString += '+';
        keyString += key;
        
        // Try multiple approaches for better compatibility
        const approaches = [
          // Approach 1: Standard SendKeys with proper escaping
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keyString.replace(/'/g, "''")}')"`,
          
          // Approach 2: Using VBScript
          `cscript //nologo -e:vbscript -c "CreateObject(\"WScript.Shell\").SendKeys \"${keyString}\""`,
          
          // Approach 3: Using nircmd if available
          `nircmd sendkey ${key.toLowerCase()}`,
          
          // Approach 4: Using AutoHotkey if available
          `autohotkey -c "Send, ${keyString}"`,
          
          // Approach 5: Direct Windows API call
          `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Keyboard { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo); }'; [Keyboard]::keybd_event([byte][char]'${key}', 0, 0, 0); Start-Sleep -Milliseconds 10; [Keyboard]::keybd_event([byte][char]'${key}', 0, 2, 0)"`
        ];
        
        let currentApproach = 0;
        
        const tryNextApproach = () => {
          if (currentApproach >= approaches.length) {
            console.error('❌ All Windows keyboard approaches failed');
            resolve();
            return;
          }
          
          const command = approaches[currentApproach];
          console.log(`🔄 Trying Windows keyboard approach ${currentApproach + 1}: ${command.substring(0, 60)}...`);
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error(`❌ Windows keyboard approach ${currentApproach + 1} failed:`, error.message);
              currentApproach++;
              tryNextApproach();
            } else {
              console.log(`✅ Windows keyboard input successful with approach ${currentApproach + 1}`);
              resolve();
            }
          });
        };
        
        tryNextApproach();
      });
    } else if (process.platform === 'linux') {
      return new Promise((resolve) => {
        // Build modifier string for Linux
        let keyString = '';
        if (modifiers.includes('ctrl')) keyString += 'ctrl+';
        if (modifiers.includes('alt')) keyString += 'alt+';
        if (modifiers.includes('shift')) keyString += 'shift+';
        keyString += key.toLowerCase();
        
        exec(`xdotool key ${keyString}`, (error) => {
          if (error) console.error('Error pressing key:', error);
          resolve();
        });
      });
    } else if (process.platform === 'darwin') {
      return new Promise((resolve) => {
        // Build modifier string for macOS
        let keyString = '';
        if (modifiers.includes('ctrl')) keyString += 'control down, ';
        if (modifiers.includes('alt')) keyString += 'option down, ';
        if (modifiers.includes('shift')) keyString += 'shift down, ';
        keyString += `key code ${this.getKeyCode(key)}`;
        if (modifiers.includes('ctrl')) keyString += ', control up';
        if (modifiers.includes('alt')) keyString += ', option up';
        if (modifiers.includes('shift')) keyString += ', shift up';
        
        exec(`osascript -e 'tell application "System Events" to ${keyString}'`, (error) => {
          if (error) console.error('Error pressing key:', error);
          resolve();
        });
      });
    }
  }

  getKeyCode(key) {
    const keyCodes = {
      'Enter': 36,
      'Return': 36,
      'Tab': 48,
      'Space': 49,
      'Escape': 53
    };
    return keyCodes[key] || 36; // Default to Enter
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  copyClipboardToTemp() {
    const { clipboard } = require('electron');
    this.tempData = clipboard.readText();
  }

  checkInputTools() {
    const { exec } = require('child_process');
    
    if (process.platform === 'linux') {
      exec('which xdotool', (error) => {
        if (error) {
          console.log('⚠️  xdotool not found. Install it with: sudo apt install xdotool');
          console.log('   Alternative: sudo apt install ydotool (faster)');
        } else {
          console.log('✅ xdotool is available for safe text input and mouse control');
        }
      });
    } else if (process.platform === 'win32') {
      console.log('✅ Windows SendKeys is available for safe text input and mouse control');
    } else if (process.platform === 'darwin') {
      console.log('✅ macOS osascript is available for safe text input and mouse control');
    }
  }

  checkAudioTools() {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      
      // Check for common audio recording tools
      const audioTools = ['rec', 'arecord', 'sox'];
      let foundTool = false;
      let checkedTools = 0;
      
      audioTools.forEach(tool => {
        exec(`which ${tool}`, (error) => {
          checkedTools++;
          if (!error && !foundTool) {
            foundTool = true;
            console.log(`✅ Audio tool ${tool} is available`);
            resolve(true);
          } else if (checkedTools === audioTools.length && !foundTool) {
            console.log('⚠️ No audio recording tools found (rec, arecord, sox)');
            resolve(false);
          }
        });
      });
    });
  }

  async moveMouse(x, y) {
    if (process.platform === 'win32') {
      // Use the new Windows control with manifest privileges
      return await this.windowsControl.moveMouse(x, y);
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool to move mouse
      const { exec } = require('child_process');
      // Linux: Use xdotool to move mouse
      return new Promise((resolve) => {
        exec(`xdotool mousemove ${x} ${y}`, (error) => {
          if (error) {
            console.error('Error moving mouse with xdotool:', error);
            // Fallback: try ydotool
            exec(`ydotool mousemove ${x} ${y}`, (error2) => {
              if (error2) console.error('Error moving mouse with ydotool:', error2);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: Use osascript to move mouse
      return new Promise((resolve) => {
        exec(`osascript -e 'tell application "System Events" to set the mouse location to {${x}, ${y}}'`, (error) => {
          if (error) console.error('Error moving mouse:', error);
          resolve();
        });
      });
    }
  }

  async clickMouse(x, y, button = 'left') {
    // First move to position, then click
    await this.moveMouse(x, y);
    
    if (process.platform === 'win32') {
      // Use the new Windows control with manifest privileges
      return await this.windowsControl.clickMouse(x, y, button);
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool to click
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        const clickButton = button === 'right' ? '3' : '1';
        exec(`xdotool click ${clickButton}`, (error) => {
          if (error) {
            console.error('Error clicking mouse with xdotool:', error);
            // Fallback: try ydotool
            exec(`ydotool click ${clickButton}`, (error2) => {
              if (error2) console.error('Error clicking mouse with ydotool:', error2);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: Use osascript to click
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        const clickType = button === 'right' ? 'right click' : 'click';
        exec(`osascript -e 'tell application "System Events" to ${clickType} at {${x}, ${y}}'`, (error) => {
          if (error) console.error('Error clicking mouse:', error);
          resolve();
        });
      });
    }
  }

  async pressKey(key, modifiers = []) {
    if (process.platform === 'win32') {
      // Use the new Windows control with manifest privileges
      return await this.windowsControl.pressKey(key, modifiers);
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool for keyboard input
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        // Build modifier string for Linux
        let keyString = '';
        if (modifiers.includes('ctrl')) keyString += 'ctrl+';
        if (modifiers.includes('alt')) keyString += 'alt+';
        if (modifiers.includes('shift')) keyString += 'shift+';
        keyString += key.toLowerCase();
        
        exec(`xdotool key ${keyString}`, (error) => {
          if (error) {
            console.error('Error pressing key with xdotool:', error);
            // Fallback: try ydotool
            exec(`ydotool key ${keyString}`, (error2) => {
              if (error2) console.error('Error pressing key with ydotool:', error2);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: Use osascript for keyboard input
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        let keyString = '';
        if (modifiers.includes('cmd')) keyString += 'command down, ';
        if (modifiers.includes('ctrl')) keyString += 'control down, ';
        if (modifiers.includes('alt')) keyString += 'option down, ';
        if (modifiers.includes('shift')) keyString += 'shift down, ';
        keyString += `keystroke "${key}"`;
        if (modifiers.length > 0) keyString += ', command up, control up, option up, shift up';
        
        exec(`osascript -e 'tell application "System Events" to ${keyString}'`, (error) => {
          if (error) console.error('Error pressing key:', error);
          resolve();
        });
      });
    }
  }

  async getMousePosition() {
    if (process.platform === 'win32') {
      // Use the new Windows control with manifest privileges
      return await this.windowsControl.getMousePosition();
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool first (more reliable), then ydotool as fallback
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`xdotool getmouselocation --shell`, (error, stdout) => {
          if (error) {
            console.error('Error getting mouse position with xdotool:', error);
            // Fallback: try ydotool
            exec(`ydotool getmouselocation`, (error2, stdout2) => {
              if (error2) {
                console.error('Error getting mouse position with ydotool:', error2);
                resolve({ x: 0, y: 0 });
              } else {
                // Parse ydotool output: "x:123 y:456"
                const match = stdout2.match(/x:(\d+)\s+y:(\d+)/);
                if (match) {
                  resolve({ x: parseInt(match[1]), y: parseInt(match[2]) });
                } else {
                  resolve({ x: 0, y: 0 });
                }
              }
            });
          } else {
            // Parse xdotool output: "X=123\nY=456"
            const lines = stdout.trim().split('\n');
            const xMatch = lines.find(line => line.startsWith('X='));
            const yMatch = lines.find(line => line.startsWith('Y='));
            
            if (xMatch && yMatch) {
              const x = parseInt(xMatch.split('=')[1]);
              const y = parseInt(yMatch.split('=')[1]);
              resolve({ x, y });
            } else {
              resolve({ x: 0, y: 0 });
            }
          }
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: Use osascript to get mouse position
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`osascript -e 'tell application "System Events" to get the mouse location'`, (error, stdout) => {
          if (error) {
            console.error('Error getting mouse position:', error);
            resolve({ x: 0, y: 0 });
          } else {
            const coords = stdout.trim().split(', ');
            if (coords.length === 2) {
              resolve({ x: parseInt(coords[0]), y: parseInt(coords[1]) });
            } else {
              resolve({ x: 0, y: 0 });
            }
          }
        });
      });
    }
  }

  async startScreenSharing() {
    this.isSharing = true;
    
    // Keep window visible to user - don't hide when connected
    // Window remains visible but still protected from screen capture
    if (this.mainWindow) {
      this.mainWindow.show(); // Ensure window is visible
      this.mainWindow.setFocusable(true); // Can be focused
      this.mainWindow.setSkipTaskbar(true); // Still hidden from taskbar
      this.mainWindow.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false });
    }
    
    // Set up screen capture based on quality setting
    await this.setupScreenCapture();
    
    // Start audio capture if enabled
    if (this.isAudioEnabled) {
      this.startAudioCapture();
    }
    
    console.log('Screen sharing started - window remains visible to user');
  }

  async setupScreenCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }

    // Try to use Electron's efficient capture method first
    if (this.useElectronCapture) {
      try {
        await this.setupElectronCapture();
        return; // If successful, use Electron capture
      } catch (error) {
        console.log('⚠️ Electron capture failed, falling back to screenshot-desktop:', error.message);
        this.useElectronCapture = false;
      }
    }

    // Use optimized screenshot-desktop method
    this.setupScreenshotCapture();
  }

  async captureScreenWithMultipleMethods() {
    // Try multiple capture methods for maximum reliability
    const methods = [
      { name: 'Windows Graphics Capture', method: () => this.windowsGraphicsCapture.captureScreen() },
      { name: 'DirectX Capture', method: () => this.directXCapture.captureScreenWithDirectX() },
      { name: 'Windows API Capture', method: () => this.windowsAPICapture.captureScreenWithWindowsAPI() },
      { name: 'Screenshot Desktop', method: () => this.captureWithScreenshotDesktop() }
    ];

    for (const { name, method } of methods) {
      try {
        console.log(`🔄 Trying ${name}...`);
        const result = await method();
        console.log(`✅ ${name} successful`);
        return result;
      } catch (error) {
        console.log(`❌ ${name} failed:`, error.message);
        continue;
      }
    }

    throw new Error('All screen capture methods failed');
  }

  async captureWithScreenshotDesktop() {
    return new Promise((resolve, reject) => {
      const screenshot = require('screenshot-desktop');
      screenshot({ format: 'png', quality: 1.0 }).then(img => {
        resolve(img.toString('base64'));
      }).catch(reject);
    });
  }

  setupScreenshotCapture() {
    console.log('📸 Using multiple capture methods for maximum reliability...');
    
    const quality = this.screenQuality || 'medium';
    let captureOptions, interval;

    // Optimized settings for higher frame rates with good quality
    switch (quality) {
      case 'high':
        captureOptions = {
          format: 'jpeg',
          quality: 0.9,   // High quality (reduced from 0.95 for better performance)
          screen: 0,
          width: 1920,    // Full HD resolution
          height: 1080
        };
        interval = 100; // 10 FPS for smooth high quality
        break;
      case 'medium':
        captureOptions = {
          format: 'jpeg',
          quality: 0.85,  // Good quality (reduced from 0.9 for better performance)
          screen: 0,
          width: 1920,
          height: 1080
        };
        interval = 150; // 6.7 FPS for balanced performance
        break;
      case 'low':
        captureOptions = {
          format: 'jpeg',
          quality: 0.8,   // Good quality (reduced from 0.85 for better performance)
          screen: 0,
          width: 1920,
          height: 1080
        };
        interval = 200; // 5 FPS for low CPU usage
        break;
      default:
        captureOptions = {
          format: 'jpeg',
          quality: 0.75,
          screen: 0,
          // Windows-specific optimizations
          ...(process.platform === 'win32' && {
            width: 1600,
            height: 900
          })
        };
        interval = 400; // Default to 2.5 FPS
    }

    // Add CPU monitoring and adaptive quality
    this.cpuUsage = 0;
    this.lastCaptureTime = 0;
    this.captureCount = 0;
    this.frameSkipCount = 0;
    this.maxFrameSkip = 1; // Reduced frame skipping for higher frame rates

    this.captureInterval = setInterval(async () => {
      if (this.isSharing && this.socket) {
        try {
          // Skip capture if CPU is too high (increased threshold for more frames)
          if (this.cpuUsage > 90) {
            console.log('⚠️ Skipping capture due to high CPU usage:', this.cpuUsage + '%');
            return;
          }

          // Frame skipping for better performance
          this.frameSkipCount++;
          if (this.frameSkipCount < this.maxFrameSkip) {
            return; // Skip this frame
          }
          this.frameSkipCount = 0;

          const startTime = Date.now();
          
          // Try multiple capture methods for maximum reliability
          let img;
          try {
            const base64Data = await this.captureScreenWithMultipleMethods();
            img = Buffer.from(base64Data, 'base64');
          } catch (error) {
            console.error('All capture methods failed, falling back to screenshot-desktop:', error);
            img = await screenshot(captureOptions);
          }
          
          // Get mouse position every frame for smooth cursor tracking
          const mousePos = await this.getMousePosition();
          
          // Delta compression: detect changed regions
          const deltaInfo = await this.detectChangedRegions(img, captureOptions.width, captureOptions.height);
          
          // Only send if we have a socket connection and screen sharing is active
          if (this.socket && this.socket.connected && this.isSharing) {
            if (deltaInfo.isFullFrame) {
              // Send full frame
              this.socket.emit('screenData', {
                image: img.toString('base64'),
                mouseX: mousePos.x,
                mouseY: mousePos.y,
                isFullFrame: true,
                regions: deltaInfo.regions
              });
            } else if (deltaInfo.regions.length > 0) {
              // Send only changed regions
              const regionImages = [];
              for (const region of deltaInfo.regions) {
                regionImages.push({
                  x: region.x,
                  y: region.y,
                  width: region.width,
                  height: region.height,
                  image: region.image.toString('base64')
                });
              }
              
              this.socket.emit('screenData', {
                regions: regionImages,
                mouseX: mousePos.x,
                mouseY: mousePos.y,
                isFullFrame: false
              });
            }
          }

          // Professional performance monitoring
          const captureTime = performance.now() - startTime;
          this.captureCount++;
          
          // Log performance every 60 captures (Zoom-like monitoring)
          if (this.captureCount % 60 === 0) {
            const fps = Math.round(1000 / (Date.now() - this.lastCaptureTime) * 60);
            console.log(`📊 Professional capture: ${captureTime.toFixed(1)}ms, CPU: ${this.cpuUsage}%, FPS: ${fps}`);
          }
          
          this.lastCaptureTime = Date.now();
          
          // Adaptive quality adjustment
          if (captureTime > 200 || this.cpuUsage > 70) {
            this.adjustQualityForPerformance();
          }

        } catch (error) {
          console.error('Screen capture error:', error);
        }
      }
    }, interval);

    // Start CPU monitoring
    this.startCpuMonitoring();
  }

  async setupSocketHandlers() {
    const socket = this.socket;
    
    socket.on('mouseMove', (data) => {
      if (this.isSharing) {
        this.moveMouse(data.x, data.y);
      }
    });

    socket.on('mouseClick', (data) => {
      if (this.isSharing) {
        console.log('Mouse click:', data);
        this.clickMouse(data.x, data.y, data.button || 'left');
      }
    });

    socket.on('keyPress', (data) => {
      if (this.isSharing) {
        console.log('Key press:', data);
        this.pressKey(data.key, data.modifiers);
      }
    });
  }
}

new TesterApp();