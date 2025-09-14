@echo off
echo ========================================
echo FFmpeg Setup for Screen Capture (Debug)
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
echo Debug: Checking extracted files...
echo Contents of ffmpeg-temp:
dir "ffmpeg-temp" /b

echo.
echo Debug: Finding FFmpeg directory...
for /d %%i in (ffmpeg-temp\*) do (
    echo Found directory: %%i
    echo Contents of %%i:
    dir "%%i" /b
    echo.
    echo Contents of %%i\bin:
    dir "%%i\bin" /b
    echo.
)

echo.
echo Copying essential files...

REM Use PowerShell to copy files with detailed logging
powershell -Command "& {
    $extractedDir = Get-ChildItem 'ffmpeg-temp' -Directory | Select-Object -First 1
    $binDir = Join-Path $extractedDir.FullName 'bin'
    $targetDir = 'tester\assets\ffmpeg\bin'
    
    Write-Host 'Source directory:' $binDir
    Write-Host 'Target directory:' $targetDir
    
    if (Test-Path $binDir) {
        Write-Host 'Source directory exists: YES'
        $files = Get-ChildItem $binDir
        Write-Host 'Files found in source:' $files.Count
        
        foreach ($file in $files) {
            $targetPath = Join-Path $targetDir $file.Name
            Write-Host 'Copying:' $file.Name 'to' $targetPath
            try {
                Copy-Item $file.FullName $targetPath -Force
                if (Test-Path $targetPath) {
                    Write-Host 'SUCCESS: Copied' $file.Name
                } else {
                    Write-Host 'ERROR: Failed to copy' $file.Name
                }
            } catch {
                Write-Host 'ERROR copying' $file.Name ':' $_.Exception.Message
            }
        }
    } else {
        Write-Host 'ERROR: Source directory does not exist:' $binDir
    }
}"

echo.
echo Debug: Checking target directory...
echo Contents of tester\assets\ffmpeg\bin\:
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
pause
