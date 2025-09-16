const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const FFmpegCrossPlatform = require('./ffmpeg-crossplatform');
const SystemTray = require('./system-tray');

class ServerCLI {
  constructor() {
    // Initialize cross-platform FFmpeg
    this.ffmpeg = new FFmpegCrossPlatform();
    this.socket = null;
    this.captureProcess = null;
    this.isCapturing = false;
    this.screenWidth = 1920;  // Full HD resolution for maximum quality
    this.screenHeight = 1080; // 1080p - best visual clarity
    this.framerate = 10;      // 10 FPS for stable performance and lower bandwidth
    
    // Frame buffering for complete MJPEG frames
    this.frameBuffer = Buffer.alloc(0);
    this.lastFrameTime = 0;
    
    // Set a friendly process title
    this.setupProcessTitle();
    
    // Initialize FFmpeg (async - will complete in background)
    this.initializeFFmpeg().catch(err => {
      console.log('FFmpeg initialization error:', err.message);
    });

    // Initialize system tray
    this.tray = new SystemTray(this);
  }

  // Initialize FFmpeg for cross-platform support
  async initializeFFmpeg() {
    console.log(`🔧 Initializing FFmpeg for ${process.platform}...`);
    const success = await this.ffmpeg.initialize();
    
    if (success) {
      const info = this.ffmpeg.getSystemInfo();
      console.log('✅ FFmpeg initialized successfully');
      console.log(`📍 Platform: ${info.platform} (${info.arch})`);
      console.log(`🎯 FFmpeg: ${info.useSystemFFmpeg ? 'System' : 'Bundled'}`);
      console.log(`📂 Path: ${info.ffmpegPath}`);
      console.log(`🎥 Capture: ${info.captureInput} -> ${info.desktopSource}`);
    } else {
      console.log('❌ FFmpeg initialization failed');
      console.log('📋 Install instructions:', this.ffmpeg.getInstallInstructions());
    }
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
    
    console.log(`📋 Process title set to: ${process.title}`);
  }

  // No admin privileges required - runs as normal user
  async checkUserPermissions() {
    // Always return true - we run as normal user
    console.log('✅ Running as normal user (no admin privileges required)');
    return true;
  }

  // Normal process behavior - transparent and user-friendly
  async normalProcessBehavior() {
    // Do nothing suspicious - just run as a normal application
    console.log('✅ Running as normal user application');
    console.log('📋 Process visible in Task Manager as:', process.title);
    console.log('🔍 No hiding, no system modifications, no admin privileges required');
  }

  // Start screen capture using cross-platform FFmpeg
  startCapture() {
    if (this.isCapturing) return;

    try {
      console.log('🎥 Starting cross-platform screen capture...');
      
      // Start capture using cross-platform FFmpeg
      this.captureProcess = this.ffmpeg.startCapture({
        width: this.screenWidth,
        height: this.screenHeight,
        fps: this.framerate,
        quality: 'high',
        outputFormat: 'image2pipe'
      });

      if (!this.captureProcess) {
        console.log('❌ Failed to start capture process');
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
          console.log(`⚠️ Capture process exited with code: ${code}`);
          // Try to restart capture after a delay
          setTimeout(() => {
            if (this.socket && this.socket.connected) {
              this.startCapture();
            }
          }, 5000);
        }
      });

      console.log('✅ Screen capture started successfully');

    } catch (error) {
      console.log('❌ Capture error:', error.message);
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
    console.log('🛑 Stopping screen capture...');
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
          // Registration successful - display server ID for viewer to use
          console.log('');
          console.log('✅ Server registered successfully!');
          console.log('🆔 Your Server ID:', this.serverId);
          console.log('📋 Share this ID with viewer to connect');
          console.log('💾 ID saved to secure location (persistent across restarts)');
          console.log('');

          // Update tray status
          if (this.tray) {
            this.tray.onServerRegistered(this.serverId);
          }
        }
      });
      
      this.socket.on('viewer-connected', (data) => {
        console.log('👀 Viewer connected - Starting screen capture');
        
        // Start capture when viewer connects
        this.startCapture();

        // Update tray status
        if (this.tray) {
          this.tray.onViewerConnected();
        }
      });
      
      this.socket.on('viewer-disconnected', () => {
        console.log('👋 Viewer disconnected - Stopping screen capture');
        
        // Stop capture when viewer disconnects
        this.stopCapture();

        // Update tray status
        if (this.tray) {
          this.tray.onViewerDisconnected();
        }
      });
      
      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from relay server');
        
        // Stop capture on disconnect
        this.stopCapture();

        // Update tray status
        if (this.tray) {
          this.tray.updateTrayStatus('offline', 'Disconnected from relay server');
        }
      });

      this.socket.on('connect_error', (error) => {
        console.log('❌ Connection error:', error.message);

        // Update tray status
        if (this.tray) {
          this.tray.onConnectionError(error.message);
        }

        // Try to reconnect after error
        setTimeout(() => {
          this.connectToRelay();
        }, 5000);
      });
      
      this.socket.on('error', (error) => {
        // Silently ignore errors
      });
      
    } catch (error) {
      // Try to reconnect after error
      setTimeout(() => {
        this.connectToRelay();
      }, 5000);
    }
  }

  // Start the tester CLI
  async start() {
    // Initial process hiding
    await this.normalProcessBehavior();
    
    // Connect to Vercel relay service
    this.connectToRelay();
    
    // Periodic status check (no hiding)
    setInterval(() => {
      console.log(`📊 Status: ${this.isCapturing ? 'Capturing' : 'Idle'} - Connected: ${this.socket?.connected || false}`);
    }, 30000); // Every 30 seconds
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Remote Provider Server...');
      
      this.stopCapture();
      
      if (this.socket) {
        this.socket.disconnect();
      }
      
      if (this.tray) {
        this.tray.destroy();
      }
      
      console.log('✅ Server shutdown complete');
      process.exit(0);
    });

    // Handle other termination signals
    process.on('SIGTERM', () => {
      console.log('🛑 Server termination requested...');
      
      if (this.tray) {
        this.tray.destroy();
      }
      
      process.exit(0);
    });
  }
}

// Start the CLI application
const server = new ServerCLI();
server.start();
