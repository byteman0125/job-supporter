@echo off
echo ========================================
echo FFmpeg Setup for Screen Capture (Minimal)
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
echo Copying ONLY essential files for screen capture...

REM Use PowerShell to copy only necessary files
powershell -Command "& {
    $extractedDir = Get-ChildItem 'ffmpeg-temp' -Directory | Select-Object -First 1
    $binDir = Join-Path $extractedDir.FullName 'bin'
    $targetDir = 'tester\assets\ffmpeg\bin'
    
    Write-Host 'Source directory:' $binDir
    Write-Host 'Target directory:' $targetDir
    
    if (Test-Path $binDir) {
        # Define only the essential files needed for screen capture
        # These are the minimum required files for FFmpeg screen capture functionality
        $essentialFiles = @(
            'ffmpeg.exe',           # Main executable
            'avcodec-*.dll',        # Video/audio codecs (encoding/decoding)
            'avdevice-*.dll',       # Device input/output (screen capture)
            'avfilter-*.dll',       # Filters (video processing)
            'avformat-*.dll',       # Container formats (muxing/demuxing)
            'avutil-*.dll',         # Utility functions
            'swresample-*.dll',     # Audio resampling
            'swscale-*.dll'         # Video scaling
        )
        
        Write-Host 'Copying only essential files for screen capture:'
        Write-Host ''
        
        $copiedCount = 0
        $totalSize = 0
        
        foreach ($pattern in $essentialFiles) {
            $files = Get-ChildItem $binDir -Name $pattern -ErrorAction SilentlyContinue
            if ($files) {
                foreach ($fileName in $files) {
                    $sourcePath = Join-Path $binDir $fileName
                    $targetPath = Join-Path $targetDir $fileName
                    try {
                        $fileSize = (Get-Item $sourcePath).Length
                        Copy-Item $sourcePath $targetPath -Force
                        Write-Host '✅ Copied:' $fileName '(' [math]::Round($fileSize/1MB, 2) 'MB)'
                        $copiedCount++
                        $totalSize += $fileSize
                    } catch {
                        Write-Host '❌ ERROR copying' $fileName ':' $_.Exception.Message
                    }
                }
            } else {
                Write-Host '⚠️  WARNING: Pattern not found:' $pattern
            }
        }
        
        Write-Host ''
        Write-Host 'Copy Summary:'
        Write-Host '  Essential files copied:' $copiedCount
        Write-Host '  Total size:' [math]::Round($totalSize/1MB, 2) 'MB'
        
        # Verify all essential files are present
        Write-Host ''
        Write-Host 'Essential files verification:'
        $allPresent = $true
        foreach ($pattern in $essentialFiles) {
            $found = Get-ChildItem $targetDir -Name $pattern -ErrorAction SilentlyContinue
            if ($found) {
                Write-Host '  ✅' $pattern
            } else {
                Write-Host '  ❌' $pattern 'MISSING'
                $allPresent = $false
            }
        }
        
        if ($allPresent) {
            Write-Host ''
            Write-Host '🎉 All essential files copied successfully!'
        } else {
            Write-Host ''
            Write-Host '⚠️  Some essential files are missing!'
        }
        
    } else {
        Write-Host 'ERROR: Source directory does not exist:' $binDir
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
