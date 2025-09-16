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
        if (this.platform === 'win32') {
            // Windows
            this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'win', 'ffmpeg.exe');
            this.captureInput = 'gdigrab';
            this.desktopSource = 'desktop';
        } else if (this.platform === 'darwin') {
            // macOS
            this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'mac', 'ffmpeg');
            this.captureInput = 'avfoundation';
            this.desktopSource = '1:0'; // Screen:Audio (screen only)
        } else {
            // Linux
            this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'linux', 'ffmpeg');
            this.captureInput = 'x11grab';
            // Try to detect the correct display
            this.desktopSource = process.env.DISPLAY || ':0';
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

    // Initialize FFmpeg (check system first, then bundled)
    async initialize() {
        // console.log(`🔧 Initializing FFmpeg for ${this.platform}...`);
        
        // First try system FFmpeg
        if (await this.checkSystemFFmpeg()) {
            return true;
        }

        // Then try bundled FFmpeg
        if (await this.checkBundledFFmpeg()) {
            return true;
        }

        // console.log('❌ No working FFmpeg found');
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
            // Windows: gdigrab
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

        // Handle stderr for debugging
        this.ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString();
            if (message.includes('error') || message.includes('Error')) {
                // console.log('FFmpeg stderr:', message);
            }
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
