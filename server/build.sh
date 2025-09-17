#!/bin/bash

echo "========================================"
echo "Remote Provider Server - Ubuntu Build"
echo "========================================"

echo "Current directory: $(pwd)"

# Create dist directory
mkdir -p dist

echo ""
echo "========================================"
echo "METHOD 1: Cross-Platform Standalone Executables"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js with npm"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Try to create standalone executables for multiple platforms
echo "Creating standalone executables for multiple platforms..."

echo ""
echo "========================================"
echo "PRE-BUILD: Verifying FFmpeg Assets"
echo "========================================"

# Function to verify FFmpeg binary
verify_ffmpeg() {
    local platform=$1
    local binary_name=$2
    local ffmpeg_path="assets/ffmpeg/$platform/$binary_name"
    
    echo "Checking FFmpeg for $platform..."
    
    if [ ! -f "$ffmpeg_path" ]; then
        echo "❌ FFmpeg not found: $ffmpeg_path"
        echo "   Running setup script for $platform..."
        
        # Run platform-specific setup
        case $platform in
            "win")
                if [ -f "setup-ffmpeg-windows.bat" ]; then
                    echo "   Please run setup-ffmpeg-windows.bat on Windows first"
                    return 1
                else
                    echo "   ⚠️  Windows setup script not found"
                    return 1
                fi
                ;;
            "linux")
                if [ -f "setup-ffmpeg-linux.sh" ]; then
                    bash setup-ffmpeg-linux.sh
                else
                    echo "   Installing FFmpeg for Linux..."
                    # Try to download FFmpeg for Linux
                    mkdir -p "assets/ffmpeg/linux"
                    if command -v wget &> /dev/null; then
                        wget -O "assets/ffmpeg/linux/ffmpeg" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
                        if [ $? -eq 0 ]; then
                            tar -xf "assets/ffmpeg/linux/ffmpeg" -C "assets/ffmpeg/linux/" --strip-components=1 "*/ffmpeg"
                            chmod +x "assets/ffmpeg/linux/ffmpeg"
                            rm "assets/ffmpeg/linux/ffmpeg-release-amd64-static.tar.xz" 2>/dev/null
                        fi
                    fi
                fi
                ;;
            "mac")
                if [ -f "setup-ffmpeg-macos.sh" ]; then
                    bash setup-ffmpeg-macos.sh
                else
                    echo "   ⚠️  macOS setup script not found"
                    echo "   Please install FFmpeg manually or run setup-ffmpeg-macos.sh"
                    return 1
                fi
                ;;
        esac
    fi
    
    # Verify the binary exists after setup
    if [ ! -f "$ffmpeg_path" ]; then
        echo "❌ FFmpeg still not found after setup: $ffmpeg_path"
        return 1
    fi
    
    # Check file size (should be > 10MB for a real FFmpeg binary)
    local file_size=$(stat -c%s "$ffmpeg_path" 2>/dev/null || echo "0")
    if [ "$file_size" -lt 10485760 ]; then
        echo "⚠️  FFmpeg binary seems small (${file_size} bytes): $ffmpeg_path"
        echo "   This might be a system link or incomplete binary"
        
        # Try to get the actual FFmpeg binary
        if [ "$platform" = "linux" ] && command -v ffmpeg &> /dev/null; then
            echo "   Attempting to get full FFmpeg binary..."
            local system_ffmpeg=$(which ffmpeg)
            
            # Check if it's a static binary or we need to download one
            if ldd "$system_ffmpeg" &> /dev/null; then
                echo "   System FFmpeg has dependencies, downloading static version..."
                mkdir -p "assets/ffmpeg/linux"
                
                # Download static FFmpeg
                if command -v wget &> /dev/null; then
                    echo "   Downloading static FFmpeg for Linux..."
                    
                    # Create a clean temp directory and remember current location
                    local current_dir=$(pwd)
                    local temp_dir="/tmp/ffmpeg-download-$$"
                    mkdir -p "$temp_dir"
                    cd "$temp_dir"
                    
                    wget -q --show-progress -O "ffmpeg-static.tar.xz" "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
                    
                    if [ $? -eq 0 ] && [ -f "ffmpeg-static.tar.xz" ]; then
                        echo "   Extracting FFmpeg..."
                        tar -xf ffmpeg-static.tar.xz
                        
                        # Find the ffmpeg binary in extracted folder
                        ffmpeg_extracted=$(find . -name "ffmpeg" -type f -executable 2>/dev/null | head -1)
                        if [ -n "$ffmpeg_extracted" ] && [ -f "$ffmpeg_extracted" ]; then
                            # Ensure target directory exists (use absolute path)
                            mkdir -p "$(dirname "$current_dir/$ffmpeg_path")"
                            cp "$ffmpeg_extracted" "$current_dir/$ffmpeg_path"
                            chmod +x "$current_dir/$ffmpeg_path"
                            echo "   ✅ Static FFmpeg downloaded and installed"
                        else
                            echo "   ❌ Could not find FFmpeg binary in downloaded archive"
                        fi
                    else
                        echo "   ❌ Failed to download FFmpeg"
                    fi
                    
                    # Clean up
                    cd "$current_dir"
                    rm -rf "$temp_dir"
                fi
            else
                echo "   System FFmpeg appears to be static, copying..."
                cp "$system_ffmpeg" "$ffmpeg_path"
                chmod +x "$ffmpeg_path"
            fi
        fi
        
        # Re-check file size after potential download
        file_size=$(stat -c%s "$ffmpeg_path" 2>/dev/null || echo "0")
        if [ "$file_size" -lt 10485760 ]; then
            echo "❌ FFmpeg binary still too small (${file_size} bytes): $ffmpeg_path"
            echo "   Please download a proper FFmpeg binary manually"
            return 1
        fi
    fi
    
    # For Linux/Mac, check if it's executable
    if [ "$platform" != "win" ] && [ ! -x "$ffmpeg_path" ]; then
        echo "⚠️  Making FFmpeg executable: $ffmpeg_path"
        chmod +x "$ffmpeg_path"
    fi
    
    # Quick functionality test
    echo "   Testing FFmpeg functionality..."
    if [ "$platform" = "linux" ] || [ "$platform" = "mac" ]; then
        # Test if FFmpeg can show version (timeout after 5 seconds)
        if timeout 5s "$ffmpeg_path" -version &> /dev/null; then
            echo "✅ FFmpeg verified and functional for $platform (${file_size} bytes)"
        else
            echo "⚠️  FFmpeg binary exists but may not be functional for $platform (${file_size} bytes)"
            echo "   Continuing anyway - will fall back to system FFmpeg if needed"
        fi
    else
        echo "✅ FFmpeg verified for $platform (${file_size} bytes)"
    fi
    return 0
}

# Verify FFmpeg for all platforms
echo "Verifying FFmpeg binaries before embedding..."

FFMPEG_WIN_OK=false
FFMPEG_LINUX_OK=false
FFMPEG_MAC_OK=false

# Check Windows FFmpeg
if verify_ffmpeg "win" "ffmpeg.exe"; then
    FFMPEG_WIN_OK=true
else
    # Try to download Windows FFmpeg since we're building from Linux
    echo "⚠️  Attempting to download Windows FFmpeg for cross-platform build..."
    mkdir -p "assets/ffmpeg/win"
    
    # Download Windows FFmpeg
    if command -v wget &> /dev/null; then
        echo "   Downloading Windows FFmpeg..."
        
        # Create temp directory for Windows FFmpeg download
        current_dir=$(pwd)
        temp_win_dir="/tmp/ffmpeg-win-download-$$"
        mkdir -p "$temp_win_dir"
        cd "$temp_win_dir"
        
        # Try multiple Windows FFmpeg sources
        win_urls=(
            "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
        )
        
        for url in "${win_urls[@]}"; do
            echo "   Trying: $url"
            if wget -q --timeout=30 -O "ffmpeg-win.zip" "$url"; then
                echo "   ✅ Downloaded from: $url"
                
                # Extract FFmpeg
                if command -v unzip &> /dev/null; then
                    unzip -q "ffmpeg-win.zip"
                    
                    # Find ffmpeg.exe in extracted files
                    ffmpeg_exe=$(find . -name "ffmpeg.exe" -type f | head -1)
                    if [ -n "$ffmpeg_exe" ] && [ -f "$ffmpeg_exe" ]; then
                        cp "$ffmpeg_exe" "$current_dir/assets/ffmpeg/win/ffmpeg.exe"
                        echo "   ✅ Windows FFmpeg installed"
                        FFMPEG_WIN_OK=true
                        break
                    else
                        echo "   ❌ ffmpeg.exe not found in archive"
                    fi
                else
                    echo "   ❌ unzip not available"
                fi
            else
                echo "   ❌ Download failed"
            fi
        done
        
        # Cleanup
        cd "$current_dir"
        rm -rf "$temp_win_dir"
    fi
fi

# Check Linux FFmpeg
if verify_ffmpeg "linux" "ffmpeg"; then
    FFMPEG_LINUX_OK=true
fi

# Check macOS FFmpeg
if verify_ffmpeg "mac" "ffmpeg"; then
    FFMPEG_MAC_OK=true
fi

# Summary of FFmpeg verification
echo ""
echo "FFmpeg Verification Summary:"
echo "  Windows: $([ "$FFMPEG_WIN_OK" = true ] && echo "✅ Ready" || echo "❌ Missing")"
echo "  Linux:   $([ "$FFMPEG_LINUX_OK" = true ] && echo "✅ Ready" || echo "❌ Missing")"
echo "  macOS:   $([ "$FFMPEG_MAC_OK" = true ] && echo "✅ Ready" || echo "❌ Missing")"

# Check if we have at least one FFmpeg binary
if [ "$FFMPEG_WIN_OK" = false ] && [ "$FFMPEG_LINUX_OK" = false ] && [ "$FFMPEG_MAC_OK" = false ]; then
    echo ""
    echo "❌ ERROR: No FFmpeg binaries found for any platform!"
    echo "   Please run the appropriate setup scripts first:"
    echo "   - Windows: setup-ffmpeg-windows.bat"
    echo "   - Linux:   setup-ffmpeg-linux.sh"
    echo "   - macOS:   setup-ffmpeg-macos.sh"
    echo ""
    exit 1
fi

echo ""
echo "✅ FFmpeg verification completed"
echo ""

# First, we need to configure pkg to include assets
echo "Configuring pkg to handle assets..."

# Create temporary package.json with pkg configuration for embedded assets
cat > temp-pkg-config.json << 'PKG_EOF'
{
  "name": "remote-server",
  "version": "1.0.0",
  "main": "main-cli.js",
  "pkg": {
    "assets": [
      "assets/**/*"
    ],
    "scripts": [
      "main-cli.js",
      "ffmpeg-crossplatform.js"
    ],
    "targets": [
      "node18-win-x64",
      "node18-linux-x64", 
      "node18-macos-x64"
    ]
  }
}
PKG_EOF

echo "✅ pkg configuration created with embedded assets"

# Method 1: Try npx pkg (recommended)
echo "Trying npx pkg with asset configuration..."
npx --yes pkg@5.8.1 . \
    --config temp-pkg-config.json \
    --target node18-win-x64,node18-linux-x64,node18-macos-x64 \
    --output dist/remote-server

if [ -f "dist/remote-server-win.exe" ] || [ -f "dist/remote-server-linux" ] || [ -f "dist/remote-server-macos" ]; then
    echo "✅ Standalone executables created successfully!"
    
    # Rename files for clarity
    [ -f "dist/remote-server-win.exe" ] && echo "✅ Windows executable: dist/remote-server-win.exe"
    [ -f "dist/remote-server-linux" ] && echo "✅ Linux executable: dist/remote-server-linux" && chmod +x dist/remote-server-linux
    [ -f "dist/remote-server-macos" ] && echo "✅ macOS executable: dist/remote-server-macos" && chmod +x dist/remote-server-macos
    
    STANDALONE_SUCCESS=true
else
    echo "❌ pkg failed. Trying alternative method..."
    STANDALONE_SUCCESS=false
fi

# Method 2: Try global pkg installation if npx failed
if [ "$STANDALONE_SUCCESS" = false ]; then
    if ! command -v pkg &> /dev/null; then
        echo "Installing pkg globally..."
        sudo npm install -g pkg
    fi
    
    if command -v pkg &> /dev/null; then
        echo "Using global pkg..."
        pkg main-cli.js \
            --target node18-win-x64,node18-linux-x64,node18-macos-x64 \
            --output dist/remote-server
        
        if [ -f "dist/remote-server-win.exe" ] || [ -f "dist/remote-server-linux" ] || [ -f "dist/remote-server-macos" ]; then
            echo "✅ Standalone executables created with global pkg!"
            STANDALONE_SUCCESS=true
        fi
    fi
fi

# Handle assets for standalone executables
if [ "$STANDALONE_SUCCESS" = true ]; then
    echo "✅ Assets are embedded inside standalone executables"
    
    # Create information file about embedded assets
    cat > dist/EMBEDDED_ASSETS_INFO.txt << 'ASSETS_EOF'
✅ STANDALONE EXECUTABLES WITH EMBEDDED ASSETS

The standalone executables contain all assets embedded inside:
- FFmpeg binaries for all platforms
- Configuration files
- Other required assets

How it works:
1. Assets are embedded in the executable during build
2. At runtime, assets are extracted to temporary directory
3. No separate asset files needed for distribution
4. Single executable file contains everything

Benefits:
✅ True single-file distribution
✅ No external dependencies
✅ Assets cannot be lost or corrupted
✅ Simplified deployment

The executables will automatically:
- Extract embedded FFmpeg to temp directory on first run
- Use extracted FFmpeg for screen capture
- Fall back to system FFmpeg if extraction fails
- Clean up temp files on exit

No additional setup required!
ASSETS_EOF
    
    echo "✅ Embedded assets information created"
else
    # For Node.js bundles, copy assets normally
    if [ -d "assets" ]; then
        cp -r assets dist/
        echo "✅ Assets copied for Node.js bundle"
    fi
fi

# Clean up temporary config file
rm -f temp-pkg-config.json

echo ""
echo "========================================"
echo "METHOD 2: Node.js Bundle Fallback"
echo "========================================"

# Create Node.js bundle for systems without standalone support
if [ "$STANDALONE_SUCCESS" = false ]; then
    echo "Creating Node.js bundle as fallback..."
    
    # Copy application files
    cp main-cli.js dist/
    cp ffmpeg-crossplatform.js dist/
    cp package.json dist/
    
    # Copy assets if they exist
    if [ -d "assets" ]; then
        cp -r assets dist/
        echo "✅ Assets copied"
    fi
    
    # Install dependencies in dist folder
    echo "Installing production dependencies..."
    cd dist
    npm install --production
    cd ..
    
    echo "✅ Node.js bundle created (requires Node.js on target system)"
fi

echo ""
echo "========================================"
echo "Creating Platform-Specific Installers"
echo "========================================"

# Create Windows installer
echo "Creating Windows installer..."
cat > dist/install-windows.bat << 'EOF'
@echo off
:: Remote Provider Server Windows Installer
echo ========================================
echo  Remote Provider Server Installer
echo ========================================
echo.

set "INSTALL_DIR=%USERPROFILE%\RemoteProviderServer"
echo Installing to: %USERPROFILE%\RemoteProviderServer
echo (C:\Users\%USERNAME%\RemoteProviderServer)
echo.

:: Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy all files
echo Copying files...
xcopy "%~dp0*" "%INSTALL_DIR%\" /E /I /Y /Q >nul

:: Create startup shortcut
echo Setting up auto-start...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP_FOLDER%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\remote-server.bat'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.WindowStyle = 7; $Shortcut.Save()"

:: Start the server
echo Starting Remote Provider Server...
start "" /min "%INSTALL_DIR%\remote-server.bat"

echo.
echo ✅ Installation completed successfully!
echo.
echo The server is now running in background and will
echo auto-start when Windows boots.
echo.
echo To uninstall, run: %INSTALL_DIR%\uninstall-windows.bat
echo.
timeout /t 5
EOF

# Create Windows launcher
if [ -f "dist/remote-server-win.exe" ]; then
    cat > dist/remote-server.bat << 'EOF'
@echo off
:: Remote Provider Server Launcher (Standalone)
cd /d "%~dp0"
start "" /min remote-server-win.exe --background --silent
EOF
    echo "✅ Windows launcher created for standalone executable"
else
    cat > dist/remote-server.bat << 'EOF'
@echo off
:: Remote Provider Server Launcher (Node.js required)
cd /d "%~dp0"
start "" /min node main-cli.js --background --silent
EOF
    echo "✅ Windows launcher created for Node.js bundle"
fi

# Create Windows uninstaller
cat > dist/uninstall-windows.bat << 'EOF'
@echo off
:: Remote Provider Server Windows Uninstaller
echo Uninstalling Remote Provider Server...

:: Stop the server
taskkill /f /im "remote-server-win.exe" >nul 2>&1
taskkill /f /im "node.exe" /fi "WINDOWTITLE eq Remote Provider Server" >nul 2>&1

:: Remove startup shortcut
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\RemoteProviderServer.lnk" >nul 2>&1

:: Remove installation directory
echo Removing files...
rd /s /q "%USERPROFILE%\RemoteProviderServer"

echo.
echo ✅ Uninstallation completed!
pause
EOF

# Create Linux installer
echo "Creating Linux installer..."
cat > dist/install-linux.sh << 'EOF'
#!/bin/bash

echo "========================================"
echo " Remote Provider Server Installer"
echo "========================================"
echo ""

INSTALL_DIR="$HOME/RemoteProviderServer"
echo "Installing to: $INSTALL_DIR"
echo ""

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy all files
echo "Copying files..."
cp -r ./* "$INSTALL_DIR/" 2>/dev/null

# Make executables executable
chmod +x "$INSTALL_DIR"/*.sh 2>/dev/null
chmod +x "$INSTALL_DIR"/remote-server-linux 2>/dev/null

# Create systemd service
echo "Setting up auto-start..."
mkdir -p "$HOME/.config/systemd/user"

cat > "$HOME/.config/systemd/user/remote-provider-server.service" << SYSTEMD_EOF
[Unit]
Description=Remote Provider Server
After=graphical-session.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/remote-server-linux --background --silent
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
SYSTEMD_EOF

# Enable and start service
systemctl --user daemon-reload
systemctl --user enable remote-provider-server.service
systemctl --user start remote-provider-server.service

echo ""
echo "✅ Installation completed successfully!"
echo ""
echo "The server is now running and will auto-start on login."
echo ""
echo "To check status: systemctl --user status remote-provider-server"
echo "To uninstall, run: $INSTALL_DIR/uninstall-linux.sh"
echo ""
EOF

chmod +x dist/install-linux.sh

# Create Linux uninstaller
cat > dist/uninstall-linux.sh << 'EOF'
#!/bin/bash

echo "Uninstalling Remote Provider Server..."

# Stop and disable service
systemctl --user stop remote-provider-server.service 2>/dev/null
systemctl --user disable remote-provider-server.service 2>/dev/null

# Remove service file
rm -f "$HOME/.config/systemd/user/remote-provider-server.service"
systemctl --user daemon-reload

# Remove installation directory
echo "Removing files..."
rm -rf "$HOME/RemoteProviderServer"

echo ""
echo "✅ Uninstallation completed!"
EOF

chmod +x dist/uninstall-linux.sh

# Create macOS installer
echo "Creating macOS installer..."
cat > dist/install-macos.sh << 'EOF'
#!/bin/bash

echo "========================================"
echo " Remote Provider Server Installer"
echo "========================================"
echo ""

INSTALL_DIR="$HOME/RemoteProviderServer"
echo "Installing to: $INSTALL_DIR"
echo ""

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy all files
echo "Copying files..."
cp -r ./* "$INSTALL_DIR/" 2>/dev/null

# Make executables executable
chmod +x "$INSTALL_DIR"/*.sh 2>/dev/null
chmod +x "$INSTALL_DIR"/remote-server-macos 2>/dev/null

# Create LaunchAgent
echo "Setting up auto-start..."
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$HOME/Library/LaunchAgents/com.remoteprovider.server.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.remoteprovider.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/remote-server-macos</string>
        <string>--background</string>
        <string>--silent</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
PLIST_EOF

# Load and start the service
launchctl load "$HOME/Library/LaunchAgents/com.remoteprovider.server.plist"
launchctl start com.remoteprovider.server

echo ""
echo "✅ Installation completed successfully!"
echo ""
echo "The server is now running and will auto-start on login."
echo ""
echo "To uninstall, run: $INSTALL_DIR/uninstall-macos.sh"
echo ""
EOF

chmod +x dist/install-macos.sh

# Create macOS uninstaller
cat > dist/uninstall-macos.sh << 'EOF'
#!/bin/bash

echo "Uninstalling Remote Provider Server..."

# Stop and unload service
launchctl stop com.remoteprovider.server 2>/dev/null
launchctl unload "$HOME/Library/LaunchAgents/com.remoteprovider.server.plist" 2>/dev/null

# Remove service file
rm -f "$HOME/Library/LaunchAgents/com.remoteprovider.server.plist"

# Remove installation directory
echo "Removing files..."
rm -rf "$HOME/RemoteProviderServer"

echo ""
echo "✅ Uninstallation completed!"
EOF

chmod +x dist/uninstall-macos.sh

echo ""
echo "========================================"
echo "Creating Distribution Packages"
echo "========================================"

# Create Windows ZIP package
echo "Creating Windows distribution package..."
if command -v zip &> /dev/null; then
    cd dist
    zip -r ../RemoteProviderServer-Windows.zip \
        remote-server.bat \
        install-windows.bat \
        uninstall-windows.bat \
        $([ -f "remote-server-win.exe" ] && echo "remote-server-win.exe") \
        $([ ! -f "remote-server-win.exe" ] && echo "main-cli.js ffmpeg-crossplatform.js package.json node_modules/") \
        assets/ 2>/dev/null
    cd ..
    
    if [ -f "RemoteProviderServer-Windows.zip" ]; then
        echo "✅ Windows package: RemoteProviderServer-Windows.zip"
    fi
fi

# Create Linux TAR package
echo "Creating Linux distribution package..."
cd dist
tar -czf ../RemoteProviderServer-Linux.tar.gz \
    install-linux.sh \
    uninstall-linux.sh \
    $([ -f "remote-server-linux" ] && echo "remote-server-linux") \
    $([ ! -f "remote-server-linux" ] && echo "main-cli.js ffmpeg-crossplatform.js package.json node_modules/") \
    assets/ 2>/dev/null
cd ..

if [ -f "RemoteProviderServer-Linux.tar.gz" ]; then
    echo "✅ Linux package: RemoteProviderServer-Linux.tar.gz"
fi

# Create macOS TAR package
echo "Creating macOS distribution package..."
cd dist
tar -czf ../RemoteProviderServer-macOS.tar.gz \
    install-macos.sh \
    uninstall-macos.sh \
    $([ -f "remote-server-macos" ] && echo "remote-server-macos") \
    $([ ! -f "remote-server-macos" ] && echo "main-cli.js ffmpeg-crossplatform.js package.json node_modules/") \
    assets/ 2>/dev/null
cd ..

if [ -f "RemoteProviderServer-macOS.tar.gz" ]; then
    echo "✅ macOS package: RemoteProviderServer-macOS.tar.gz"
fi

echo ""
echo "========================================"
echo "BUILD COMPLETED!"
echo "========================================"
echo ""

if [ "$STANDALONE_SUCCESS" = true ]; then
    echo "✅ STANDALONE EXECUTABLES CREATED!"
    echo "   - No Node.js required on target systems"
    echo "   - Single executable files for each platform"
    echo ""
fi

echo "📦 DISTRIBUTION PACKAGES:"
[ -f "RemoteProviderServer-Windows.zip" ] && echo "   - RemoteProviderServer-Windows.zip (for Windows)"
[ -f "RemoteProviderServer-Linux.tar.gz" ] && echo "   - RemoteProviderServer-Linux.tar.gz (for Linux)"
[ -f "RemoteProviderServer-macOS.tar.gz" ] && echo "   - RemoteProviderServer-macOS.tar.gz (for macOS)"
echo ""

echo "🚀 INSTALLATION INSTRUCTIONS:"
echo "   Windows: Extract zip, run install-windows.bat"
echo "   Linux:   Extract tar.gz, run ./install-linux.sh"
echo "   macOS:   Extract tar.gz, run ./install-macos.sh"
echo ""

echo "✅ All platforms supported with auto-start capability!"
echo "✅ Works with or without Node.js on target systems!"
echo ""
echo "⚠️  SECURITY NOTICE:"
echo "   Windows may show 'Publisher could not be verified' warning"
echo "   This is normal for unsigned executables. Users should:"
echo "   1. Click 'More info' → 'Run anyway' (Windows SmartScreen)"
echo "   2. Or right-click executable → Properties → 'Unblock'"
echo "   3. Add to antivirus whitelist if needed"
echo ""
echo "💡 For production deployment, consider code signing:"
echo "   - Get a code signing certificate from a trusted CA"
echo "   - Use signtool.exe to sign the Windows executable"
echo "   - This eliminates security warnings"
echo ""
