const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, desktopCapturer, screen } = require('electron');
const path = require('path');
const io = require('socket.io-client');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const screenshot = require('screenshot-desktop');
const notifier = require('node-notifier');
const record = require('node-record-lpcm16');

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
    this.useElectronCapture = true; // Use Electron's efficient capture method
    
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
        // Build modifier string for Windows
        let keyString = '';
        if (modifiers.includes('ctrl')) keyString += '^';
        if (modifiers.includes('alt')) keyString += '%';
        if (modifiers.includes('shift')) keyString += '+';
        keyString += key;
        
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keyString}')"`, (error) => {
          if (error) console.error('Error pressing key:', error);
          resolve();
        });
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
      // Windows: Use PowerShell with proper mouse_event API
      return new Promise((resolve) => {
        const mouseDown = button === 'right' ? '0x0008' : '0x0002'; // MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN
        const mouseUp = button === 'right' ? '0x0010' : '0x0004';   // MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP
        
        const psScript = `
          Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            public class Mouse {
              [DllImport("user32.dll")]
              public static extern bool SetCursorPos(int x, int y);
              [DllImport("user32.dll")]
              public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);
            }
"@
          [Mouse]::SetCursorPos(${x}, ${y})
          Start-Sleep -Milliseconds 10
          [Mouse]::mouse_event(${mouseDown}, 0, 0, 0, 0)
          Start-Sleep -Milliseconds 10
          [Mouse]::mouse_event(${mouseUp}, 0, 0, 0, 0)
        `;
        
        exec(`powershell -command "${psScript}"`, (error) => {
          if (error) {
            console.error('Error clicking mouse:', error);
            // Fallback: try simple SendKeys approach
            const clickKey = button === 'right' ? '{F10}' : '{ENTER}';
            exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('${clickKey}')"`, (error2) => {
              if (error2) console.error('Error with SendKeys fallback:', error2);
              resolve();
            });
          } else {
            resolve();
          }
        });
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
      // Linux: Use xdotool to get mouse position
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
                // Parse ydotool output format
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
            const match = stdout.match(/X=(\d+)\s+Y=(\d+)/);
            if (match) {
              resolve({ x: parseInt(match[1]), y: parseInt(match[2]) });
            } else {
              resolve({ x: 0, y: 0 });
            }
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
      this.startScreenSharing();
      
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

    this.server.listen(port, () => {
      console.log(`Tester server running on port ${port} with ${quality} quality`);
      this.mainWindow.webContents.send('server-started', port);
    });
  }

  // Handle supporter events
  handleSupporterEvents(socket) {
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
        console.log('Mouse move:', data);
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
    if (this.useElectronCapture) {
      try {
        await this.setupElectronCapture();
        return; // If successful, use Electron capture
      } catch (error) {
        console.log('⚠️ Electron capture failed, falling back to screenshot-desktop:', error.message);
        this.useElectronCapture = false;
      }
    }

    // Fallback to screenshot-desktop method
    this.setupScreenshotCapture();
  }

  async setupElectronCapture() {
    console.log('🚀 Setting up WebRTC screen capture...');
    
    // Get screen sources for WebRTC
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }

    // Get the primary screen
    this.primaryScreen = sources[0];
    console.log('📺 Using screen source:', this.primaryScreen.name);

    // Set up WebRTC stream in renderer process
    await this.setupWebRTCStream();

    // Set up capture with different intervals based on quality
    const quality = this.screenQuality || 'medium';
    let interval;

    switch (quality) {
      case 'high':
        interval = 200; // 5 FPS
        break;
      case 'medium':
        interval = 300; // 3.3 FPS
        break;
      case 'low':
        interval = 500; // 2 FPS
        break;
      default:
        interval = 300;
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
          if (this.cpuUsage > 80) {
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
          
          // Use Electron's efficient capture
          const img = await this.captureScreenElectron();
          const mousePos = await this.getMousePosition();
          
          // Only send if we have a socket connection
          if (this.socket && this.socket.connected) {
            this.socket.emit('screenData', {
              image: img,
              mouseX: mousePos.x,
              mouseY: mousePos.y
            });
          }

          // Monitor capture performance
          const captureTime = Date.now() - startTime;
          this.captureCount++;
          
          // Log performance every 10 captures
          if (this.captureCount % 10 === 0) {
            console.log(`📊 Electron capture performance: ${captureTime}ms, CPU: ${this.cpuUsage}%`);
          }

          // Adaptive quality adjustment
          if (captureTime > 100 || this.cpuUsage > 70) {
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
  }

  async setupWebRTCStream() {
    // Send screen source info to renderer process for WebRTC setup
    if (this.mainWindow && this.primaryScreen) {
      this.mainWindow.webContents.send('setup-webrtc-capture', {
        sourceId: this.primaryScreen.id,
        sourceName: this.primaryScreen.name
      });
    }
  }

  async captureScreenElectron() {
    // Request WebRTC capture from renderer process
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebRTC capture timeout'));
      }, 1000);

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
    console.log('📸 Using screenshot-desktop fallback method...');
    
    const quality = this.screenQuality || 'medium';
    let captureOptions, interval;

    // Optimized settings for Windows with much lower CPU usage
    switch (quality) {
      case 'high':
        captureOptions = {
          format: 'jpeg', // Use JPEG even for high quality (much faster)
          quality: 0.85,  // Reduced from 1.0 to 0.85
          screen: 0,
          // Windows-specific optimizations
          ...(process.platform === 'win32' && {
            width: 1920,  // Limit resolution for better performance
            height: 1080
          })
        };
        interval = 250; // Reduced from 100ms to 250ms (4 FPS instead of 10 FPS)
        break;
      case 'medium':
        captureOptions = {
          format: 'jpeg',
          quality: 0.75,  // Reduced from 0.9 to 0.75
          screen: 0,
          // Windows-specific optimizations
          ...(process.platform === 'win32' && {
            width: 1600,  // Lower resolution for medium quality
            height: 900
          })
        };
        interval = 400; // Reduced from 125ms to 400ms (2.5 FPS instead of 8 FPS)
        break;
      case 'low':
        captureOptions = {
          format: 'jpeg',
          quality: 0.6,   // Reduced from 0.7 to 0.6
          screen: 0,
          // Windows-specific optimizations
          ...(process.platform === 'win32' && {
            width: 1280,  // Even lower resolution for low quality
            height: 720
          })
        };
        interval = 600; // Reduced from 200ms to 600ms (1.7 FPS instead of 5 FPS)
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
    this.maxFrameSkip = process.platform === 'win32' ? 2 : 1; // Skip more frames on Windows

    this.captureInterval = setInterval(async () => {
      if (this.isSharing && this.socket) {
        try {
          // Skip capture if CPU is too high
          if (this.cpuUsage > 80) {
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
          const mousePos = await this.getMousePosition();
          
          // Only send if we have a socket connection
          if (this.socket && this.socket.connected) {
            this.socket.emit('screenData', {
              image: img.toString('base64'),
              mouseX: mousePos.x,
              mouseY: mousePos.y
            });
          }

          // Monitor capture performance
          const captureTime = Date.now() - startTime;
          this.captureCount++;
          
          // Log performance every 10 captures
          if (this.captureCount % 10 === 0) {
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
    }, 2000); // Check CPU every 2 seconds
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
    console.log('🔧 Adjusting quality for better performance...');
    
    // Reduce quality if performance is poor
    if (this.screenQuality === 'high') {
      this.screenQuality = 'medium';
      console.log('📉 Reduced quality from high to medium');
    } else if (this.screenQuality === 'medium') {
      this.screenQuality = 'low';
      console.log('📉 Reduced quality from medium to low');
    } else if (this.screenQuality === 'low' && process.platform === 'win32') {
      // On Windows, if low quality is still too much, increase frame skipping
      this.maxFrameSkip = Math.min(this.maxFrameSkip + 1, 4);
      console.log(`📉 Increased frame skipping to ${this.maxFrameSkip} on Windows`);
    }
    
    // Restart capture with new settings
    await this.setupScreenCapture();
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
    
    // Audio will be started when connection is established
    // This is just initialization
  }

  startAudioCapture() {
    if (!this.isAudioEnabled || !this.socket || !this.isConnected) {
      return;
    }

    console.log('🎤 Starting audio capture...');
    
    try {
      // Configure audio recording
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

      console.log('✅ Audio capture started successfully');
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.startAudioCaptureFallback();
    }
  }

  startAudioCaptureFallback() {
    console.log('🔄 Trying fallback audio capture method...');
    
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
    }
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
  }
}

new TesterApp();