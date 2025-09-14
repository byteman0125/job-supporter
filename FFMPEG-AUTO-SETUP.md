# FFmpeg Auto Setup for Windows

## Quick Setup

### Option 1: Batch File (Recommended)
```cmd
setup-ffmpeg.bat
```

### Option 2: PowerShell Script
```powershell
powershell -ExecutionPolicy Bypass -File setup-ffmpeg.ps1
```

## What the Script Does

1. **Downloads FFmpeg** - Gets the latest FFmpeg essentials from official source
2. **Extracts Files** - Unzips the downloaded archive
3. **Copies Essential Files** - Only the 8 files needed for screen capture:
   - `ffmpeg.exe` - Main executable
   - `avcodec-*.dll` - Codec library
   - `avdevice-*.dll` - Device library (for screen capture)
   - `avfilter-*.dll` - Filter library
   - `avformat-*.dll` - Format library
   - `avutil-*.dll` - Utility library
   - `swresample-*.dll` - Resampling library
   - `swscale-*.dll` - Scaling library
4. **Cleans Up** - Removes temporary files
5. **Tests Installation** - Verifies FFmpeg works

## Requirements

- Windows 10/11
- Internet connection
- PowerShell (usually pre-installed)

## After Setup

### Test FFmpeg
```cmd
node test-ffmpeg.js
```

### Run the App
```cmd
npm start
```

## Expected Output

```
========================================
FFmpeg Setup for Screen Capture
========================================

Creating FFmpeg directory structure...
Downloading FFmpeg...
Extracting FFmpeg...
Copying essential files...
  Copied: ffmpeg.exe
  Copied: avcodec-62.dll
  Copied: avdevice-62.dll
  Copied: avfilter-11.dll
  Copied: avformat-62.dll
  Copied: avutil-60.dll
  Copied: swresample-6.dll
  Copied: swscale-9.dll
Cleaning up temporary files...
Testing FFmpeg installation...
✅ FFmpeg executable found
✅ FFmpeg is working correctly

========================================
Setup Complete!
========================================

Essential files installed:
ffmpeg.exe
avcodec-62.dll
avdevice-62.dll
avfilter-11.dll
avformat-62.dll
avutil-60.dll
swresample-6.dll
swscale-9.dll

Total size: ~200 MB

You can now run:
  node test-ffmpeg.js
  npm start

The app will automatically use FFmpeg for screen capture with native cursor support.
```

## Troubleshooting

### "Execution Policy" Error (PowerShell)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Download Failed" Error
- Check internet connection
- Try running as Administrator
- Disable antivirus temporarily

### "FFmpeg not working" Error
- Install Visual C++ Redistributable
- Run as Administrator
- Check Windows Defender exclusions

## Benefits

✅ **Automatic download** - No manual FFmpeg installation needed  
✅ **Essential files only** - ~200MB vs 300MB+ full installation  
✅ **Native cursor capture** - Real mouse cursor in screenshots  
✅ **Multiple fallbacks** - App works even if FFmpeg fails  
✅ **Windows optimized** - Handles DLL dependencies properly  

## File Structure After Setup

```
job-supporter/
├── tester/
│   └── assets/
│       └── ffmpeg/
│           └── bin/
│               ├── ffmpeg.exe
│               ├── avcodec-62.dll
│               ├── avdevice-62.dll
│               ├── avfilter-11.dll
│               ├── avformat-62.dll
│               ├── avutil-60.dll
│               ├── swresample-6.dll
│               └── swscale-9.dll
├── setup-ffmpeg.bat
├── setup-ffmpeg.ps1
└── test-ffmpeg.js
```
