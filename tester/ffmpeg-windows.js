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

        // Use PowerShell to run FFmpeg with proper environment and DLL path
        const binDir = path.dirname(this.ffmpegPath);
        const psCommand = `
            $env:PATH += ";${binDir}"
            $env:PATH += ";${path.join(binDir, '..', 'lib')}"
            & "${this.ffmpegPath}" -f gdigrab -framerate ${fps} -i desktop -vf scale=${width}:${height}:flags=lanczos -f image2pipe -vcodec png -pix_fmt rgb24 -compression_level 0 -vsync 0 -y pipe:1
        `;

        this.ffmpegProcess = spawn('powershell', ['-Command', psCommand], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                PATH: `${binDir};${path.join(binDir, '..', 'lib')};${process.env.PATH}`
            }
        });

        // Buffer for PNG data
        this.pngBuffer = Buffer.alloc(0);
        this.pngStartMarker = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG signature
        this.pngEndMarker = Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]); // IEND chunk

        this.ffmpegProcess.stdout.on('data', (data) => {
            this.pngBuffer = Buffer.concat([this.pngBuffer, data]);
            
            // Look for complete PNG frames
            let startIndex = 0;
            while (true) {
                const pngStart = this.pngBuffer.indexOf(this.pngStartMarker, startIndex);
                if (pngStart === -1) break;
                
                const pngEnd = this.pngBuffer.indexOf(this.pngEndMarker, pngStart);
                if (pngEnd === -1) break; // Incomplete PNG, wait for more data
                
                // Extract complete PNG
                const pngData = this.pngBuffer.slice(pngStart, pngEnd + this.pngEndMarker.length);
                
                if (this.onFrame) {
                    this.onFrame(pngData);
                }
                
                startIndex = pngEnd + this.pngEndMarker.length;
            }
            
            // Keep only the last incomplete PNG data
            if (startIndex > 0) {
                this.pngBuffer = this.pngBuffer.slice(startIndex);
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
