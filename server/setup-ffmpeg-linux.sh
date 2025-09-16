#!/bin/bash
echo "========================================"
echo "FFmpeg Setup for Linux"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "main-cli.js" ]; then
    echo "ERROR: Please run this script from the server directory."
    exit 1
fi

echo "Current directory: $(pwd)"

# Create FFmpeg directory structure
mkdir -p assets/ffmpeg/linux

echo "========================================"
echo "Checking FFmpeg Installation"
echo "========================================"

# Check if FFmpeg already exists in assets
if [ -f "assets/ffmpeg/linux/ffmpeg" ]; then
    echo "✅ FFmpeg found in assets/ffmpeg/linux/"
    chmod +x assets/ffmpeg/linux/ffmpeg
    test_ffmpeg
    exit 0
fi

# Check if system FFmpeg is available
echo "Checking for system FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ System FFmpeg found at: $(which ffmpeg)"
    echo "Version: $(ffmpeg -version 2>&1 | head -n1)"
    echo "Note: System FFmpeg will be used, but bundled version recommended for distribution"
    
    read -p "Do you want to copy system FFmpeg to assets for bundling? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp "$(which ffmpeg)" assets/ffmpeg/linux/ffmpeg
        chmod +x assets/ffmpeg/linux/ffmpeg
        echo "✅ FFmpeg copied to assets/ffmpeg/linux/"
    fi
    
    test_ffmpeg
    exit 0
fi

echo "❌ No FFmpeg found"

echo "========================================"
echo "Installing FFmpeg for Linux"
echo "========================================"

# Detect Linux distribution and install FFmpeg
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
    echo "Detected Linux distribution: $PRETTY_NAME"
else
    echo "Cannot detect Linux distribution"
    DISTRO="unknown"
fi

install_ffmpeg() {
    case $DISTRO in
        "ubuntu"|"debian"|"linuxmint"|"pop")
            echo "Installing FFmpeg on Debian/Ubuntu-based system..."
            if command -v apt &> /dev/null; then
                sudo apt update
                sudo apt install -y ffmpeg
            else
                echo "❌ apt package manager not found"
                return 1
            fi
            ;;
        "centos"|"rhel"|"rocky"|"almalinux")
            echo "Installing FFmpeg on CentOS/RHEL-based system..."
            if command -v dnf &> /dev/null; then
                sudo dnf install -y epel-release
                sudo dnf install -y ffmpeg
            elif command -v yum &> /dev/null; then
                sudo yum install -y epel-release
                sudo yum install -y ffmpeg
            else
                echo "❌ yum/dnf package manager not found"
                return 1
            fi
            ;;
        "fedora")
            echo "Installing FFmpeg on Fedora..."
            if command -v dnf &> /dev/null; then
                sudo dnf install -y ffmpeg
            else
                echo "❌ dnf package manager not found"
                return 1
            fi
            ;;
        "arch"|"manjaro"|"endeavouros")
            echo "Installing FFmpeg on Arch-based system..."
            if command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm ffmpeg
            else
                echo "❌ pacman package manager not found"
                return 1
            fi
            ;;
        "opensuse"|"suse")
            echo "Installing FFmpeg on openSUSE..."
            if command -v zypper &> /dev/null; then
                sudo zypper install -y ffmpeg
            else
                echo "❌ zypper package manager not found"
                return 1
            fi
            ;;
        "alpine")
            echo "Installing FFmpeg on Alpine Linux..."
            if command -v apk &> /dev/null; then
                sudo apk add ffmpeg
            else
                echo "❌ apk package manager not found"
                return 1
            fi
            ;;
        *)
            echo "⚠️  Unknown or unsupported Linux distribution: $DISTRO"
            echo "Attempting generic installation methods..."
            
            # Try common package managers
            if command -v apt &> /dev/null; then
                echo "Trying apt..."
                sudo apt update && sudo apt install -y ffmpeg
            elif command -v dnf &> /dev/null; then
                echo "Trying dnf..."
                sudo dnf install -y ffmpeg
            elif command -v yum &> /dev/null; then
                echo "Trying yum..."
                sudo yum install -y ffmpeg
            elif command -v pacman &> /dev/null; then
                echo "Trying pacman..."
                sudo pacman -S --noconfirm ffmpeg
            elif command -v zypper &> /dev/null; then
                echo "Trying zypper..."
                sudo zypper install -y ffmpeg
            else
                echo "❌ No supported package manager found"
                return 1
            fi
            ;;
    esac
}

# Try to install FFmpeg
echo "Installing FFmpeg..."
if install_ffmpeg; then
    if command -v ffmpeg &> /dev/null; then
        echo "✅ FFmpeg installed successfully"
        echo "Version: $(ffmpeg -version 2>&1 | head -n1)"
        
        # Ask if user wants to bundle FFmpeg
        read -p "Do you want to copy FFmpeg to assets for bundling? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp "$(which ffmpeg)" assets/ffmpeg/linux/ffmpeg
            chmod +x assets/ffmpeg/linux/ffmpeg
            echo "✅ FFmpeg copied to assets/ffmpeg/linux/"
        fi
    else
        echo "❌ FFmpeg installation failed"
        manual_instructions
        exit 1
    fi
else
    echo "❌ FFmpeg installation failed"
    manual_instructions
    exit 1
fi

test_ffmpeg() {
    echo "========================================"
    echo "Testing FFmpeg Installation"
    echo "========================================"
    
    # Determine which FFmpeg to test
    local ffmpeg_path=""
    if [ -f "assets/ffmpeg/linux/ffmpeg" ]; then
        ffmpeg_path="assets/ffmpeg/linux/ffmpeg"
        echo "Testing bundled FFmpeg..."
    elif command -v ffmpeg &> /dev/null; then
        ffmpeg_path="ffmpeg"
        echo "Testing system FFmpeg..."
    else
        echo "❌ No FFmpeg found to test"
        return 1
    fi
    
    # Test FFmpeg functionality
    echo "Testing FFmpeg functionality..."
    $ffmpeg_path -version > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ FFmpeg is working correctly"
        echo "Version: $($ffmpeg_path -version 2>&1 | head -n1)"
    else
        echo "❌ FFmpeg test failed"
        return 1
    fi
    
    # Check for X11 display
    if [ -z "$DISPLAY" ]; then
        echo "⚠️  No X11 display detected"
        echo "Screen capture may not work without X11"
        echo "Make sure you're running in a graphical environment"
        echo "Setting DISPLAY=:0 as fallback"
        export DISPLAY=:0
    else
        echo "✅ X11 display detected: $DISPLAY"
    fi
    
    # Configure X11 permissions for screen capture
    echo "Configuring X11 permissions..."
    
    # Allow local connections (required for screen capture)
    if command -v xhost &> /dev/null; then
        echo "Setting X11 access permissions..."
        xhost +local: 2>/dev/null || echo "Note: Could not set xhost permissions (may need GUI session)"
        
        # Also try to allow localhost specifically
        xhost +localhost 2>/dev/null || true
        xhost +127.0.0.1 2>/dev/null || true
    else
        echo "⚠️  xhost command not found - X11 permissions may need manual configuration"
    fi
    
    # Check for common X11 authority files
    echo "Checking X11 authority..."
    if [ -n "$XAUTHORITY" ]; then
        echo "✅ XAUTHORITY found: $XAUTHORITY"
    elif [ -f "$HOME/.Xauthority" ]; then
        echo "✅ X authority file found: $HOME/.Xauthority"
        export XAUTHORITY="$HOME/.Xauthority"
    else
        echo "⚠️  No X authority file found - may need manual configuration"
    fi
    
    # Test screen capture capability
    echo "Testing screen capture capability..."
    
    # Try to capture 1 frame from X11
    timeout 10s $ffmpeg_path -f x11grab -i "$DISPLAY" -frames:v 1 -f null - > /dev/null 2>&1
    local capture_result=$?
    
    if [ $capture_result -eq 0 ]; then
        echo "✅ Screen capture capability confirmed"
    elif [ $capture_result -eq 124 ]; then
        echo "⚠️  Screen capture test timed out"
        echo "This may be normal depending on your system configuration"
    else
        echo "⚠️  Screen capture test failed"
        echo "This may be due to:"
        echo "  - Missing X11 permissions (try: xhost +local:)"
        echo "  - Wayland compositor (X11 required)"
        echo "  - Display server restrictions"
        echo "  - Service running without GUI session"
        echo ""
        echo "TROUBLESHOOTING:"
        echo "1. For GUI session: xhost +local:"
        echo "2. For service: set DISPLAY=:0 in service file"
        echo "3. For Wayland: switch to X11 session"
        echo "4. For remote: ssh -X or VNC/X11 forwarding"
    fi
    
    # Check for required libraries
    echo "Checking system libraries..."
    local missing_libs=()
    
    # Check for common required libraries
    if ! ldconfig -p | grep -q libx11; then
        missing_libs+=("libx11-dev")
    fi
    if ! ldconfig -p | grep -q libxext; then
        missing_libs+=("libxext-dev")
    fi
    
    if [ ${#missing_libs[@]} -gt 0 ]; then
        echo "⚠️  Missing development libraries: ${missing_libs[*]}"
        echo "You may need to install them for full functionality"
    else
        echo "✅ Required system libraries found"
    fi
    
    echo "========================================"
    echo "FFmpeg Setup Completed Successfully!"
    echo "========================================"
    echo
    if [ -f "assets/ffmpeg/linux/ffmpeg" ]; then
        echo "FFmpeg Location: assets/ffmpeg/linux/ffmpeg (bundled)"
    else
        echo "FFmpeg Location: $(which ffmpeg) (system)"
    fi
    echo "Screen Capture: x11grab (X11 native)"
    echo "Display: ${DISPLAY:-Not detected}"
    echo
    echo "REQUIREMENTS:"
    echo "- X11 display server (not Wayland)"
    echo "- Proper display permissions"
    echo "- Graphics libraries installed"
    echo
    echo "You can now build the Linux executable with:"
    echo "  ./build-linux.sh"
    echo "========================================"
}

manual_instructions() {
    echo "========================================"
    echo "Manual Installation Required"
    echo "========================================"
    echo
    echo "Automatic installation failed. Please install FFmpeg manually:"
    echo
    echo "Ubuntu/Debian:"
    echo "  sudo apt update"
    echo "  sudo apt install ffmpeg"
    echo
    echo "CentOS/RHEL:"
    echo "  sudo yum install epel-release"
    echo "  sudo yum install ffmpeg"
    echo
    echo "Fedora:"
    echo "  sudo dnf install ffmpeg"
    echo
    echo "Arch Linux:"
    echo "  sudo pacman -S ffmpeg"
    echo
    echo "openSUSE:"
    echo "  sudo zypper install ffmpeg"
    echo
    echo "Alpine Linux:"
    echo "  sudo apk add ffmpeg"
    echo
    echo "From source:"
    echo "1. Download from: https://ffmpeg.org/download.html#build-linux"
    echo "2. Compile or extract binary"
    echo "3. Copy to: assets/ffmpeg/linux/ffmpeg"
    echo "4. Make executable: chmod +x assets/ffmpeg/linux/ffmpeg"
    echo
    echo "Run this script again after installation to test FFmpeg"
    echo "========================================"
}

# Run the test function
test_ffmpeg
