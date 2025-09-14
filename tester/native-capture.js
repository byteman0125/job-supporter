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
        console.log('🔍 Initializing native Electron capture...');
        
        try {
            // Test if we can get screen sources
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 100, height: 100 }
            });

            if (sources.length > 0) {
                console.log('✅ Native capture available');
                return true;
            } else {
                console.log('❌ No screen sources available');
                return false;
            }
        } catch (error) {
            console.log('❌ Native capture error:', error.message);
            return false;
        }
    }

    // Start capture using native Electron methods
    async startCapture(options = {}) {
        if (this.isCapturing) {
            console.log('Native capture already running');
            return;
        }

        const {
            width = 1920,
            height = 1080,
            fps = 30
        } = options;

        console.log('🎥 Starting native Electron capture...');

        try {
            // Get screen sources
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: width, height: height }
            });

            if (sources.length === 0) {
                console.log('❌ No screen sources found');
                return;
            }

            const primarySource = sources[0];
            console.log('📺 Using screen source:', primarySource.name);

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
                    console.log('Capture error:', error.message);
                }
            }, interval);

            console.log('✅ Native capture started');
        } catch (error) {
            console.log('❌ Failed to start native capture:', error.message);
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
        console.log('Native capture stopped');
    }

    // Set callback for frame data
    setFrameCallback(callback) {
        this.onFrame = callback;
    }
}

module.exports = NativeCapture;
