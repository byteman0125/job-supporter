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
echo Copying essential files for screen capture...

REM Find the extracted directory
for /d %%i in (ffmpeg-temp\*) do set "FFMPEG_DIR=%%i"

echo Found FFmpeg directory: %FFMPEG_DIR%

REM Copy essential files using individual commands
echo Copying ffmpeg.exe...
copy "%FFMPEG_DIR%\bin\ffmpeg.exe" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\ffmpeg.exe" (
    echo ✅ Copied: ffmpeg.exe
) else (
    echo ❌ Failed to copy ffmpeg.exe
)

echo Copying avcodec DLL...
copy "%FFMPEG_DIR%\bin\avcodec-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\avcodec-*.dll" (
    echo ✅ Copied: avcodec-*.dll
) else (
    echo ❌ Failed to copy avcodec-*.dll
)

echo Copying avdevice DLL...
copy "%FFMPEG_DIR%\bin\avdevice-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\avdevice-*.dll" (
    echo ✅ Copied: avdevice-*.dll
) else (
    echo ❌ Failed to copy avdevice-*.dll
)

echo Copying avfilter DLL...
copy "%FFMPEG_DIR%\bin\avfilter-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\avfilter-*.dll" (
    echo ✅ Copied: avfilter-*.dll
) else (
    echo ❌ Failed to copy avfilter-*.dll
)

echo Copying avformat DLL...
copy "%FFMPEG_DIR%\bin\avformat-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\avformat-*.dll" (
    echo ✅ Copied: avformat-*.dll
) else (
    echo ❌ Failed to copy avformat-*.dll
)

echo Copying avutil DLL...
copy "%FFMPEG_DIR%\bin\avutil-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\avutil-*.dll" (
    echo ✅ Copied: avutil-*.dll
) else (
    echo ❌ Failed to copy avutil-*.dll
)

echo Copying swresample DLL...
copy "%FFMPEG_DIR%\bin\swresample-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\swresample-*.dll" (
    echo ✅ Copied: swresample-*.dll
) else (
    echo ❌ Failed to copy swresample-*.dll
)

echo Copying swscale DLL...
copy "%FFMPEG_DIR%\bin\swscale-*.dll" "tester\assets\ffmpeg\bin\" >nul 2>&1
if exist "tester\assets\ffmpeg\bin\swscale-*.dll" (
    echo ✅ Copied: swscale-*.dll
) else (
    echo ❌ Failed to copy swscale-*.dll
)

echo.
echo Copy Summary:
dir "tester\assets\ffmpeg\bin\" /b

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
echo Final files in tester\assets\ffmpeg\bin\:
dir "tester\assets\ffmpeg\bin\" /b

echo.
echo You can now run:
echo   node test-ffmpeg.js
echo   npm start
echo.
echo The app will automatically use FFmpeg for screen capture with native cursor support.
echo.
pause
