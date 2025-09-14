# FFmpeg Windows Setup Guide

## Overview
This guide explains how to set up FFmpeg for screen capture on Windows systems. The FFmpeg files are Windows executables and will only work on Windows.

## Quick Setup

### 1. Run the Setup Script
On Windows, run:
```cmd
setup-minimal-ffmpeg.bat
```

### 2. Verify Installation
Test FFmpeg on Windows:
```cmd
node test-ffmpeg.js
```

You should see:
```
🔍 Testing FFmpeg at: C:\path\to\job-supporter\tester\assets\ffmpeg-minimal\bin\ffmpeg.exe
✅ FFmpeg file exists
🧪 Testing FFmpeg with -version...
✅ FFmpeg test successful
```

## What You Need

### Essential Files (8 files total)
```
tester/assets/ffmpeg-minimal/bin/
├── ffmpeg.exe          (528KB)
├── avcodec-62.dll      (105MB)
├── avdevice-62.dll     (3.6MB)
├── avfilter-11.dll     (68MB)
├── avformat-62.dll     (22MB)
├── avutil-60.dll       (2.9MB)
├── swresample-6.dll    (721KB)
└── swscale-9.dll       (2.2MB)
```

## How It Works

### Capture Methods (in order of preference)
1. **FFmpeg Windows** - Uses PowerShell with proper DLL paths
2. **Native Electron** - Uses Electron's built-in screen capture
3. **Original FFmpeg** - Direct FFmpeg execution
4. **Screenshot-Desktop** - Fallback method

### Expected Logs
When you run the tester app, you should see:
```
🔍 Initializing capture methods...
🔍 Trying ffmpeg-windows...
✅ Using ffmpeg-windows for screen capture
🎥 Starting FFmpeg Windows screen capture
```

## Troubleshooting

### Common Issues

#### 1. "FFmpeg not found"
- Ensure all 8 files are in `tester/assets/ffmpeg-minimal/bin/`
- Check file permissions
- Run `setup-minimal-ffmpeg.bat` again

#### 2. "DLL not found" errors
- Install Visual C++ Redistributable
- Ensure all DLL files are present
- Check Windows PATH environment

#### 3. "Access denied" errors
- Run as Administrator
- Check antivirus software
- Ensure files aren't locked

#### 4. FFmpeg fails but other methods work
- This is normal! The app will automatically use:
  - Native Electron capture (good quality)
  - Screenshot-desktop (reliable fallback)

## Benefits

✅ **Native cursor capture** - Real mouse cursor in screenshots  
✅ **High quality** - Better than basic screenshot methods  
✅ **Multiple fallbacks** - Always finds a working method  
✅ **Automatic selection** - No manual configuration needed  
✅ **Windows optimized** - Handles DLL dependencies properly  

## File Structure
```
job-supporter/
├── tester/
│   ├── assets/
│   │   ├── ffmpeg/           (Full installation - 300MB+)
│   │   └── ffmpeg-minimal/   (Essential files only - 200MB)
│   │       └── bin/
│   │           ├── ffmpeg.exe
│   │           └── [7 DLL files]
│   ├── main.js
│   ├── ffmpeg-capture.js
│   └── ffmpeg-windows.js
├── setup-minimal-ffmpeg.bat
└── test-ffmpeg.js
```

## Next Steps
1. Copy the project to your Windows PC
2. Run `setup-minimal-ffmpeg.bat`
3. Test with `node test-ffmpeg.js`
4. Run the tester app - it will automatically use the best capture method
