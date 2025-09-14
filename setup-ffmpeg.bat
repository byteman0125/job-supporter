@echo off
echo Setting up FFmpeg for Windows...

REM Create assets directories if they don't exist
if not exist "tester\assets\ffmpeg" mkdir "tester\assets\ffmpeg"
if not exist "supporter\assets\ffmpeg" mkdir "supporter\assets\ffmpeg"

echo.
echo Please download FFmpeg manually:
echo 1. Go to: https://www.gyan.dev/ffmpeg/builds/
echo 2. Download: ffmpeg-release-essentials.zip
echo 3. Extract ffmpeg.exe to: tester\assets\ffmpeg\
echo 4. Copy ffmpeg.exe to: supporter\assets\ffmpeg\
echo.
echo Or use this PowerShell command to download automatically:
echo.
echo powershell -Command "& {Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg.zip'; Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'temp'; Copy-Item 'temp\ffmpeg-*\bin\ffmpeg.exe' 'tester\assets\ffmpeg\'; Copy-Item 'temp\ffmpeg-*\bin\ffmpeg.exe' 'supporter\assets\ffmpeg\'; Remove-Item 'ffmpeg.zip'; Remove-Item 'temp' -Recurse}"
echo.
pause
