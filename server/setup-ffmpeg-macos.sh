#!/bin/bash
echo "========================================"
echo "FFmpeg Setup for macOS"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "main-cli.js" ]; then
    echo "ERROR: Please run this script from the server directory."
    exit 1
fi

echo "Current directory: $(pwd)"

# Create FFmpeg directory structure
mkdir -p assets/ffmpeg/mac

echo "========================================"
echo "Checking FFmpeg Installation"
echo "========================================"

# Check if FFmpeg already exists in assets
if [ -f "assets/ffmpeg/mac/ffmpeg" ]; then
    echo "✅ FFmpeg found in assets/ffmpeg/mac/"
    chmod +x assets/ffmpeg/mac/ffmpeg
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
        cp "$(which ffmpeg)" assets/ffmpeg/mac/ffmpeg
        chmod +x assets/ffmpeg/mac/ffmpeg
        echo "✅ FFmpeg copied to assets/ffmpeg/mac/"
    fi
    
    test_ffmpeg
    exit 0
fi

echo "❌ No FFmpeg found"

echo "========================================"
echo "Installing FFmpeg for macOS"
echo "========================================"

# Check if Homebrew is available
if command -v brew &> /dev/null; then
    echo "🍺 Homebrew found - installing FFmpeg..."
    
    # Update Homebrew
    echo "Updating Homebrew..."
    brew update
    
    # Install FFmpeg
    echo "Installing FFmpeg..."
    brew install ffmpeg
    
    if command -v ffmpeg &> /dev/null; then
        echo "✅ FFmpeg installed successfully via Homebrew"
        echo "Version: $(ffmpeg -version 2>&1 | head -n1)"
        
        # Ask if user wants to bundle FFmpeg
        read -p "Do you want to copy FFmpeg to assets for bundling? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp "$(which ffmpeg)" assets/ffmpeg/mac/ffmpeg
            chmod +x assets/ffmpeg/mac/ffmpeg
            echo "✅ FFmpeg copied to assets/ffmpeg/mac/"
        fi
    else
        echo "❌ FFmpeg installation via Homebrew failed"
        manual_instructions
        exit 1
    fi
else
    echo "❌ Homebrew not found"
    echo "Installing Homebrew first..."
    
    # Install Homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Check if Homebrew was installed successfully
    if command -v brew &> /dev/null; then
        echo "✅ Homebrew installed successfully"
        
        # Now install FFmpeg
        echo "Installing FFmpeg..."
        brew install ffmpeg
        
        if command -v ffmpeg &> /dev/null; then
            echo "✅ FFmpeg installed successfully"
            
            # Ask if user wants to bundle FFmpeg
            read -p "Do you want to copy FFmpeg to assets for bundling? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$(which ffmpeg)" assets/ffmpeg/mac/ffmpeg
                chmod +x assets/ffmpeg/mac/ffmpeg
                echo "✅ FFmpeg copied to assets/ffmpeg/mac/"
            fi
        else
            echo "❌ FFmpeg installation failed"
            manual_instructions
            exit 1
        fi
    else
        echo "❌ Homebrew installation failed"
        manual_instructions
        exit 1
    fi
fi

test_ffmpeg() {
    echo "========================================"
    echo "Testing FFmpeg Installation"
    echo "========================================"
    
    # Determine which FFmpeg to test
    local ffmpeg_path=""
    if [ -f "assets/ffmpeg/mac/ffmpeg" ]; then
        ffmpeg_path="assets/ffmpeg/mac/ffmpeg"
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
    
    # Test screen capture capability (requires screen recording permission)
    echo "Testing screen capture capability..."
    echo "Note: This may prompt for screen recording permissions"
    
    # Create a quick test (capture 1 frame and discard)
    timeout 5s $ffmpeg_path -f avfoundation -i "1:0" -frames:v 1 -f null - > /dev/null 2>&1
    local capture_result=$?
    
    if [ $capture_result -eq 0 ]; then
        echo "✅ Screen capture capability confirmed"
    elif [ $capture_result -eq 124 ]; then
        echo "⚠️  Screen capture test timed out - may need permissions"
        echo "Grant screen recording permission in System Preferences > Security & Privacy"
    else
        echo "⚠️  Screen capture test failed - may need permissions"
        echo "Grant screen recording permission in System Preferences > Security & Privacy"
        echo "This is normal for first-time setup"
    fi
    
    echo "========================================"
    echo "FFmpeg Setup Completed Successfully!"
    echo "========================================"
    echo
    if [ -f "assets/ffmpeg/mac/ffmpeg" ]; then
        echo "FFmpeg Location: assets/ffmpeg/mac/ffmpeg (bundled)"
    else
        echo "FFmpeg Location: $(which ffmpeg) (system)"
    fi
    echo "Screen Capture: avfoundation (macOS native)"
    echo
    echo "IMPORTANT: Grant screen recording permissions when prompted:"
    echo "System Preferences > Security & Privacy > Privacy > Screen Recording"
    echo
    echo "You can now build the macOS executable with:"
    echo "  ./build-macos.sh"
    echo "========================================"
}

manual_instructions() {
    echo "========================================"
    echo "Manual Installation Required"
    echo "========================================"
    echo
    echo "Automatic installation failed. Please install FFmpeg manually:"
    echo
    echo "Option 1: Install Homebrew and FFmpeg"
    echo "1. Install Homebrew:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "2. Install FFmpeg:"
    echo "   brew install ffmpeg"
    echo
    echo "Option 2: Download FFmpeg binary"
    echo "1. Download from: https://ffmpeg.org/download.html#build-mac"
    echo "2. Extract and copy ffmpeg to: assets/ffmpeg/mac/ffmpeg"
    echo "3. Make executable: chmod +x assets/ffmpeg/mac/ffmpeg"
    echo
    echo "Option 3: Use MacPorts"
    echo "1. Install MacPorts from: https://www.macports.org/"
    echo "2. Run: sudo port install ffmpeg"
    echo
    echo "Run this script again after installation to test FFmpeg"
    echo "========================================"
}

# Run the test function
test_ffmpeg
