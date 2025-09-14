const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class FFmpegWindows {
    constructor() {
        this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'ffmpeg.exe');
        this.isCapturing = false;
        this.ffmpegProcess = null;
        this.useSystemFFmpeg = false;
    }

    // Check if system FFmpeg is available
    async checkSystemFFmpeg() {
        return new Promise((resolve) => {
            exec('ffmpeg -version', (error, stdout, stderr) => {
                if (error) {
                    console.log('🔍 System FFmpeg not found');
                    resolve(false);
                } else {
                    console.log('✅ System FFmpeg found');
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
                console.log('🔍 Bundled FFmpeg not found');
                resolve(false);
            }

            console.log('🔍 Testing bundled FFmpeg...');
            const testProcess = spawn(this.ffmpegPath, ['-version'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            testProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Bundled FFmpeg works');
                    resolve(true);
                } else {
                    console.log('❌ Bundled FFmpeg failed with code:', code);
                    resolve(false);
                }
            });

            testProcess.on('error', (error) => {
                console.log('❌ Bundled FFmpeg error:', error.message);
                resolve(false);
            });

            setTimeout(() => {
                if (testProcess && !testProcess.killed) {
                    testProcess.kill();
                    resolve(false);
                }
            }, 5000);
        });
    }

    // Initialize FFmpeg
    async initialize() {
        console.log('🔍 Initializing FFmpeg...');
        
        // Try system FFmpeg first
        const systemFFmpeg = await this.checkSystemFFmpeg();
        if (systemFFmpeg) {
            return true;
        }

        // Try bundled FFmpeg
        const bundledFFmpeg = await this.checkBundledFFmpeg();
        if (bundledFFmpeg) {
            return true;
        }

        console.log('❌ No working FFmpeg found');
        return false;
    }

    // Start capture using PowerShell with FFmpeg
    startCapture(options = {}) {
        if (this.isCapturing) {
            console.log('FFmpeg capture already running');
            return;
        }

        const {
            width = 1920,
            height = 1080,
            fps = 30
        } = options;

        console.log('🎥 Starting FFmpeg capture via PowerShell...');

        // Use PowerShell to run FFmpeg with proper environment
        const psCommand = `
            $env:PATH += ";${path.dirname(this.ffmpegPath)}"
            & "${this.ffmpegPath}" -f gdigrab -framerate ${fps} -i desktop -vf scale=${width}:${height} -f image2pipe -vcodec png -pix_fmt rgb24 -y pipe:1
        `;

        this.ffmpegProcess = spawn('powershell', ['-Command', psCommand], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.ffmpegProcess.stdout.on('data', (data) => {
            if (this.onFrame) {
                this.onFrame(data);
            }
        });

        this.ffmpegProcess.stderr.on('data', (data) => {
            console.log('FFmpeg stderr:', data.toString());
        });

        this.ffmpegProcess.on('close', (code) => {
            console.log('FFmpeg process exited with code:', code);
            this.isCapturing = false;
            this.ffmpegProcess = null;
        });

        this.ffmpegProcess.on('error', (error) => {
            console.error('FFmpeg process error:', error);
            this.isCapturing = false;
            this.ffmpegProcess = null;
        });

        this.isCapturing = true;
        console.log('FFmpeg capture started via PowerShell');
    }

    // Stop capture
    stopCapture() {
        if (this.ffmpegProcess && this.isCapturing) {
            this.ffmpegProcess.kill('SIGTERM');
            this.isCapturing = false;
            console.log('FFmpeg capture stopped');
        }
    }

    // Set callback for frame data
    setFrameCallback(callback) {
        this.onFrame = callback;
    }
}

module.exports = FFmpegWindows;
