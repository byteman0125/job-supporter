// Example of how to integrate FFmpeg capture into your tester app
const FFmpegCapture = require('./ffmpeg-capture');

class TesterWithFFmpeg {
    constructor() {
        this.ffmpegCapture = new FFmpegCapture();
        this.isSharing = false;
    }

    async init() {
        // Check if FFmpeg is available
        const ffmpegAvailable = await this.ffmpegCapture.checkFFmpeg();
        if (!ffmpegAvailable) {
            console.error('FFmpeg not found! Please run setup-ffmpeg.ps1 first');
            return false;
        }
        console.log('FFmpeg is available and ready to use');
        return true;
    }

    async startScreenSharing() {
        if (!this.isSharing) {
            // Set up frame callback
            this.ffmpegCapture.setFrameCallback((frameData) => {
                // Convert frame data to base64 and send via socket
                const base64Data = frameData.toString('base64');
                if (this.socket && this.socket.connected) {
                    this.socket.emit('screenData', {
                        image: base64Data,
                        timestamp: Date.now(),
                        width: 1920,
                        height: 1080,
                        mouseX: 0, // You can get this from other sources
                        mouseY: 0,
                        cursorVisible: true
                    });
                }
            });

            // Start FFmpeg capture
            this.ffmpegCapture.startCapture({
                width: 1920,
                height: 1080,
                fps: 30,
                quality: 'high'
            });

            this.isSharing = true;
            console.log('Screen sharing started with FFmpeg');
        }
    }

    stopScreenSharing() {
        if (this.isSharing) {
            this.ffmpegCapture.stopCapture();
            this.isSharing = false;
            console.log('Screen sharing stopped');
        }
    }
}

module.exports = TesterWithFFmpeg;
