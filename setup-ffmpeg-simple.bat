@echo off
echo ========================================
echo FFmpeg Setup for Screen Capture (Simple)
echo ========================================
echo.

REM Check if running on Windows
if not "%OS%"=="Windows_NT" (
    echo Error: This script is for Windows only
    pause
    exit /b 1
)

echo Creating FFmpeg directory structure...
if not exist "tester\assets\ffmpeg\bin" mkdir "tester\assets\ffmpeg\bin"

echo.
echo Downloading FFmpeg...
echo This may take a few minutes depending on your internet connection...

REM Download FFmpeg from official source
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg-temp.zip'}"

if not exist "ffmpeg-temp.zip" (
    echo Error: Failed to download FFmpeg
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo Extracting FFmpeg...
powershell -Command "Expand-Archive -Path 'ffmpeg-temp.zip' -DestinationPath 'ffmpeg-temp' -Force"

echo.
echo Copying essential files...

REM Use PowerShell to copy all files from bin directory
powershell -Command "& {
    $extractedDir = Get-ChildItem 'ffmpeg-temp' -Directory | Select-Object -First 1
    $binDir = Join-Path $extractedDir.FullName 'bin'
    $targetDir = 'tester\assets\ffmpeg\bin'
    
    Write-Host 'Source directory:' $binDir
    Write-Host 'Target directory:' $targetDir
    
    # Copy all files from bin directory
    Get-ChildItem $binDir | ForEach-Object {
        $targetPath = Join-Path $targetDir $_.Name
        Copy-Item $_.FullName $targetPath -Force
        Write-Host 'Copied:' $_.Name
    }
}"

echo.
echo Cleaning up temporary files...
rmdir /s /q "ffmpeg-temp"
del "ffmpeg-temp.zip"

echo.
echo Testing FFmpeg installation...
if exist "tester\assets\ffmpeg\bin\ffmpeg.exe" (
    echo ✅ FFmpeg executable found
    "tester\assets\ffmpeg\bin\ffmpeg.exe" -version >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ FFmpeg is working correctly
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
echo Files in tester\assets\ffmpeg\bin\:
dir "tester\assets\ffmpeg\bin\" /b

echo.
echo You can now run:
echo   node test-ffmpeg.js
echo   npm start
echo.
echo The app will automatically use FFmpeg for screen capture with native cursor support.
echo.
pause
