const { screen, desktopCapturer } = require('electron');
const fs = require('fs');

class NativeCapture {
    constructor() {
        this.isCapturing = false;
        this.captureInterval = null;
        this.onFrame = null;
    }

    // Initialize native capture
    async initialize() {
        
        try {
            // Test if we can get screen sources
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 100, height: 100 }
            });

            if (sources.length > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    // Start capture using native Electron methods
    async startCapture(options = {}) {
        if (this.isCapturing) {
            return;
        }

        const {
            width = 1920,
            height = 1080,
            fps = 30
        } = options;


        try {
            // Get screen sources
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: width, height: height }
            });

            if (sources.length === 0) {
                return;
            }

            const primarySource = sources[0];

            // Start capture loop
            this.isCapturing = true;
            const interval = 1000 / fps; // Convert FPS to interval

            this.captureInterval = setInterval(async () => {
                try {
                    // Capture screen with cursor
                    const sources = await desktopCapturer.getSources({
                        types: ['screen'],
                        thumbnailSize: { width: width, height: height }
                    });

                    if (sources.length > 0) {
                        const source = sources[0];
                        const image = source.thumbnail;
                        
                        // Convert to buffer
                        const buffer = image.toPNG();
                        
                        if (this.onFrame) {
                            this.onFrame(buffer);
                        }
                    }
                } catch (error) {
                }
            }, interval);

        } catch (error) {
            this.isCapturing = false;
        }
    }

    // Stop capture
    stopCapture() {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        this.isCapturing = false;
    }

    // Set callback for frame data
    setFrameCallback(callback) {
        this.onFrame = callback;
    }
}

module.exports = NativeCapture;
