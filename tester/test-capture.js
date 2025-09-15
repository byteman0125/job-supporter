const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test FFmpeg screen capture
function testCapture() {
    const ffmpegPath = path.join(__dirname, 'assets', 'ffmpeg', 'bin', 'ffmpeg.exe');
    
    console.log('Testing FFmpeg screen capture...');
    console.log('FFmpeg path:', ffmpegPath);
    
    // Check if FFmpeg exists
    if (!fs.existsSync(ffmpegPath)) {
        console.error('❌ FFmpeg not found! Please run setup-ffmpeg.bat first');
        return;
    }
    
    console.log('✅ FFmpeg found');
    
    // Test FFmpeg command
    const ffmpegArgs = [
        '-f', 'gdigrab',
        '-framerate', '5',
        '-i', 'desktop',
        '-vf', 'scale=640:480',
        '-f', 'mjpeg',
        '-q:v', '8',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-t', '3',  // Capture for 3 seconds only
        'test-capture.mjpeg'
    ];
    
    console.log('Starting test capture...');
    const captureProcess = spawn(ffmpegPath, ffmpegArgs);
    
    captureProcess.stdout.on('data', (data) => {
        console.log('📺 FFmpeg output:', data.length, 'bytes');
    });
    
    captureProcess.stderr.on('data', (data) => {
        console.log('🔧 FFmpeg info:', data.toString());
    });
    
    captureProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Screen capture test successful!');
            console.log('📁 Check test-capture.mjpeg file');
        } else {
            console.log('❌ Screen capture failed with code:', code);
        }
    });
    
    captureProcess.on('error', (error) => {
        console.error('❌ FFmpeg error:', error.message);
    });
}

testCapture();
