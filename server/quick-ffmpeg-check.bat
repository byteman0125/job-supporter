@echo off
echo ========================================
echo Quick FFmpeg Check
echo ========================================

echo Checking if FFmpeg exists...
if exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ✅ FFmpeg found at: assets\ffmpeg\win\ffmpeg.exe
    
    echo.
    echo File size:
    for %%A in ("assets\ffmpeg\win\ffmpeg.exe") do echo %%~zA bytes
    
    echo.
    echo Testing FFmpeg version:
    "assets\ffmpeg\win\ffmpeg.exe" -version 2>nul | findstr "ffmpeg version"
    if errorlevel 1 (
        echo ⚠️ FFmpeg file exists but may be corrupted
    ) else (
        echo ✅ FFmpeg is working correctly!
    )
    
) else (
    echo ❌ FFmpeg not found at: assets\ffmpeg\win\ffmpeg.exe
    
    echo.
    echo Checking if directory exists...
    if exist "assets\ffmpeg\win" (
        echo ✅ Directory exists: assets\ffmpeg\win\
        dir "assets\ffmpeg\win" /b
    ) else (
        echo ❌ Directory missing: assets\ffmpeg\win\
        if exist "assets" (
            echo ✅ Assets directory exists
            if exist "assets\ffmpeg" (
                echo ✅ FFmpeg directory exists
            ) else (
                echo ❌ FFmpeg directory missing
            )
        ) else (
            echo ❌ Assets directory missing
        )
    )
)

echo.
echo ========================================
pause
