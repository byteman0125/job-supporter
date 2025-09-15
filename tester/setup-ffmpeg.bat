@echo off
echo ========================================
echo FFmpeg Setup for Screen Capture
echo ========================================
echo.

REM Check if running on Windows
if not "%OS%"=="Windows_NT" (
    echo Error: This script is for Windows only
    pause
    exit /b 1
)

echo Creating FFmpeg directory structure...
if not exist "assets\ffmpeg\bin" mkdir "assets\ffmpeg\bin"


REM Download FFmpeg from official source
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg-temp.zip'}"

echo.
if not exist "ffmpeg-temp.zip" (
    echo Error: Failed to download FFmpeg
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
powershell -Command "if (Test-Path 'assets\ffmpeg') { Remove-Item 'assets\ffmpeg' -Recurse -Force }; Expand-Archive -Path 'ffmpeg-temp.zip' -DestinationPath 'assets' -Force; $folders = Get-ChildItem 'assets' -Directory | Where-Object { $_.Name -like 'ffmpeg-*' }; if ($folders) { $oldPath = $folders[0].FullName; $newPath = 'assets\ffmpeg'; Write-Host 'Found folder:' $folders[0].Name; Write-Host 'Moving contents to: ffmpeg'; Move-Item $oldPath $newPath -Force; Write-Host 'FFmpeg extracted and organized successfully!' } else { Write-Host 'No ffmpeg folder found after extraction' }"

echo.
rmdir /s /q "ffmpeg-temp"
del "ffmpeg-temp.zip"

echo.
if exist "assets\ffmpeg\bin\ffmpeg.exe" (
    echo ✅ FFmpeg executable found
    "assets\ffmpeg\bin\ffmpeg.exe" -version >nul 2>&1
    if %errorlevel% equ 0 (

    ) else (
        echo ⚠️ FFmpeg found but may have dependency issues
        echo You may need to install Visual C++ Redistributable
    )
) else (
    echo ❌ FFmpeg executable not found
    echo Setup may have failed
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Final files in assets\ffmpeg\bin\:
dir "assets\ffmpeg\bin\" /b

echo.
echo You can now run:
echo   node test-ffmpeg.js
echo   npm start
echo.
echo The app will automatically use FFmpeg for screen capture with native cursor support.
echo.
pause
