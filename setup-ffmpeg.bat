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
echo Extracting FFmpeg...
powershell -Command "Expand-Archive -Path 'ffmpeg-temp.zip' -DestinationPath 'ffmpeg-temp' -Force"

echo.
echo Copying essential files...

REM Find the extracted directory
for /d %%i in (ffmpeg-temp\*) do set "FFMPEG_DIR=%%i"

REM Copy only the essential files
copy "%FFMPEG_DIR%\bin\ffmpeg.exe" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\avcodec-*.dll" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\avdevice-*.dll" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\avfilter-*.dll" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\avformat-*.dll" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\avutil-*.dll" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\swresample-*.dll" "tester\assets\ffmpeg\bin\"
copy "%FFMPEG_DIR%\bin\swscale-*.dll" "tester\assets\ffmpeg\bin\"

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
echo Essential files installed:
dir "tester\assets\ffmpeg\bin\" /b

echo.
echo Total size:
for /f "tokens=3" %%a in ('dir "tester\assets\ffmpeg\bin\" /-c ^| find "File(s)"') do echo %%a bytes

echo.
echo You can now run:
echo   node test-ffmpeg.js
echo   npm start
echo.
echo The app will automatically use FFmpeg for screen capture with native cursor support.
echo.
pause
