#!/bin/bash
echo "========================================"
echo "Remote Provider Server - Linux Build"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js:"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  CentOS/RHEL: sudo yum install nodejs npm"
    echo "  Or from: https://nodejs.org/"
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
echo "STEP 1: Building Linux Executable"
echo "========================================"
pkg main-cli.js --targets node18-linux-x64 --output dist/svchost

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
echo "STEP 2: Setting up FFmpeg for Linux"
echo "========================================"

# Check if FFmpeg setup script exists
if [ -f "setup-ffmpeg-linux.sh" ]; then
    echo "Running FFmpeg setup script..."
    ./setup-ffmpeg-linux.sh
else
    echo "⚠️  FFmpeg setup script not found: setup-ffmpeg-linux.sh"
    echo "Please run ./setup-ffmpeg-linux.sh first to install FFmpeg"
    exit 1
fi

echo "========================================"
echo "STEP 3: Creating systemd Service"
echo "========================================"

# Create installation script
cat > dist/install-service.sh << 'EOF'
#!/bin/bash
# Remote Provider Server - Linux systemd Service Installer

echo "========================================"
echo "Remote Provider Server Installation"
echo "========================================"
echo

# Check for admin privileges
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Administrator privileges required!"
    echo "Please run with sudo: sudo ./install-service.sh"
    exit 1
fi

INSTALL_DIR="/opt/remote-provider"
SERVICE_DIR="$(dirname "$0")"
SERVICE_FILE="/etc/systemd/system/remote-provider.service"

echo "Installing from: $SERVICE_DIR"
echo "Install directory: $INSTALL_DIR"
echo

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy files
cp -r "$SERVICE_DIR"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/svchost"

# Create systemd service file
cat > "$SERVICE_FILE" << SERVICE_EOF
[Unit]
Description=Remote Provider Server
After=network.target graphical-session.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/svchost
Environment=DISPLAY=:0
Environment=HOME=/root
Environment=XAUTHORITY=/root/.Xauthority
# Try to set X11 permissions before starting
ExecStartPre=/bin/bash -c 'xhost +local: 2>/dev/null || true'
ExecStartPre=/bin/bash -c 'xhost +localhost 2>/dev/null || true'

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Configure X11 permissions for screen capture
echo "Configuring X11 permissions..."
# Allow local connections for screen capture
if command -v xhost &> /dev/null && [ -n "$DISPLAY" ]; then
    xhost +local: 2>/dev/null || echo "Note: Could not set xhost permissions (may need GUI session)"
    xhost +localhost 2>/dev/null || true
    echo "X11 permissions configured for screen capture"
else
    echo "Note: X11 permissions will be set by service startup"
fi

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable remote-provider.service
systemctl start remote-provider.service

# Add to startup applications (for GUI environments)
AUTOSTART_DIR="/etc/xdg/autostart"
if [ -d "$AUTOSTART_DIR" ]; then
    cat > "$AUTOSTART_DIR/remote-provider.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=Remote Provider Server
Exec=$INSTALL_DIR/svchost
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
DESKTOP_EOF
fi

echo "========================================"
echo "INSTALLATION COMPLETED!"
echo "Service will auto-start on system boot"
echo "========================================"
echo

# Check service status and provide troubleshooting
SERVICE_STATUS=$(systemctl is-active remote-provider.service 2>/dev/null || echo "failed")
echo "Service status: $SERVICE_STATUS"

if [ "$SERVICE_STATUS" != "active" ]; then
    echo ""
    echo "⚠️  Service not running. Common fixes:"
    echo "1. For X11 display issues: xhost +local:"
    echo "2. Restart service: systemctl restart remote-provider.service"
    echo "3. Check logs: journalctl -u remote-provider.service -f"
    echo ""
fi

echo "Service logs: journalctl -u remote-provider.service -f"
EOF

chmod +x dist/install-service.sh

# Create uninstaller
cat > dist/uninstall.sh << 'EOF'
#!/bin/bash
echo "Uninstalling Remote Provider Server..."

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Administrator privileges required!"
    echo "Please run with sudo: sudo ./uninstall.sh"
    exit 1
fi

SERVICE_FILE="/etc/systemd/system/remote-provider.service"
INSTALL_DIR="/opt/remote-provider"
AUTOSTART_FILE="/etc/xdg/autostart/remote-provider.desktop"

# Stop and disable service
systemctl stop remote-provider.service 2>/dev/null
systemctl disable remote-provider.service 2>/dev/null

# Remove files
rm -f "$SERVICE_FILE"
rm -rf "$INSTALL_DIR"
rm -f "$AUTOSTART_FILE"

# Remove logs
rm -f /var/log/remote-provider.log
rm -f /var/log/remote-provider-error.log

# Reload systemd
systemctl daemon-reload

echo "Remote Provider Server completely removed!"
echo "Note: User configuration in ~/.config/remote-provider/ preserved"
echo "To remove user config: rm -rf ~/.config/remote-provider/"
EOF

chmod +x dist/uninstall.sh

echo "========================================"
echo "STEP 4: Creating Debian Package"
echo "========================================"

# Create debian package structure
DEB_DIR="dist/remote-provider-server_1.0.0_amd64"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/opt/remote-provider"
mkdir -p "$DEB_DIR/etc/systemd/system"

# Copy files to package
cp dist/svchost "$DEB_DIR/opt/remote-provider/"
cp -r dist/assets "$DEB_DIR/opt/remote-provider/" 2>/dev/null || true
cp dist/*.js "$DEB_DIR/opt/remote-provider/" 2>/dev/null || true

# Create control file
cat > "$DEB_DIR/DEBIAN/control" << 'EOF'
Package: remote-provider-server
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Depends: ffmpeg
Maintainer: Remote Provider <support@remoteprovider.com>
Description: Remote Provider Server
 Remote desktop server for screen sharing and remote assistance.
 Provides secure remote access with screen capture capabilities.
EOF

# Create systemd service file for package
cat > "$DEB_DIR/etc/systemd/system/remote-provider.service" << 'EOF'
[Unit]
Description=Remote Provider Server
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
WorkingDirectory=/opt/remote-provider
ExecStart=/opt/remote-provider/svchost
Environment=DISPLAY=:0
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
EOF

# Create postinst script
cat > "$DEB_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
systemctl daemon-reload
systemctl enable remote-provider.service
systemctl start remote-provider.service
echo "Remote Provider Server installed and started"
EOF

# Create prerm script (runs BEFORE removal)
cat > "$DEB_DIR/DEBIAN/prerm" << 'EOF'
#!/bin/bash
echo "Stopping Remote Provider Server..."
systemctl stop remote-provider.service 2>/dev/null || true
systemctl disable remote-provider.service 2>/dev/null || true
EOF

# Create postrm script (runs AFTER removal)
cat > "$DEB_DIR/DEBIAN/postrm" << 'EOF'
#!/bin/bash
echo "Cleaning up Remote Provider Server..."

# Remove service file
rm -f /etc/systemd/system/remote-provider.service

# Remove installation directory
rm -rf /opt/remote-provider

# Remove autostart entries
rm -f /etc/xdg/autostart/remote-provider.desktop

# Remove logs
rm -f /var/log/remote-provider.log
rm -f /var/log/remote-provider-error.log

# Reload systemd to remove service references
systemctl daemon-reload 2>/dev/null || true

# Remove user data (server-id.txt) - this is in user's home directory
# Note: We don't remove this automatically as it contains user's unique server ID
# Users can manually remove ~/.config/remote-provider/ if desired

echo "Remote Provider Server completely removed"
echo "Note: User configuration in ~/.config/remote-provider/ preserved"
EOF

chmod +x "$DEB_DIR/DEBIAN/postinst"
chmod +x "$DEB_DIR/DEBIAN/prerm"
chmod +x "$DEB_DIR/DEBIAN/postrm"
chmod +x "$DEB_DIR/opt/remote-provider/svchost"

# Build debian package if dpkg-deb is available
if command -v dpkg-deb &> /dev/null; then
    echo "Creating Debian package..."
    dpkg-deb --build "$DEB_DIR"
    if [ $? -eq 0 ]; then
        echo "✅ Debian package created: ${DEB_DIR}.deb"
        mv "${DEB_DIR}.deb" "dist/"
    fi
fi

echo "========================================"
echo "STEP 5: Creating AppImage Package"
echo "========================================"

# Create AppImage if appimagetool is available or can be downloaded
create_appimage() {
    local APPDIR="dist/RemoteProviderServer.AppDir"
    
    echo "Creating AppImage structure..."
    mkdir -p "$APPDIR/usr/bin"
    mkdir -p "$APPDIR/usr/lib"
    mkdir -p "$APPDIR/usr/share/applications"
    mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"
    
    # Copy executable and assets
    cp dist/svchost "$APPDIR/usr/bin/remote-provider-server"
    chmod +x "$APPDIR/usr/bin/remote-provider-server"
    
    # Copy assets
    if [ -d "dist/assets" ]; then
        cp -r dist/assets "$APPDIR/usr/lib/"
    fi
    
    # Copy JavaScript modules
    if [ -f "dist/ffmpeg-crossplatform.js" ]; then
        cp dist/ffmpeg-crossplatform.js "$APPDIR/usr/lib/"
    fi
    
    # Create desktop entry
    cat > "$APPDIR/usr/share/applications/remote-provider-server.desktop" << 'DESKTOP_EOF'
[Desktop Entry]
Type=Application
Name=Remote Provider Server
Comment=Remote desktop server for screen sharing
Exec=remote-provider-server
Icon=remote-provider-server
Categories=Network;RemoteAccess;
Terminal=true
StartupNotify=true
DESKTOP_EOF
    
    # Create a simple icon (text-based)
    cat > "$APPDIR/usr/share/icons/hicolor/256x256/apps/remote-provider-server.svg" << 'SVG_EOF'
<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" fill="#2196F3"/>
  <rect x="32" y="32" width="192" height="144" fill="#fff" stroke="#333" stroke-width="4"/>
  <circle cx="128" cy="104" r="20" fill="#2196F3"/>
  <rect x="64" y="160" width="128" height="32" fill="#4CAF50"/>
  <text x="128" y="210" text-anchor="middle" fill="#fff" font-family="Arial" font-size="20">Remote Provider</text>
</svg>
SVG_EOF
    
    # Create AppRun script
    cat > "$APPDIR/AppRun" << 'APPRUN_EOF'
#!/bin/bash
HERE="$(dirname "$(readlink -f "${0}")")"
export PATH="${HERE}/usr/bin:${PATH}"
export LD_LIBRARY_PATH="${HERE}/usr/lib:${LD_LIBRARY_PATH}"

# Set up environment
export APPDIR="${HERE}"

# Check for X11 display
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
fi

# Run the application
cd "${HERE}/usr/lib"
exec "${HERE}/usr/bin/remote-provider-server" "$@"
APPRUN_EOF
    
    chmod +x "$APPDIR/AppRun"
    
    # Create symlinks required by AppImage
    ln -sf usr/share/applications/remote-provider-server.desktop "$APPDIR/"
    ln -sf usr/share/icons/hicolor/256x256/apps/remote-provider-server.svg "$APPDIR/"
    
    # Download appimagetool if not available
    if ! command -v appimagetool &> /dev/null; then
        echo "Downloading appimagetool..."
        wget -q "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" -O appimagetool
        chmod +x appimagetool
        APPIMAGETOOL_CMD="./appimagetool"
    else
        APPIMAGETOOL_CMD="appimagetool"
    fi
    
    # Create AppImage
    echo "Building AppImage..."
    ARCH=x86_64 $APPIMAGETOOL_CMD "$APPDIR" "RemoteProviderServer-x86_64.AppImage"
    
    if [ $? -eq 0 ]; then
        echo "✅ AppImage created: RemoteProviderServer-x86_64.AppImage"
        mv "RemoteProviderServer-x86_64.AppImage" "dist/"
        
        # Clean up
        rm -rf "$APPDIR"
        rm -f appimagetool
        
        return 0
    else
        echo "❌ AppImage creation failed"
        return 1
    fi
}

# Try to create AppImage
if create_appimage; then
    echo "AppImage creation successful"
else
    echo "AppImage creation skipped (tools not available)"
fi

echo "========================================"
echo "STEP 6: Creating RPM Package"
echo "========================================"

# Create RPM spec file if rpmbuild is available
if command -v rpmbuild &> /dev/null; then
    mkdir -p dist/rpm/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
    
    # Create tar archive for sources
    tar -czf "dist/rpm/SOURCES/remote-provider-server-1.0.0.tar.gz" -C dist svchost assets/ *.js 2>/dev/null || tar -czf "dist/rpm/SOURCES/remote-provider-server-1.0.0.tar.gz" -C dist svchost

    cat > "dist/rpm/SPECS/remote-provider-server.spec" << 'EOF'
Name: remote-provider-server
Version: 1.0.0
Release: 1%{?dist}
Summary: Remote Provider Server
License: MIT
Source0: %{name}-%{version}.tar.gz
Requires: ffmpeg
BuildArch: x86_64

%description
Remote desktop server for screen sharing and remote assistance.
Provides secure remote access with screen capture capabilities.

%prep
%setup -q -n .

%build

%install
mkdir -p %{buildroot}/opt/remote-provider
mkdir -p %{buildroot}/etc/systemd/system
cp -r * %{buildroot}/opt/remote-provider/

cat > %{buildroot}/etc/systemd/system/remote-provider.service << SERVICE_EOF
[Unit]
Description=Remote Provider Server
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
WorkingDirectory=/opt/remote-provider
ExecStart=/opt/remote-provider/svchost
Environment=DISPLAY=:0
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
SERVICE_EOF

%post
systemctl daemon-reload
systemctl enable remote-provider.service
systemctl start remote-provider.service

%preun
systemctl stop remote-provider.service
systemctl disable remote-provider.service

%files
/opt/remote-provider/*
/etc/systemd/system/remote-provider.service

%changelog
* $(date +'%a %b %d %Y') Remote Provider <support@remoteprovider.com> - 1.0.0-1
- Initial package
EOF

    echo "Creating RPM package..."
    rpmbuild --define "_topdir $(pwd)/dist/rpm" -ba "dist/rpm/SPECS/remote-provider-server.spec"
    if [ $? -eq 0 ]; then
        echo "✅ RPM package created in dist/rpm/RPMS/"
        find dist/rpm/RPMS/ -name "*.rpm" -exec cp {} dist/ \;
    fi
fi

# Clean up temporary directories
rm -rf "$DEB_DIR"

# Create final README
cat > dist/README.txt << 'EOF'
Remote Provider Server - Linux Distribution
==========================================

INSTALLATION OPTIONS:

1. Manual Installation:
   sudo ./install-service.sh

2. Debian Package (Ubuntu/Debian):
   sudo dpkg -i remote-provider-server_1.0.0_amd64.deb

3. RPM Package (CentOS/RHEL/Fedora):
   sudo rpm -i remote-provider-server-1.0.0-1.x86_64.rpm

4. AppImage (Portable):
   chmod +x RemoteProviderServer-x86_64.AppImage
   ./RemoteProviderServer-x86_64.AppImage
   (No installation required - runs from anywhere)

UNINSTALLATION:
   sudo ./uninstall.sh

FEATURES:
- systemd service integration
- Auto-start on boot
- x11grab screen capture
- Background operation
- System log integration

LOGS:
   journalctl -u remote-provider.service -f

REQUIREMENTS:
- Linux with X11
- FFmpeg (automatically installed with packages)
EOF

echo
echo "========================================"
echo "LINUX BUILD COMPLETED!"
echo "========================================"
echo
echo "Files created:"
echo "✅ dist/svchost - Main executable"
echo "✅ dist/install-service.sh - systemd service installer"
echo "✅ dist/uninstall.sh - Service uninstaller"
if [ -f "dist/remote-provider-server_1.0.0_amd64.deb" ]; then
    echo "✅ dist/remote-provider-server_1.0.0_amd64.deb - Debian package"
fi
if ls dist/*.rpm &> /dev/null; then
    echo "✅ dist/*.rpm - RPM package"
fi
if [ -f "dist/RemoteProviderServer-x86_64.AppImage" ]; then
    echo "✅ dist/RemoteProviderServer-x86_64.AppImage - Portable AppImage"
fi
echo "✅ dist/README.txt - Installation instructions"
echo
echo "Distribution options:"
echo "- Manual: Share dist/ folder, run sudo ./install-service.sh"
echo "- Debian: sudo dpkg -i remote-provider-server_1.0.0_amd64.deb"
echo "- RPM: sudo rpm -i *.rpm"
if [ -f "dist/RemoteProviderServer-x86_64.AppImage" ]; then
    echo "- AppImage: ./RemoteProviderServer-x86_64.AppImage (portable, no installation)"
fi
echo "========================================"
