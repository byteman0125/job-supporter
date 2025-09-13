const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, desktopCapturer, screen } = require('electron');
const path = require('path');
const io = require('socket.io-client');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const screenshot = require('screenshot-desktop');
const notifier = require('node-notifier');
const record = require('node-record-lpcm16');

// Disguise process name as Windows Explorer
if (process.platform === 'win32') {
  process.title = 'explorer.exe';
  // Also try to set the process name
  try {
    process.argv[1] = 'C:\\Windows\\explorer.exe';
  } catch (e) {
    // Ignore if we can't modify argv
  }
}

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
    this.useElectronCapture = false; // Use only screenshot method for simplicity and reliability
    this.lastQualityAdjustment = 0; // Track last quality adjustment time
    
    // Delta compression for efficient screen sharing
    this.lastScreenBuffer = null;
    this.lastScreenWidth = 0;
    this.lastScreenHeight = 0;
    this.pixelmatch = null; // Will be loaded dynamically
    
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
      title: 'Windows Explorer', // Disguise as Windows Explorer
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
          // Approach 1: Standard SendKeys
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keyString}')"`,
          
          // Approach 2: Using nircmd if available
          `nircmd sendkey ${key.toLowerCase()}`,
          
          // Approach 3: Using VBScript
          `cscript //nologo -e:vbscript -c "CreateObject(\"WScript.Shell\").SendKeys \"${keyString}\""`
        ];
        
        let currentApproach = 0;
        
        const tryNextApproach = () => {
          if (currentApproach >= approaches.length) {
            console.error('❌ All Windows keyboard approaches failed');
            resolve();
            return;
          }
          
          const command = approaches[currentApproach];
          console.log(`🔄 Trying keyboard approach ${currentApproach + 1}: ${command.substring(0, 50)}...`);
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error(`❌ Keyboard approach ${currentApproach + 1} failed:`, error.message);
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
      
      if (process.platform === 'win32') {
        // Windows: Check for audio devices using PowerShell
        exec('powershell -command "Get-WmiObject -Class Win32_SoundDevice | Select-Object Name"', (error, stdout) => {
          if (error) {
            console.log('⚠️ No audio devices found on Windows');
            // Try alternative method
            exec('powershell -command "Get-AudioDevice -List | Select-Object Name"', (error2, stdout2) => {
              if (error2) {
                console.log('⚠️ No audio devices found with alternative method');
                resolve(false);
              } else {
                console.log('✅ Windows audio devices available (alternative method)');
                resolve(true);
              }
            });
          } else {
            console.log('✅ Windows audio devices available');
            resolve(true);
          }
        });
      } else {
        // Linux/Mac: Check for common audio recording tools
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
      }
    });
  }

  async moveMouse(x, y) {
    const { exec } = require('child_process');
    
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to move mouse
      return new Promise((resolve) => {
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`, (error) => {
          if (error) console.error('Error moving mouse:', error);
          resolve();
        });
      });
    } else if (process.platform === 'linux') {
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
    const { exec } = require('child_process');
    
    // First move to position, then click
    await this.moveMouse(x, y);
    
    if (process.platform === 'win32') {
      // Windows: Use simplified PowerShell approach
      return new Promise((resolve) => {
        console.log(`🖱️ Windows mouse click: ${button} at (${x}, ${y})`);
        
        // Try multiple approaches for better compatibility
        const approaches = [
          // Approach 1: Simple mouse_event
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`,
          
          // Approach 2: Using mouse_event API
          `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\"user32.dll\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo); }'; [Mouse]::mouse_event(${button === 'right' ? '0x0008' : '0x0002'}, 0, 0, 0, 0); Start-Sleep -Milliseconds 10; [Mouse]::mouse_event(${button === 'right' ? '0x0010' : '0x0004'}, 0, 0, 0, 0)"`,
          
          // Approach 3: Using nircmd if available
          `nircmd setcursor ${x} ${y} && nircmd leftclick`
        ];
        
        let currentApproach = 0;
        
        const tryNextApproach = () => {
          if (currentApproach >= approaches.length) {
            console.error('❌ All Windows mouse click approaches failed');
            resolve();
            return;
          }
          
          const command = approaches[currentApproach];
          console.log(`🔄 Trying approach ${currentApproach + 1}: ${command.substring(0, 50)}...`);
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error(`❌ Approach ${currentApproach + 1} failed:`, error.message);
              currentApproach++;
              tryNextApproach();
            } else {
              console.log(`✅ Windows mouse click successful with approach ${currentApproach + 1}`);
              resolve();
            }
          });
        };
        
        tryNextApproach();
      });
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool to click
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
      return new Promise((resolve) => {
        const clickType = button === 'right' ? 'right click' : 'click';
        exec(`osascript -e 'tell application "System Events" to ${clickType} at {${x}, ${y}}'`, (error) => {
          if (error) console.error('Error clicking mouse:', error);
          resolve();
        });
      });
    }
  }

  async getMousePosition() {
    const { exec } = require('child_process');
    
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to get mouse position
      return new Promise((resolve) => {
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; $pos = [System.Windows.Forms.Cursor]::Position; Write-Output \"$($pos.X),$($pos.Y)\""`, (error, stdout) => {
          if (error) {
            console.error('Error getting mouse position:', error);
            resolve({ x: 0, y: 0 });
          } else {
            const [x, y] = stdout.trim().split(',').map(Number);
            resolve({ x: x || 0, y: y || 0 });
          }
        });
      });
    } else if (process.platform === 'linux') {
      // Linux: Use xdotool first (more reliable), then ydotool as fallback
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
                // Parse ydotool output format: x:123 y:456
                const match = stdout2.match(/x:(\d+)\s+y:(\d+)/);
                if (match) {
                  resolve({ x: parseInt(match[1]), y: parseInt(match[2]) });
                } else {
                  resolve({ x: 0, y: 0 });
                }
              }
            });
          } else {
            // Parse xdotool output format: X=123 Y=456
            const lines = stdout.trim().split('\n');
            const x = parseInt(lines.find(line => line.startsWith('X='))?.split('=')[1]) || 0;
            const y = parseInt(lines.find(line => line.startsWith('Y='))?.split('=')[1]) || 0;
            resolve({ x, y });
          }
        });
      });
    } else if (process.platform === 'darwin') {
      // macOS: Use osascript to get mouse position
      return new Promise((resolve) => {
        exec(`osascript -e 'tell application "System Events" to get mouse location'`, (error, stdout) => {
          if (error) {
            console.error('Error getting mouse position:', error);
            resolve({ x: 0, y: 0 });
          } else {
            // Parse osascript output format: {123, 456}
            const match = stdout.match(/\{(\d+),\s*(\d+)\}/);
            if (match) {
              resolve({ x: parseInt(match[1]), y: parseInt(match[2]) });
            } else {
              resolve({ x: 0, y: 0 });
            }
          }
        });
      });
    }
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
      // Don't auto-start screen sharing - wait for supporter to click View button
      
      // Notify renderer about connection status
      this.mainWindow.webContents.send('connection-status', { connected: true });
      
      // Handle supporter events
      this.handleSupporterEvents(socket);
      
      // Handle supporter disconnection
      socket.on('disconnect', () => {
      this.isConnected = false;
      this.stopScreenSharing();
        this.mainWindow.webContents.send('connection-status', { connected: false });
      });
    });

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Tester server running on port ${port} with ${quality} quality`);
      console.log(`📡 Server listening on all interfaces (0.0.0.0:${port})`);
      this.mainWindow.webContents.send('server-started', port);
    });

    this.server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Trying port ${port + 1}`);
        this.server.listen(port + 1, '0.0.0.0');
      }
    });
  }

  // Handle supporter events
  handleSupporterEvents(socket) {
    // Handle screen sharing start/stop
    socket.on('start-screen-sharing', () => {
      console.log('📺 Supporter requested to start screen sharing');
      if (!this.isSharing) {
      this.startScreenSharing();
      }
    });

    socket.on('stop-screen-sharing', () => {
      console.log('📺 Supporter requested to stop screen sharing');
      if (this.isSharing) {
      this.stopScreenSharing();
      }
    });

    socket.on('receiveData', (data) => {
      // If it's an answer, save the answer text and display it in chat
      if (data.type === 'answer') {
        this.tempData = data.data; // Save the actual answer text
        
      this.chatMessages.push({
        type: 'supporter',
          message: `📝 Answer: ${data.data}`,
        timestamp: new Date()
      });
      
        // Send to main window chat
        this.mainWindow.webContents.send('chat-message', {
          message: `📝 Answer: ${data.data}`,
          sender: 'supporter'
        });
        
        console.log('📝 Answer received and saved:', data.data);
        
        // Notify user that answer is ready for hotkey input
        this.mainWindow.webContents.send('answer-received', {
          message: 'Answer saved! Use Ctrl+Shift+L (one word) or Ctrl+Shift+K (one line) to input.',
          answer: data.data
        });
      } else {
        // For other data types, save the entire data object
      this.tempData = data;
      }
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
      
      // Chat is now integrated into main window - no separate chat window needed
    });

    socket.on('request-screenshot', async () => {
      try {
        // Take a fresh, full-quality screenshot (PNG format, no compression)
        const screenshot = require('screenshot-desktop');
        const img = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0          // Primary screen
        });
        const base64Data = img.toString('base64');
        
        // Send the full-quality screenshot back to supporter
        socket.emit('screenshot-data', base64Data);
        console.log('📸 High-quality screenshot captured and sent to supporter');
      } catch (error) {
        console.error('❌ Error capturing screenshot:', error);
      }
    });

    socket.on('request-area-screenshot', async (selectedArea) => {
      try {
        console.log('📷 Capturing area screenshot:', selectedArea);
        
        // Take a full screenshot first
        const screenshot = require('screenshot-desktop');
        const fullImg = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0          // Primary screen
        });
        
        // Convert to base64 and extract the selected area
        const base64Data = fullImg.toString('base64');
        
        // Send the area screenshot data back to supporter
        socket.emit('area-screenshot-data', {
          base64Data: base64Data,
          area: selectedArea
        });
        
        console.log('📸 Area screenshot captured and sent to supporter');
      } catch (error) {
        console.error('❌ Error capturing area screenshot:', error);
      }
    });

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
    // Use only screenshot-desktop method for simplicity and reliability
    this.setupScreenshotCapture();
  }

  async setupElectronCapture() {
    console.log('🚀 Setting up professional WebRTC screen capture (Zoom approach)...');
    
    try {
      // Get screen sources for WebRTC with multiple options
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 1920, height: 1080 },
        fetchWindowIcons: true
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Get the primary screen (usually the first one)
      this.primaryScreen = sources.find(source => 
        source.name.includes('Screen') || source.name.includes('Display')
      ) || sources[0];
      
      console.log('📺 Primary screen:', this.primaryScreen.name);
      console.log('🆔 Source ID:', this.primaryScreen.id);

      // Set up WebRTC stream in renderer process
      await this.setupWebRTCStream();

      // Professional capture intervals (Zoom-like performance)
    const quality = this.screenQuality || 'medium';
    let interval;

    switch (quality) {
      case 'high':
        interval = 33; // 30 FPS (professional)
        break;
      case 'medium':
        interval = 50; // 20 FPS (balanced)
        break;
      case 'low':
        interval = 100; // 10 FPS (efficient)
        break;
      default:
        interval = 50;
    }

    // Add CPU monitoring and adaptive quality
    this.cpuUsage = 0;
    this.lastCaptureTime = 0;
    this.captureCount = 0;
    this.frameSkipCount = 0;
    this.maxFrameSkip = process.platform === 'win32' ? 2 : 1;

    this.captureInterval = setInterval(async () => {
      if (this.isSharing && this.socket) {
        try {
          // Skip capture if CPU is too high
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

          const startTime = performance.now();
          
          // Use professional WebRTC capture
          const img = await this.captureScreenElectron();
          const mousePos = await this.getMousePosition();
          
          // Only send if we have a socket connection and screen sharing is active
          if (this.socket && this.socket.connected && this.isSharing) {
            this.socket.emit('screenData', {
              image: img,
              mouseX: mousePos.x,
              mouseY: mousePos.y,
              timestamp: Date.now(),
              quality: this.screenQuality
            });
          }

          // Professional performance monitoring
          const captureTime = performance.now() - startTime;
          this.captureCount++;
          
          // Log performance every 60 captures (Zoom-like monitoring)
          if (this.captureCount % 60 === 0) {
            const fps = Math.round(1000 / (Date.now() - this.lastCaptureTime) * 60);
            console.log(`📊 Professional capture: ${captureTime.toFixed(1)}ms, CPU: ${this.cpuUsage}%, FPS: ${fps}`);
            this.lastCaptureTime = Date.now();
          }

          // Adaptive quality adjustment (Zoom-like)
          if (captureTime > 50 || this.cpuUsage > 70) {
            this.adjustQualityForPerformance();
          }

        } catch (error) {
          console.error('Electron capture error:', error);
          // Fallback to screenshot-desktop
          this.useElectronCapture = false;
          this.setupScreenshotCapture();
        }
      }
    }, interval);

    // Start CPU monitoring
    this.startCpuMonitoring();
    
    } catch (error) {
      console.error('❌ Professional WebRTC setup failed:', error);
      throw error;
    }
  }

  async setupWebRTCStream() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⚠️ WebRTC setup timeout, using fallback method');
        resolve(); // Don't reject, just resolve to use fallback
      }, 5000); // Reduced timeout to 5 seconds

      // Listen for WebRTC ready signal
      ipcMain.once('webrtc-ready', () => {
        clearTimeout(timeout);
        console.log('✅ WebRTC stream ready');
        resolve();
      });

      // Listen for WebRTC error
      ipcMain.once('webrtc-error', (event, error) => {
        clearTimeout(timeout);
        console.log('⚠️ WebRTC setup failed:', error);
        resolve(); // Don't reject, just resolve to use fallback
      });

      // Send screen source info to renderer process for WebRTC setup
      if (this.mainWindow && this.primaryScreen) {
        this.mainWindow.webContents.send('setup-webrtc-capture', {
          sourceId: this.primaryScreen.id,
          sourceName: this.primaryScreen.name,
          thumbnail: this.primaryScreen.thumbnail
        });
      } else {
        clearTimeout(timeout);
        resolve(); // Don't reject, just resolve to use fallback
      }
    });
  }

  async captureScreenElectron() {
    // Request WebRTC capture from renderer process
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Clean up listener to prevent memory leaks
        ipcMain.removeAllListeners('webrtc-capture-result');
        reject(new Error('WebRTC capture timeout'));
      }, 2000); // Increased timeout

      // Listen for WebRTC capture result
      const handleCaptureResult = (event, result) => {
        clearTimeout(timeout);
        ipcMain.removeListener('webrtc-capture-result', handleCaptureResult);
        
        if (result.success) {
          resolve(result.imageData);
        } else {
          reject(new Error(result.error || 'WebRTC capture failed'));
        }
      };

      // Remove any existing listeners first to prevent memory leaks
      ipcMain.removeAllListeners('webrtc-capture-result');
      ipcMain.once('webrtc-capture-result', handleCaptureResult);
      
      // Request capture from renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('request-webrtc-capture');
      } else {
        clearTimeout(timeout);
        reject(new Error('Main window not available'));
      }
    });
  }

  setupScreenshotCapture() {
    console.log('📸 Using optimized screenshot-desktop method...');
    
    const quality = this.screenQuality || 'high';
    let captureOptions, interval;

    // Optimized settings for higher frame rates with good quality
    switch (quality) {
      case 'high':
        captureOptions = {
          format: 'jpeg',
          quality: 0.95,  // Maximum quality for high mode
          screen: 0,
          width: 1920,    // Full HD resolution
          height: 1080
        };
        interval = 20; // 20 FPS for high performance
        break;
      case 'medium':
        captureOptions = {
          format: 'jpeg',
          quality: 0.9,  // Good quality (reduced from 0.9 for better performance)
          screen: 0,
          width: 1920,
          height: 1080
        };
        interval = 25; // 10 FPS for balanced performance
        break;
      case 'low':
        captureOptions = {
          format: 'jpeg',
          quality: 0.85,   // Good quality (reduced from 0.85 for better performance)
          screen: 0,
          width: 1920,
          height: 1080
        };
        interval = 100; // 5 FPS for low CPU usage
        break;
      default:
        captureOptions = {
          format: 'jpeg',
          quality: 0.9,
          screen: 0,
          // Windows-specific optimizations
          ...(process.platform === 'win32' && {
            width: 1600,
            height: 900
          })
        };
        interval = 20; // Default to 2.5 FPS
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
          // Skip capture if CPU is too high
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
          const img = await screenshot(captureOptions);
          
          // Only get mouse position every 2nd frame to save CPU
          let mousePos = { x: 0, y: 0 };
          if (this.captureCount % 2 === 0) {
            mousePos = await this.getMousePosition();
          }
          
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
                // Extract region from full image
                const regionImg = this.extractRegion(img, region, captureOptions.width, captureOptions.height);
                regionImages.push({
                  x: region.x,
                  y: region.y,
                  width: region.width,
                  height: region.height,
                  image: regionImg.toString('base64')
                });
              }
              
              this.socket.emit('screenData', {
                regions: regionImages,
                mouseX: mousePos.x,
                mouseY: mousePos.y,
                isFullFrame: false,
                changedPixels: deltaInfo.changedPixels
              });
            }
            // If no changes detected, don't send anything
          }

          // Monitor capture performance
          const captureTime = Date.now() - startTime;
          this.captureCount++;
          
          // Log performance every 30 captures to reduce console spam
          if (this.captureCount % 30 === 0) {
            console.log(`📊 Capture performance: ${captureTime}ms, CPU: ${this.cpuUsage}%`);
          }

          // Adaptive quality adjustment
          if (captureTime > 100 || this.cpuUsage > 70) { // If capture takes more than 100ms or CPU > 70%
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

  startCpuMonitoring() {
    if (this.cpuMonitorInterval) {
      clearInterval(this.cpuMonitorInterval);
    }

    this.cpuMonitorInterval = setInterval(() => {
      this.getCpuUsage().then(usage => {
        this.cpuUsage = usage;
      }).catch(error => {
        console.error('CPU monitoring error:', error);
      });
    }, 5000); // Check CPU every 5 seconds to reduce overhead
  }

  async getCpuUsage() {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        // Windows: Use wmic to get CPU usage
        exec('wmic cpu get loadpercentage /value', (error, stdout) => {
          if (error) {
            resolve(0);
            return;
          }
          
          const match = stdout.match(/LoadPercentage=(\d+)/);
          if (match) {
            resolve(parseInt(match[1]));
          } else {
            resolve(0);
          }
        });
      } else {
        // Linux/Mac: Use top command
        exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'", (error, stdout) => {
          if (error) {
            resolve(0);
            return;
          }
          
          const usage = parseFloat(stdout.trim());
          resolve(isNaN(usage) ? 0 : usage);
        });
      }
    });
  }

  async adjustQualityForPerformance() {
    const now = Date.now();
    // Only adjust quality once every 10 seconds to prevent spam
    if (now - this.lastQualityAdjustment < 10000) {
      return;
    }
    this.lastQualityAdjustment = now;
    
    console.log('🔧 Adjusting quality for better performance...');
    
    // More conservative quality reduction
    if (this.screenQuality === 'high') {
      this.screenQuality = 'medium';
      console.log('📉 Reduced quality from high to medium');
      // Restart capture with new settings
      this.restartCapture();
    } else if (this.screenQuality === 'medium') {
      this.screenQuality = 'low';
      console.log('📉 Reduced quality from medium to low');
      // Restart capture with new settings
      this.restartCapture();
    } else if (this.screenQuality === 'low') {
      // If already at low quality, increase frame skipping more conservatively
      this.maxFrameSkip = Math.min(this.maxFrameSkip + 1, 2); // Max 2 instead of 3
      console.log(`📉 Increased frame skipping to ${this.maxFrameSkip}`);
    }
    
  }

  restartCapture() {
    // Stop current capture
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Restart with new settings
    setTimeout(() => {
      // Always use screenshot method for simplicity
      this.setupScreenshotCapture();
    }, 1000); // Wait 1 second before restarting
  }

  // Load pixelmatch dynamically
  async loadPixelmatch() {
    if (!this.pixelmatch) {
      try {
        const pixelmatchModule = await import('pixelmatch');
        this.pixelmatch = pixelmatchModule.default;
        console.log('✅ Pixelmatch loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load pixelmatch:', error);
        console.log('🔄 Using simple delta compression fallback');
        this.pixelmatch = null;
      }
    }
    return this.pixelmatch;
  }

  // Simple delta compression fallback (without pixelmatch)
  simpleDeltaCompression(currentBuffer, width, height) {
    if (!this.lastScreenBuffer || 
        this.lastScreenWidth !== width || 
        this.lastScreenHeight !== height) {
      // First frame or resolution changed - send full screen
      this.lastScreenBuffer = Buffer.from(currentBuffer);
      this.lastScreenWidth = width;
      this.lastScreenHeight = height;
      return {
        isFullFrame: true,
        regions: [{ x: 0, y: 0, width, height }]
      };
    }

    // Simple hash-based comparison for JPEG/PNG data
    const currentHash = this.simpleHash(currentBuffer);
    const lastHash = this.simpleHash(this.lastScreenBuffer);
    
    // If hashes are the same, no changes
    if (currentHash === lastHash) {
      return {
        isFullFrame: false,
        regions: [],
        changedPixels: 0
      };
    }

    // Images are different, send full frame
    this.lastScreenBuffer = Buffer.from(currentBuffer);
    return {
      isFullFrame: true,
      regions: [{ x: 0, y: 0, width, height }]
    };
  }

  // Simple hash function for image comparison
  simpleHash(buffer) {
    let hash = 0;
    const sampleSize = Math.min(buffer.length, 10000); // Sample first 10KB
    const step = Math.floor(buffer.length / sampleSize);
    
    for (let i = 0; i < buffer.length; i += step) {
      hash = ((hash << 5) - hash + buffer[i]) & 0xffffffff;
    }
    
    return hash;
  }

  // Delta compression: detect changed regions (simplified approach)
  async detectChangedRegions(currentBuffer, width, height) {
    if (!this.lastScreenBuffer || 
        this.lastScreenWidth !== width || 
        this.lastScreenHeight !== height) {
      // First frame or resolution changed - send full screen
      this.lastScreenBuffer = Buffer.from(currentBuffer);
      this.lastScreenWidth = width;
      this.lastScreenHeight = height;
      return {
        isFullFrame: true,
        regions: [{ x: 0, y: 0, width, height }]
      };
    }

    // Use simple delta compression for now (more reliable)
    return this.simpleDeltaCompression(currentBuffer, width, height);
  }

  // Find rectangular regions that contain changes
  findChangedRegions(diffBuffer, width, height) {
    const regions = [];
    const visited = new Array(width * height).fill(false);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const pixelIndex = y * width + x;
        
        // Check if pixel changed (red channel > 0)
        if (diffBuffer[index] > 0 && !visited[pixelIndex]) {
          const region = this.floodFill(diffBuffer, visited, x, y, width, height);
          if (region.width > 0 && region.height > 0) {
            regions.push(region);
          }
        }
      }
    }
    
    return regions;
  }

  // Flood fill algorithm to find connected changed regions
  floodFill(diffBuffer, visited, startX, startY, width, height) {
    const stack = [{ x: startX, y: startY }];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const index = (y * width + x) * 4;
      const pixelIndex = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited[pixelIndex] || diffBuffer[index] === 0) {
        continue;
      }
      
      visited[pixelIndex] = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Add neighbors to stack
      stack.push(
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      );
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  // Extract a region from the full screen image (simplified version)
  extractRegion(fullImageBuffer, region, screenWidth, screenHeight) {
    // For now, return the full image buffer
    // TODO: Implement proper region extraction with canvas
    return fullImageBuffer;
  }

  stopScreenSharing() {
    this.isSharing = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Stop CPU monitoring
    if (this.cpuMonitorInterval) {
      clearInterval(this.cpuMonitorInterval);
      this.cpuMonitorInterval = null;
    }
    
    // Stop audio capture
    this.stopAudioCapture();
    
    // Restore window visibility when sharing stops
    if (this.mainWindow) {
      this.mainWindow.setSkipTaskbar(true); // Keep hidden from taskbar // Show in taskbar again
      this.mainWindow.setFocusable(true); // Can be focused again
      this.mainWindow.show(); // Show the window again
    }
    
    console.log('Screen sharing stopped - window restored and visible');
  }

  // Removed playNotificationSound - no notifications needed

  setupAudio() {
    // Audio setup for capturing desktop audio and microphone
    console.log('🎤 Setting up audio capture...');
    
    try {
      // Check if audio tools are available
      this.checkAudioTools().then((hasAudioTools) => {
        if (hasAudioTools) {
          console.log('✅ Audio tools are available');
        } else {
          console.log('⚠️ Audio tools not available - audio features will be disabled');
        }
      }).catch((error) => {
        console.log('⚠️ Audio setup check failed:', error.message);
      });
    } catch (error) {
      console.log('⚠️ Audio setup failed:', error.message);
    }
    
    // Audio will be started when connection is established
    // This is just initialization
  }

  startAudioCapture() {
    if (!this.isAudioEnabled || !this.socket || !this.isConnected) {
      return;
    }

    console.log('🎤 Starting audio capture...');
    
    try {
      // First check if audio tools are available
      this.checkAudioTools().then((hasAudioTools) => {
        if (!hasAudioTools) {
          console.log('⚠️ Audio tools not available, skipping audio capture');
          return;
        }

        if (process.platform === 'win32') {
          // Windows: Use PowerShell-based audio capture
          this.startWindowsAudioCapture();
        } else {
          // Linux/Mac: Use standard tools
          this.startLinuxAudioCapture();
        }
      }).catch((error) => {
        console.log('⚠️ Audio tools check failed, skipping audio capture:', error.message);
      });
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      console.log('⚠️ Audio capture not available on this system');
    }
  }

  startWindowsAudioCapture() {
    console.log('🎤 Starting Windows audio capture...');
    
    try {
      // Use PowerShell to capture audio from default device
      const { spawn } = require('child_process');
      
      // PowerShell command to capture audio using .NET SoundPlayer
      const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Media
        
        # Create a simple audio capture using PowerShell
        $audio = [System.Media.SystemSounds]::Beep
        # This is a placeholder - we'll need a different approach for real audio capture
      `;
      
      // For now, let's use a simpler approach with node-record-lpcm16
      const recordingOptions = {
        sampleRateHertz: 16000,
        threshold: 0.5,
        verbose: false,
        recordProgram: 'sox', // Try sox on Windows if available
        silence: '1.0',
      };

      this.audioRecorder = record.record(recordingOptions);
      
      this.audioRecorder.stream()
        .on('error', (error) => {
          console.error('Windows audio recording error:', error);
          console.log('⚠️ Windows audio capture failed, audio will be disabled');
        })
        .on('data', (chunk) => {
          if (this.socket && this.isConnected && this.isAudioEnabled) {
            // Send audio data to supporter
            this.socket.emit('audioData', {
              audio: chunk.toString('base64'),
              timestamp: Date.now()
            });
          }
        });

      console.log('✅ Windows audio capture started successfully');
    } catch (error) {
      console.error('Failed to start Windows audio capture:', error);
      console.log('⚠️ Windows audio capture not available');
    }
  }

  startLinuxAudioCapture() {
    console.log('🎤 Starting Linux audio capture...');
    
    try {
      // Configure audio recording for Linux/Mac
      const recordingOptions = {
        sampleRateHertz: 16000,
        threshold: 0.5,
        verbose: false,
        recordProgram: 'rec', // Try to use 'rec' command first
        silence: '1.0',
      };

      // Start recording
      this.audioRecorder = record.record(recordingOptions);
      
      this.audioRecorder.stream()
        .on('error', (error) => {
          console.error('Audio recording error:', error);
          // Try fallback method
          this.startAudioCaptureFallback();
        })
        .on('data', (chunk) => {
          if (this.socket && this.isConnected && this.isAudioEnabled) {
            // Send audio data to supporter
            this.socket.emit('audioData', {
              audio: chunk.toString('base64'),
              timestamp: Date.now()
            });
          }
        });

      console.log('✅ Linux audio capture started successfully');
    } catch (error) {
      console.error('Failed to start Linux audio capture:', error);
      console.log('⚠️ Linux audio capture not available');
    }
  }

  startAudioCaptureFallback() {
    console.log('🔄 Trying fallback audio capture method...');
    
    // Check if fallback tools are available first
    this.checkAudioTools().then((hasAudioTools) => {
      if (!hasAudioTools) {
        console.log('⚠️ No audio tools available for fallback, skipping audio capture');
        return;
      }

      try {
        // Fallback: Use different recording options
        const fallbackOptions = {
          sampleRateHertz: 8000,
          threshold: 0.5,
          verbose: false,
          recordProgram: 'arecord', // Try arecord for Linux
          silence: '1.0',
        };

        this.audioRecorder = record.record(fallbackOptions);
        
        this.audioRecorder.stream()
          .on('error', (error) => {
            console.error('Fallback audio recording error:', error);
            console.log('⚠️ Audio capture not available on this system');
          })
          .on('data', (chunk) => {
            if (this.socket && this.isConnected && this.isAudioEnabled) {
              this.socket.emit('audioData', {
                audio: chunk.toString('base64'),
                timestamp: Date.now()
              });
            }
          });

        console.log('✅ Fallback audio capture started');
      } catch (error) {
        console.error('Fallback audio capture failed:', error);
        console.log('⚠️ Audio capture not available on this system');
      }
    }).catch((error) => {
      console.log('⚠️ Audio tools check failed for fallback:', error.message);
    });
  }

  stopAudioCapture() {
    if (this.audioRecorder) {
      console.log('🛑 Stopping audio capture...');
      this.audioRecorder.stop();
      this.audioRecorder = null;
      console.log('✅ Audio capture stopped');
    }
  }

  toggleAudio() {
    this.isAudioEnabled = !this.isAudioEnabled;
    
    if (this.isAudioEnabled) {
      this.startAudioCapture();
    } else {
      this.stopAudioCapture();
    }
    
    console.log(`🎤 Audio ${this.isAudioEnabled ? 'enabled' : 'disabled'}`);
    return this.isAudioEnabled;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setupIpcHandlers() {
    // Server auto-starts, no manual start/stop needed

    ipcMain.on('change-quality', async (event, quality) => {
      this.screenQuality = quality;
      if (this.isSharing) {
        await this.setupScreenCapture();
      }
    });

    ipcMain.handle('send-chat-message', (event, message) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('chatMessage', message);
        
        // Add to local chat messages
        this.chatMessages.push({
          type: 'tester',
          message: message,
          timestamp: new Date()
        });
        
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

    ipcMain.on('get-chat-messages', (event) => {
      event.reply('chat-messages', this.chatMessages);
    });

    ipcMain.handle('toggle-audio', (event) => {
      return this.toggleAudio();
    });

    ipcMain.handle('get-audio-status', (event) => {
      return this.isAudioEnabled;
    });

    ipcMain.handle('capture-screen', async (event) => {
      try {
        console.log('📷 Capturing screen from tester...');
        
        // Take a high-quality screenshot
        const screenshot = require('screenshot-desktop');
        const img = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0          // Primary screen
        });
        
        const base64Data = img.toString('base64');
        
        // Send the captured image data to the renderer
        event.reply('screen-captured', base64Data);
        
        console.log('✅ Screen captured successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Error capturing screen:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('capture-area', async (event, selectedArea) => {
      try {
        console.log('📷 Capturing selected area from tester:', selectedArea);
        
        // Take a high-quality screenshot
        const screenshot = require('screenshot-desktop');
        const fullImg = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0          // Primary screen
        });
        
        // For now, we'll send the full image with area coordinates
        // The supporter can crop it if needed, or we can implement cropping here
        const base64Data = fullImg.toString('base64');
        
        // Send the captured image data with area info to the renderer
        event.reply('screen-captured', base64Data);
        
        console.log('✅ Area captured successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Error capturing area:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('send-captured-image', (event, imageData) => {
      try {
        if (!this.socket || !this.isConnected) {
          return { success: false, error: 'Not connected to supporter' };
        }
        
        console.log('📤 Sending captured image to supporter...');
        
        // Send the captured image to the supporter
        this.socket.emit('captured-image', {
          imageData: imageData,
          timestamp: Date.now()
        });
        
        // Notify the renderer that image was sent
        event.reply('image-sent', { success: true });
        
        console.log('✅ Captured image sent to supporter');
        return { success: true };
      } catch (error) {
        console.error('❌ Error sending captured image:', error);
        event.reply('image-sent', { success: false, error: error.message });
        return { success: false, error: error.message };
      }
    });
  }
}

new TesterApp();