# FFmpeg Minimal Setup for Screen Capture

## Overview
This setup includes only the essential FFmpeg files needed for screen capture with native cursor support, reducing the total size from 300MB+ to ~200MB.

## Essential Files
The following files are required for FFmpeg screen capture:

### Core Executable
- `ffmpeg.exe` - Main FFmpeg executable (528KB)

### Required DLLs
- `avcodec-62.dll` - Codec library (105MB)
- `avdevice-62.dll` - Device library for screen capture (3.6MB)
- `avfilter-11.dll` - Filter library (68MB)
- `avformat-62.dll` - Format library (22MB)
- `avutil-60.dll` - Utility library (2.9MB)
- `swresample-6.dll` - Resampling library (721KB)
- `swscale-9.dll` - Scaling library (2.2MB)

## Setup Instructions

### Option 1: Use the Setup Script (Windows)
```bash
# Run the setup script
setup-minimal-ffmpeg.bat
```

### Option 2: Manual Setup
```bash
# Create directory structure
mkdir -p tester/assets/ffmpeg-minimal/bin

# Copy essential files
cp tester/assets/ffmpeg/bin/ffmpeg.exe tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/avcodec-62.dll tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/avdevice-62.dll tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/avfilter-11.dll tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/avformat-62.dll tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/avutil-60.dll tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/swresample-6.dll tester/assets/ffmpeg-minimal/bin/
cp tester/assets/ffmpeg/bin/swscale-9.dll tester/assets/ffmpeg-minimal/bin/
```

## Testing
Test the minimal setup on Windows:
```cmd
node test-ffmpeg.js
```

**Note**: FFmpeg executables are Windows-specific and won't work on Linux. Test only on Windows systems.

## What's Excluded
The following files are NOT needed for basic screen capture:
- `ffplay.exe` - Media player (not needed for capture)
- `ffprobe.exe` - Media analyzer (not needed for capture)
- `doc/` - Documentation files
- `include/` - Header files
- `lib/` - Static libraries
- `presets/` - Encoding presets

## Benefits
- **Smaller size**: ~200MB vs 300MB+ for full installation
- **Faster deployment**: Fewer files to copy
- **Same functionality**: All screen capture features work
- **Native cursor**: Captures real mouse cursor
- **High quality**: Supports various resolutions and frame rates

## Troubleshooting
If you encounter issues:
1. Ensure all 8 files are present in `tester/assets/ffmpeg-minimal/bin/`
2. Check file permissions (should be executable)
3. Verify Windows Visual C++ Redistributable is installed
4. Try running `ffmpeg.exe -version` directly to test

## File Structure
```
tester/assets/ffmpeg-minimal/
└── bin/
    ├── ffmpeg.exe
    ├── avcodec-62.dll
    ├── avdevice-62.dll
    ├── avfilter-11.dll
    ├── avformat-62.dll
    ├── avutil-60.dll
    ├── swresample-6.dll
    └── swscale-9.dll
```
