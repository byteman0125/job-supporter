const { spawn } = require('child_process');
const path = require('path');

class FFmpegCapture {
    constructor() {
        this.ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'ffmpeg.exe');
        this.isCapturing = false;
        this.ffmpegProcess = null;
    }

    // Start FFmpeg screen capture with mouse cursor
    startCapture(options = {}) {
        if (this.isCapturing) {
            console.log('FFmpeg capture already running');
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
            outputPath                         // Output destination
        ];

        console.log('Starting FFmpeg capture with args:', args);

        this.ffmpegProcess = spawn(this.ffmpegPath, args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.ffmpegProcess.stdout.on('data', (data) => {
            // Handle captured frame data
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
        console.log('FFmpeg capture started');
    }

    // Stop FFmpeg capture
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

    // Check if FFmpeg is available
    checkFFmpeg() {
        return new Promise((resolve) => {
            const checkProcess = spawn(this.ffmpegPath, ['-version'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            checkProcess.on('close', (code) => {
                resolve(code === 0);
            });

            checkProcess.on('error', () => {
                resolve(false);
            });
        });
    }
}

module.exports = FFmpegCapture;
