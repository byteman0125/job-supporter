const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class FFmpegCapture {
    constructor() {
        this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'bin', 'ffmpeg.exe');
        this.isCapturing = false;
        this.ffmpegProcess = null;
    }

    // Start FFmpeg screen capture with mouse cursor
    startCapture(options = {}) {
        if (this.isCapturing) {
            return;
        }

        const {
            width = 1920,
            height = 1080,
            fps = 30,
            quality = 'medium',
            outputFormat = 'image2pipe',
            outputPath = 'pipe:1'
        } = options;

        // FFmpeg command for screen capture with cursor
        const args = [
            '-f', 'gdigrab',                    // Windows screen capture
            '-framerate', fps.toString(),       // Frame rate
            '-i', 'desktop',                    // Capture entire desktop
            '-vf', 'scale=' + width + ':' + height,  // Scale to desired resolution
            '-f', outputFormat,                 // Output format
            '-vcodec', 'png',                   // PNG codec for quality
            '-pix_fmt', 'rgb24',               // Pixel format
            '-y',                              // Overwrite output files
            '-loglevel', 'error',              // Only show errors
            outputPath                         // Output destination
        ];

        
        // Set up environment with DLL path
        const binDir = path.dirname(this.ffmpegPath);
        const env = {
            ...process.env,
            PATH: `${binDir};${path.join(binDir, '..', 'lib')};${process.env.PATH}`
        };

        this.ffmpegProcess = spawn(this.ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: env
        });

        this.ffmpegProcess.stdout.on('data', (data) => {
            // Handle captured frame data
            if (this.onFrame) {
                this.onFrame(data);
            }
        });

        this.ffmpegProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            if (errorMsg.includes('gdigrab') || errorMsg.includes('desktop')) {
            }
        });

        this.ffmpegProcess.on('close', (code) => {
            if (code !== 0) {
            }
            this.isCapturing = false;
            this.ffmpegProcess = null;
        });

        this.ffmpegProcess.on('error', (error) => {
            this.isCapturing = false;
            this.ffmpegProcess = null;
        });

        this.isCapturing = true;
    }

    // Stop FFmpeg capture
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

    // Check if FFmpeg is available
    checkFFmpeg() {
        return new Promise((resolve) => {
            
            // First check if file exists
            if (!fs.existsSync(this.ffmpegPath)) {
                resolve(false);
                return;
            }
            
            
            const checkProcess = spawn(this.ffmpegPath, ['-version'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            checkProcess.on('close', (code) => {
                resolve(code === 0);
            });

            checkProcess.on('error', (error) => {
                resolve(false);
            });
            
            // Add timeout to prevent hanging
            setTimeout(() => {
                if (checkProcess && !checkProcess.killed) {
                    checkProcess.kill();
                    resolve(false);
                }
            }, 5000);
        });
    }
}

module.exports = FFmpegCapture;
