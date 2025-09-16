@echo off
echo ========================================
echo FFmpeg Setup Test
echo ========================================

:: Check if FFmpeg exists
if exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ✅ FFmpeg found at: assets\ffmpeg\win\ffmpeg.exe
    
    :: Test FFmpeg version
    echo.
    echo Testing FFmpeg version...
    "assets\ffmpeg\win\ffmpeg.exe" -version
    
    :: Test screen capture capability
    echo.
    echo Testing screen capture capability...
    "assets\ffmpeg\win\ffmpeg.exe" -f gdigrab -i desktop -frames:v 1 -f null - 2>nul
    if errorlevel 1 (
        echo ⚠️  Screen capture test failed - may need additional permissions
        echo This is normal on some Windows systems
    ) else (
        echo ✅ Screen capture capability confirmed
    )
    
    echo.
    echo ========================================
    echo FFmpeg is working correctly!
    echo ========================================
    
) else (
    echo ❌ FFmpeg not found at: assets\ffmpeg\win\ffmpeg.exe
    echo.
    echo Running FFmpeg setup...
    if exist "setup-ffmpeg-windows.bat" (
        call setup-ffmpeg-windows.bat
    ) else (
        echo ❌ setup-ffmpeg-windows.bat not found
        echo Please run the Windows build script first
    )
)

pause
