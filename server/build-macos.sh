#!/bin/bash
echo "========================================"
echo "Remote Provider Server - macOS Build"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "main-cli.js" ]; then
    echo "ERROR: main-cli.js not found. Please run this script from the server directory."
    exit 1
fi

echo "Current directory: $(pwd)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
fi

# Install pkg globally if not already installed
if ! command -v pkg &> /dev/null; then
    echo "Installing pkg globally..."
    npm install -g pkg
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install pkg"
        exit 1
    fi
fi

# Create dist directory if it doesn't exist
mkdir -p dist

echo "========================================"
echo "STEP 1: Building macOS Executable"
echo "========================================"
pkg main-cli.js --targets node18-macos-x64 --output dist/svchost

if [ $? -ne 0 ]; then
    echo "ERROR: Build failed"
    exit 1
fi

# Make executable
chmod +x dist/svchost

# Copy assets to dist folder
echo "Copying assets..."
if [ -d "assets" ]; then
    cp -r assets dist/
    echo "Assets copied to dist/assets/"
fi

# Copy JavaScript modules
if [ -f "ffmpeg-crossplatform.js" ]; then
    cp "ffmpeg-crossplatform.js" dist/
fi
if [ -f "system-tray.js" ]; then
    cp "system-tray.js" dist/
fi

echo "========================================"
echo "STEP 2: Setting up FFmpeg for macOS"
echo "========================================"

# Check if FFmpeg setup script exists
if [ -f "setup-ffmpeg-macos.sh" ]; then
    echo "Running FFmpeg setup script..."
    ./setup-ffmpeg-macos.sh
else
    echo "⚠️  FFmpeg setup script not found: setup-ffmpeg-macos.sh"
    echo "Please run ./setup-ffmpeg-macos.sh first to install FFmpeg"
    exit 1
fi

echo "========================================"
echo "STEP 3: Creating macOS LaunchDaemon"
echo "========================================"

# Create installation script
cat > dist/install-daemon.sh << 'EOF'
#!/bin/bash
# Remote Provider Server - macOS LaunchDaemon Installer

echo "========================================"
echo "Remote Provider Server Installation"
echo "========================================"
echo

# Check for admin privileges
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Administrator privileges required!"
    echo "Please run with sudo: sudo ./install-daemon.sh"
    exit 1
fi

INSTALL_DIR="/usr/local/bin/remote-provider"
SERVICE_DIR="$(dirname "$0")"
PLIST_FILE="/Library/LaunchDaemons/com.remoteprovider.server.plist"

echo "Installing from: $SERVICE_DIR"
echo "Install directory: $INSTALL_DIR"
echo

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy files
cp -r "$SERVICE_DIR"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/svchost"

# Create LaunchDaemon plist
cat > "$PLIST_FILE" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.remoteprovider.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/svchost</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>StandardOutPath</key>
    <string>/var/log/remote-provider.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/remote-provider-error.log</string>
</dict>
</plist>
PLIST_EOF

# Set permissions
chmod 644 "$PLIST_FILE"
chown root:wheel "$PLIST_FILE"

# Load the daemon
launchctl load "$PLIST_FILE"
launchctl start com.remoteprovider.server

echo "========================================"
echo "INSTALLATION COMPLETED!"
echo "Service will auto-start on system boot"
echo "========================================"
echo
echo "Service status: $(launchctl list | grep com.remoteprovider.server | awk '{print $1}' | grep -q '^[0-9]*$' && echo 'Running' || echo 'Stopped')"
echo "Log file: /var/log/remote-provider.log"
echo "Error log: /var/log/remote-provider-error.log"
EOF

chmod +x dist/install-daemon.sh

# Create uninstaller
cat > dist/uninstall.sh << 'EOF'
#!/bin/bash
echo "Uninstalling Remote Provider Server..."

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Administrator privileges required!"
    echo "Please run with sudo: sudo ./uninstall.sh"
    exit 1
fi

PLIST_FILE="/Library/LaunchDaemons/com.remoteprovider.server.plist"
INSTALL_DIR="/usr/local/bin/remote-provider"

# Stop and unload daemon
launchctl stop com.remoteprovider.server 2>/dev/null
launchctl unload "$PLIST_FILE" 2>/dev/null

# Remove files
rm -f "$PLIST_FILE"
rm -rf "$INSTALL_DIR"
rm -f /var/log/remote-provider.log
rm -f /var/log/remote-provider-error.log

echo "Service uninstalled successfully!"
EOF

chmod +x dist/uninstall.sh

echo "========================================"
echo "STEP 4: Creating macOS Application Bundle"
echo "========================================"

# Create app bundle structure
APP_NAME="RemoteProviderServer.app"
mkdir -p "dist/$APP_NAME/Contents/MacOS"
mkdir -p "dist/$APP_NAME/Contents/Resources"

# Create Info.plist
cat > "dist/$APP_NAME/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>svchost</string>
    <key>CFBundleIdentifier</key>
    <string>com.remoteprovider.server</string>
    <key>CFBundleName</key>
    <string>Remote Provider Server</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSAppleEventsUsageDescription</key>
    <string>Remote Provider Server needs access to control your computer for remote assistance.</string>
    <key>NSSystemAdministrationUsageDescription</key>
    <string>Remote Provider Server needs administrator access to install system services.</string>
</dict>
</plist>
EOF

# Copy executable to app bundle
cp dist/svchost "dist/$APP_NAME/Contents/MacOS/"
chmod +x "dist/$APP_NAME/Contents/MacOS/svchost"

echo "========================================"
echo "STEP 5: Creating DMG Installer"
echo "========================================"

# Create temporary directory for DMG contents
DMG_DIR="dist/dmg_contents"
mkdir -p "$DMG_DIR"

# Copy files to DMG directory
cp -r dist/svchost "$DMG_DIR/"
cp -r dist/assets "$DMG_DIR/" 2>/dev/null || true
cp dist/*.js "$DMG_DIR/" 2>/dev/null || true
cp dist/install-daemon.sh "$DMG_DIR/"
cp dist/uninstall.sh "$DMG_DIR/"

# Create README
cat > "$DMG_DIR/README.txt" << 'EOF'
Remote Provider Server - macOS Distribution
==========================================

SYSTEM REQUIREMENTS:
- macOS 10.14+ (64-bit Intel/Apple Silicon)
- FFmpeg (install via: brew install ffmpeg)

INSTALLATION:
1. Copy all files to a folder (e.g., /Applications/RemoteProvider/)
2. Open Terminal and navigate to the folder
3. Run: sudo ./install-daemon.sh
4. Grant screen recording permissions when prompted
5. Service will auto-start on system boot

UNINSTALLATION:
1. Run: sudo ./uninstall.sh

FEATURES:
- LaunchDaemon integration
- Auto-start on boot
- Background operation
- Screen recording with avfoundation
- System service management

PERMISSIONS:
The app may request permissions for:
- Screen Recording (required for screen capture)
- Accessibility (required for remote control)

Grant these permissions in System Preferences > Security & Privacy
EOF

# Create DMG if hdiutil is available
if command -v hdiutil &> /dev/null; then
    echo "Creating DMG installer..."
    hdiutil create -srcfolder "$DMG_DIR" -volname "Remote Provider Server" -format UDZO "RemoteProviderServer-macOS.dmg"
    if [ $? -eq 0 ]; then
        echo "✅ DMG created: RemoteProviderServer-macOS.dmg"
    fi
fi

# Clean up temporary directory
rm -rf "$DMG_DIR"

# Create final README
cat > dist/README.txt << 'EOF'
Remote Provider Server - macOS Distribution
==========================================

INSTALLATION:
1. Run: sudo ./install-daemon.sh
2. Grant screen recording permissions when prompted
3. Service will auto-start on system boot

UNINSTALLATION:
1. Run: sudo ./uninstall.sh

FEATURES:
- LaunchDaemon service integration
- Auto-start on boot
- avfoundation screen capture
- Background operation
- System log integration

LOGS:
- Output: /var/log/remote-provider.log
- Errors: /var/log/remote-provider-error.log
EOF

echo
echo "========================================"
echo "macOS BUILD COMPLETED!"
echo "========================================"
echo
echo "Files created:"
echo "✅ dist/svchost - Main executable"
echo "✅ dist/install-daemon.sh - LaunchDaemon installer"
echo "✅ dist/uninstall.sh - Service uninstaller"
if [ -f "RemoteProviderServer-macOS.dmg" ]; then
    echo "✅ RemoteProviderServer-macOS.dmg - DMG installer"
fi
echo "✅ dist/README.txt - Installation instructions"
echo
echo "Distribution: Share the dist/ folder or DMG file"
echo "Quick install: sudo ./dist/install-daemon.sh"
echo "========================================"
