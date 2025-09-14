# FFmpeg Setup Instructions

## Where to place FFmpeg executable:

### For Tester App:
```
tester/assets/ffmpeg/ffmpeg.exe
```

### For Supporter App:
```
supporter/assets/ffmpeg/ffmpeg.exe
```

## How to get FFmpeg:

1. **Download from official site:**
   - Go to: https://www.gyan.dev/ffmpeg/builds/
   - Download: `ffmpeg-release-essentials.zip`
   - Extract and find `ffmpeg.exe` in the `bin` folder

2. **Or download from GitHub:**
   - Go to: https://github.com/BtbN/FFmpeg-Builds/releases
   - Download: `ffmpeg-master-latest-win64-gpl.zip`
   - Extract and find `ffmpeg.exe`

## File Structure After Setup:
```
job-supporter/
├── tester/
│   └── assets/
│       └── ffmpeg/
│           └── ffmpeg.exe  ← Place here
├── supporter/
│   └── assets/
│       └── ffmpeg/
│           └── ffmpeg.exe  ← Place here
└── tester/
    ├── ffmpeg-capture.js
    └── ffmpeg-integration-example.js
```

## Usage:
The FFmpeg capture class will automatically find the executable in the assets directory.

## Note:
Make sure to use the same `ffmpeg.exe` file for both tester and supporter apps to ensure compatibility.
