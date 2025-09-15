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
echo Extracting FFmpeg with original folder name...
powershell -Command "Expand-Archive -Path 'ffmpeg-temp.zip' -DestinationPath 'tester\assets' -Force; $folders = Get-ChildItem 'tester\assets' -Directory | Where-Object { $_.Name -like 'ffmpeg-*' }; if ($folders) { Write-Host 'FFmpeg extracted successfully to:' $folders[0].Name; Write-Host 'The tester app will automatically find this folder!' } else { Write-Host 'No ffmpeg folder found after extraction' }"

echo.
echo FFmpeg extracted successfully!
echo.
echo Files in the extracted FFmpeg folder:
powershell -Command "$folders = Get-ChildItem 'tester\assets' -Directory | Where-Object { $_.Name -like 'ffmpeg-*' }; if ($folders) { $folderName = $folders[0].Name; Write-Host 'Folder:' $folderName; Get-ChildItem \"tester\assets\$folderName\" | ForEach-Object { Write-Host $_.Name }; Write-Host ''; Write-Host 'Files in bin directory:'; Get-ChildItem \"tester\assets\$folderName\bin\" | ForEach-Object { Write-Host $_.Name } }"

echo.
echo Cleaning up temporary files...
if exist "ffmpeg-temp.zip" del "ffmpeg-temp.zip"

echo.
echo Testing FFmpeg installation...
powershell -Command "$folders = Get-ChildItem 'tester\assets' -Directory | Where-Object { $_.Name -like 'ffmpeg-*' }; if ($folders) { $folderName = $folders[0].Name; $ffmpegPath = \"tester\assets\$folderName\bin\ffmpeg.exe\"; if (Test-Path $ffmpegPath) { Write-Host '✅ FFmpeg executable found'; $result = & $ffmpegPath -version 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host '✅ FFmpeg is working correctly' } else { Write-Host '⚠️ FFmpeg found but may have dependency issues'; Write-Host 'You may need to install Visual C++ Redistributable' } } else { Write-Host '❌ FFmpeg executable not found'; Write-Host 'Setup may have failed' } } else { Write-Host '❌ No FFmpeg folder found' }"

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Final files in the FFmpeg bin directory:
powershell -Command "$folders = Get-ChildItem 'tester\assets' -Directory | Where-Object { $_.Name -like 'ffmpeg-*' }; if ($folders) { $folderName = $folders[0].Name; Get-ChildItem \"tester\assets\$folderName\bin\" | ForEach-Object { Write-Host $_.Name } }"

echo.
echo You can now run:
echo   node test-ffmpeg.js
echo   npm start
echo.
echo The app will automatically use FFmpeg for screen capture with native cursor support.
echo.
pause
