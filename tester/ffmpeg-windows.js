const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class FFmpegWindows {
    constructor() {
        this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'bin', 'ffmpeg.exe');
        this.isCapturing = false;
        this.ffmpegProcess = null;
        this.useSystemFFmpeg = false;
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
                resolve(false);
            }

            const testProcess = spawn(this.ffmpegPath, ['-version'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            testProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            testProcess.on('error', (error) => {
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

        return false;
    }

    // Start capture using PowerShell with FFmpeg
    startCapture(options = {}) {
        if (this.isCapturing) {
            return;
        }

        const {
            width = 1280,
            height = 720,
            fps = 15
        } = options;


        // Use PowerShell to run FFmpeg with proper environment and DLL path
        const binDir = path.dirname(this.ffmpegPath);
        const psCommand = `
            $env:PATH += ";${binDir}"
            $env:PATH += ";${path.join(binDir, '..', 'lib')}"
            & "${this.ffmpegPath}" -f gdigrab -framerate ${fps} -i desktop -vf scale=${width}:${height}:flags=fast_bilinear -f image2pipe -vcodec mjpeg -q:v 5 -preset ultrafast -tune zerolatency -y pipe:1
        `;

        this.ffmpegProcess = spawn('powershell', ['-Command', psCommand], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                PATH: `${binDir};${path.join(binDir, '..', 'lib')};${process.env.PATH}`
            }
        });

        // Buffer for MJPEG data (much simpler than PNG)
        this.mjpegBuffer = Buffer.alloc(0);
        this.mjpegStartMarker = Buffer.from([0xFF, 0xD8]); // JPEG start
        this.mjpegEndMarker = Buffer.from([0xFF, 0xD9]);   // JPEG end

        this.ffmpegProcess.stdout.on('data', (data) => {
            this.mjpegBuffer = Buffer.concat([this.mjpegBuffer, data]);
            
            // Look for complete JPEG frames
            let startIndex = 0;
            while (true) {
                const jpegStart = this.mjpegBuffer.indexOf(this.mjpegStartMarker, startIndex);
                if (jpegStart === -1) break;
                
                const jpegEnd = this.mjpegBuffer.indexOf(this.mjpegEndMarker, jpegStart);
                if (jpegEnd === -1) break; // Incomplete JPEG, wait for more data
                
                // Extract complete JPEG
                const jpegData = this.mjpegBuffer.slice(jpegStart, jpegEnd + this.mjpegEndMarker.length);
                
                if (this.onFrame) {
                    this.onFrame(jpegData);
                }
                
                startIndex = jpegEnd + this.mjpegEndMarker.length;
            }
            
            // Keep only the last incomplete JPEG data
            if (startIndex > 0) {
                this.mjpegBuffer = this.mjpegBuffer.slice(startIndex);
            }
        });

        this.ffmpegProcess.stderr.on('data', (data) => {
        });

        this.ffmpegProcess.on('close', (code) => {
            this.isCapturing = false;
            this.ffmpegProcess = null;
        });

        this.ffmpegProcess.on('error', (error) => {
            this.isCapturing = false;
            this.ffmpegProcess = null;
        });

        this.isCapturing = true;
    }

    // Stop capture
    stopCapture() {
        if (this.ffmpegProcess && this.isCapturing) {
            this.ffmpegProcess.kill('SIGTERM');
            this.isCapturing = false;
        }
    }

    // Set callback for frame data
    setFrameCallback(callback) {
        this.onFrame = callback;
    }
}

module.exports = FFmpegWindows;
