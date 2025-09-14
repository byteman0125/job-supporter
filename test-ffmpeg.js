const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test FFmpeg executable
const ffmpegPath = path.join(__dirname, 'tester', 'assets', 'ffmpeg', 'bin', 'ffmpeg.exe');

console.log('🔍 Testing FFmpeg at:', ffmpegPath);

// Check if file exists
if (!fs.existsSync(ffmpegPath)) {
    console.log('❌ FFmpeg file not found!');
    process.exit(1);
}

console.log('✅ FFmpeg file exists');

// Test basic FFmpeg command
console.log('🧪 Testing FFmpeg with -version...');

const testProcess = spawn(ffmpegPath, ['-version'], {
    stdio: ['ignore', 'pipe', 'pipe']
});

testProcess.stdout.on('data', (data) => {
    console.log('✅ FFmpeg version output:', data.toString().substring(0, 100) + '...');
});

testProcess.stderr.on('data', (data) => {
    console.log('⚠️ FFmpeg stderr:', data.toString());
});

testProcess.on('close', (code) => {
    console.log('🔍 FFmpeg test exit code:', code);
    if (code === 0) {
        console.log('✅ FFmpeg is working correctly!');
    } else {
        console.log('❌ FFmpeg test failed with code:', code);
        console.log('💡 Try downloading a fresh FFmpeg from: https://www.gyan.dev/ffmpeg/builds/');
    }
});

testProcess.on('error', (error) => {
    console.log('❌ FFmpeg test error:', error.message);
    console.log('💡 This usually means missing Visual C++ Redistributable');
});

// Timeout after 10 seconds
setTimeout(() => {
    if (testProcess && !testProcess.killed) {
        testProcess.kill();
        console.log('⏰ FFmpeg test timeout');
    }
}, 10000);
