const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class FFmpegCrossPlatform {
    constructor() {
        this.ffmpegPath = null;
        this.isCapturing = false;
        this.ffmpegProcess = null;
        this.useSystemFFmpeg = false;
        this.platform = process.platform;
        
        // Initialize FFmpeg path based on platform
        this.initializePlatformPaths();
    }

    // Initialize FFmpeg paths for different platforms
    initializePlatformPaths() {
        // Check if running as standalone executable (pkg)
        const isStandalone = typeof process.pkg !== 'undefined';
        
        if (this.platform === 'win32') {
            // Windows
            if (isStandalone) {
                // For pkg executables, always extract to temp directory first
                this.extractEmbeddedFFmpeg('win', 'ffmpeg.exe');
            } else {
                this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'win', 'ffmpeg.exe');
            }
            this.captureInput = 'gdigrab';
            this.desktopSource = 'desktop';  // Full desktop capture
        } else if (this.platform === 'darwin') {
            // macOS
            if (isStandalone) {
                this.extractEmbeddedFFmpeg('mac', 'ffmpeg');
            } else {
                this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'mac', 'ffmpeg');
            }
            this.captureInput = 'avfoundation';
            this.desktopSource = '1:0'; // Screen:Audio (screen only)
        } else {
            // Linux
            if (isStandalone) {
                this.extractEmbeddedFFmpeg('linux', 'ffmpeg');
            } else {
                this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'linux', 'ffmpeg');
            }
            this.captureInput = 'x11grab';
            // Try to detect the correct display
            this.desktopSource = process.env.DISPLAY || ':0';
        }
    }

    // Extract embedded FFmpeg from pkg executable to temp directory
    extractEmbeddedFFmpeg(platform, filename) {
        try {
            const tempDir = path.join(os.tmpdir(), 'remote-provider-ffmpeg');
            const platformDir = path.join(tempDir, platform);
            const extractedPath = path.join(platformDir, filename);
            
            // Create temp directory if it doesn't exist
            if (!fs.existsSync(platformDir)) {
                fs.mkdirSync(platformDir, { recursive: true });
            }
            
            // Check if already extracted and working
            if (fs.existsSync(extractedPath)) {
                this.ffmpegPath = extractedPath;
                console.log(`✅ Using cached FFmpeg: ${extractedPath}`);
                return;
            }
            
            // In pkg, assets are accessible via __dirname even in snapshot
            const embeddedPath = path.join(__dirname, 'assets', 'ffmpeg', platform, filename);
            
            console.log(`🔍 Looking for embedded FFmpeg at: ${embeddedPath}`);
            
            if (fs.existsSync(embeddedPath)) {
                // Copy embedded file to temp directory
                fs.copyFileSync(embeddedPath, extractedPath);
                
                // Make executable on Unix systems
                if (platform !== 'win') {
                    fs.chmodSync(extractedPath, 0o755);
                }
                
                this.ffmpegPath = extractedPath;
                console.log(`✅ FFmpeg extracted to: ${extractedPath}`);
                return;
            }
            
            // If embedded path doesn't exist, try alternative locations
            const alternativePaths = [
                path.join(process.cwd(), 'assets', 'ffmpeg', platform, filename),
                path.join(path.dirname(process.execPath), 'assets', 'ffmpeg', platform, filename)
            ];
            
            console.log(`❌ Embedded path not found, trying alternatives...`);
            for (const altPath of alternativePaths) {
                console.log(`🔍 Trying alternative path: ${altPath}`);
                if (fs.existsSync(altPath)) {
                    fs.copyFileSync(altPath, extractedPath);
                    
                    if (platform !== 'win') {
                        fs.chmodSync(extractedPath, 0o755);
                    }
                    
                    this.ffmpegPath = extractedPath;
                    console.log(`✅ FFmpeg found and extracted from: ${altPath}`);
                    return;
                }
            }
            
            // If no embedded FFmpeg found, fall back to system FFmpeg
            console.log('❌ No embedded FFmpeg found, checking system FFmpeg...');
            this.checkSystemFFmpeg();
            
        } catch (error) {
            console.error('❌ Failed to extract embedded FFmpeg:', error);
            // Fall back to system FFmpeg
            this.checkSystemFFmpeg();
        }
    }

    // Check if system FFmpeg is available
    async checkSystemFFmpeg() {
        return new Promise((resolve) => {
            exec('ffmpeg -version', (error, stdout, stderr) => {
                if (error) {
                    resolve(false);
                } else {
                    this.useSystemFFmpeg = true;
                    this.ffmpegPath = 'ffmpeg';
                    resolve(true);
                }
            });
        });
    }

    // Check if bundled FFmpeg works
    async checkBundledFFmpeg() {
        return new Promise((resolve) => {
            if (!fs.existsSync(this.ffmpegPath)) {
                // console.log(`❌ Bundled FFmpeg not found at: ${this.ffmpegPath}`);
                resolve(false);
                return;
            }

            // Make executable on Unix systems
            if (this.platform !== 'win32') {
                try {
                    fs.chmodSync(this.ffmpegPath, '755');
                } catch (e) {
                    // console.log('Warning: Could not make FFmpeg executable');
                }
            }

            const testProcess = spawn(this.ffmpegPath, ['-version'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            testProcess.on('close', (code) => {
                if (code === 0) {
                    // console.log('✅ Bundled FFmpeg working');
                    resolve(true);
                } else {
                    // console.log('❌ Bundled FFmpeg test failed');
                    resolve(false);
                }
            });

            testProcess.on('error', (error) => {
                // console.log('❌ Bundled FFmpeg error:', error.message);
                resolve(false);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                testProcess.kill();
                resolve(false);
            }, 5000);
        });
    }

    // Test Windows screen capture capabilities
    async testWindowsCapture() {
        if (this.platform !== 'win32') return true;
        
        console.log('🧪 Testing Windows screen capture capabilities...');
        
        return new Promise((resolve) => {
            const testArgs = [
                '-f', 'gdigrab',
                '-list_devices', 'true',
                '-i', 'desktop'
            ];
            
            console.log(`🔍 Running: ${this.ffmpegPath} ${testArgs.join(' ')}`);
            
            const testProcess = spawn(this.ffmpegPath, testArgs, {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            let output = '';
            let errorOutput = '';
            
            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            testProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            testProcess.on('close', (code) => {
                resolve(true);
            });
            
            testProcess.on('error', (error) => {
                // console.log('❌ Windows capture test failed:', error.message);
                resolve(false);
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                testProcess.kill();
                resolve(false);
            }, 10000);
        });
    }

    // Initialize FFmpeg (check system first, then bundled)
    async initialize() {
        // console.log(`🔧 Initializing FFmpeg for ${this.platform}...`);
        // console.log(`📂 __dirname: ${__dirname}`);
        // console.log(`📂 process.cwd(): ${process.cwd()}`);
        // console.log(`📂 process.execPath: ${process.execPath}`);
        // console.log(`🎯 Is standalone (pkg): ${typeof process.pkg !== 'undefined'}`);
        
        // First try system FFmpeg
        if (await this.checkSystemFFmpeg()) {
            return true;
        }

        // Then try bundled FFmpeg
        // console.log(`🔍 Checking bundled FFmpeg at: ${this.ffmpegPath}`);
        if (await this.checkBundledFFmpeg()) {
            console.log(`✅ Using bundled FFmpeg: ${this.ffmpegPath}`);
            
            // Test Windows capture capabilities
            if (this.platform === 'win32') {
                await this.testWindowsCapture();
            }
            
            return true;
        }

        console.log('❌ No working FFmpeg found');
        return false;
    }

    // Get platform-specific capture arguments
    getCaptureArgs(options = {}) {
        const {
            width = 1920,
            height = 1080,
            fps = 10,
            quality = 'medium',
            outputFormat = 'image2pipe',
            outputPath = 'pipe:1'
        } = options;

        let args = [];

        if (this.platform === 'win32') {
            // Windows: gdigrab with proper desktop specification
            args = [
                '-f', 'gdigrab',
                '-framerate', fps.toString(),
                '-offset_x', '0',
                '-offset_y', '0',
                '-video_size', `${width}x${height}`,
                '-i', 'desktop',  // Use 'desktop' directly for full screen capture
                '-f', outputFormat,
                '-vcodec', 'mjpeg',
                '-pix_fmt', 'yuvj420p',
                '-q:v', '3',
                '-y',
                '-loglevel', 'verbose',  // Changed from 'error' to see more info
                outputPath
            ];
        } else if (this.platform === 'darwin') {
            // macOS: avfoundation
            args = [
                '-f', this.captureInput,
                '-framerate', fps.toString(),
                '-i', this.desktopSource,
                '-vf', `scale=${width}:${height}`,
                '-f', outputFormat,
                '-vcodec', 'mjpeg',
                '-pix_fmt', 'yuvj420p',
                '-q:v', '3',
                '-y',
                '-loglevel', 'error',
                outputPath
            ];
        } else {
            // Linux: x11grab
            args = [
                '-f', this.captureInput,
                '-framerate', fps.toString(),
                '-s', `${width}x${height}`,
                '-i', this.desktopSource,
                '-f', outputFormat,
                '-vcodec', 'mjpeg',
                '-pix_fmt', 'yuvj420p',
                '-q:v', '3',
                '-y',
                '-loglevel', 'error',
                outputPath
            ];
        }

        return args;
    }

    // Start screen capture
    startCapture(options = {}) {
        if (this.isCapturing) {
            // console.log('⚠️ Capture already in progress');
            return null;
        }

        const args = this.getCaptureArgs(options);
        
        // console.log(`🎥 Starting ${this.platform} screen capture...`);
        // console.log(`📍 FFmpeg: ${this.ffmpegPath}`);
        // console.log(`🔧 Use system FFmpeg: ${this.useSystemFFmpeg}`);
        // console.log(`⚙️  Capture args:`, args);

        // Set up environment
        let env = { ...process.env };
        
        if (this.platform === 'win32' && !this.useSystemFFmpeg) {
            // Add DLL path for Windows
            const binDir = path.dirname(this.ffmpegPath);
            env.PATH = `${binDir};${path.join(binDir, '..', 'lib')};${env.PATH}`;
        } else if (this.platform === 'linux') {
            // Linux X11 setup
            if (!env.DISPLAY) {
                env.DISPLAY = ':0';
            }
            // Add XAUTHORITY if available
            if (process.env.XAUTHORITY) {
                env.XAUTHORITY = process.env.XAUTHORITY;
            }
            // Try to get X11 authority from common locations
            const possibleXAuth = [
                `/tmp/.X11-unix/X0`,
                `/var/run/gdm3/auth-for-gdm*/database`,
                `${os.homedir()}/.Xauthority`
            ];
            
            for (const authPath of possibleXAuth) {
                if (fs.existsSync(authPath) && !env.XAUTHORITY) {
                    env.XAUTHORITY = authPath;
                    break;
                }
            }
        }

        this.ffmpegProcess = spawn(this.ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: env
        });

        this.isCapturing = true;

        this.ffmpegProcess.on('error', (error) => {
            // console.log('❌ FFmpeg error:', error.message);
            this.isCapturing = false;
        });

        this.ffmpegProcess.on('close', (code) => {
            // console.log(`🔚 FFmpeg process closed with code: ${code}`);
            this.isCapturing = false;
        });

        // Handle stderr for debugging (reduced logging)
        this.ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString();
            // Only log errors, not regular status updates
            if (message.includes('error') || message.includes('Error') || message.includes('failed')) {
                console.log('❌ FFmpeg Error:', message.trim());
            }
            // Suppress frame rate and normal output
        });

        return this.ffmpegProcess;
    }

    // Stop capture
    stopCapture() {
        if (this.ffmpegProcess && this.isCapturing) {
            // console.log('🛑 Stopping screen capture...');
            this.ffmpegProcess.kill('SIGTERM');
            this.isCapturing = false;
            this.ffmpegProcess = null;
        }
    }

    // Get system information
    getSystemInfo() {
        return {
            platform: this.platform,
            arch: os.arch(),
            ffmpegPath: this.ffmpegPath,
            useSystemFFmpeg: this.useSystemFFmpeg,
            captureInput: this.captureInput,
            desktopSource: this.desktopSource
        };
    }

    // Install instructions for missing FFmpeg
    getInstallInstructions() {
        const instructions = {
            'win32': 'Download FFmpeg from https://ffmpeg.org/download.html#build-windows and extract to assets/ffmpeg/win/',
            'darwin': 'Install via Homebrew: brew install ffmpeg, or download from https://ffmpeg.org/download.html#build-mac',
            'linux': 'Install via package manager: sudo apt install ffmpeg (Ubuntu/Debian) or sudo yum install ffmpeg (CentOS/RHEL)'
        };

        return instructions[this.platform] || 'Install FFmpeg for your platform from https://ffmpeg.org/';
    }
}

module.exports = FFmpegCrossPlatform;
