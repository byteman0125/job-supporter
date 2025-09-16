@echo off
echo ========================================
echo FFmpeg Setup for Windows
echo ========================================

:: Navigate to server directory
cd /d "%~dp0"
echo Current directory: %CD%

:: Create FFmpeg directory structure
if not exist "assets\ffmpeg\win" mkdir "assets\ffmpeg\win"

echo ========================================
echo Checking FFmpeg Installation
echo ========================================

:: Check if FFmpeg already exists in assets
if exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ✅ FFmpeg found in assets/ffmpeg/win/
    goto :test_ffmpeg
)

:: Check if system FFmpeg is available
echo Checking for system FFmpeg...
ffmpeg -version >nul 2>&1
if not errorlevel 1 (
    echo ✅ System FFmpeg found
    echo Note: System FFmpeg will be used, but bundled version recommended for distribution
    goto :download_bundled
)

echo ❌ No FFmpeg found

:download_bundled
echo ========================================
echo Downloading FFmpeg for Windows
echo ========================================

echo Downloading FFmpeg from GitHub releases...
echo This may take a few minutes depending on your internet connection.

:: Create PowerShell download script with multiple fallback URLs
echo $ErrorActionPreference = "Stop" > temp_download_ffmpeg.ps1
echo try { >> temp_download_ffmpeg.ps1
echo     Write-Host "🔄 Downloading FFmpeg..." >> temp_download_ffmpeg.ps1
echo     $urls = @( >> temp_download_ffmpeg.ps1
echo         "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip", >> temp_download_ffmpeg.ps1
echo         "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2024-12-19-13-18/ffmpeg-master-latest-win64-gpl.zip", >> temp_download_ffmpeg.ps1
echo         "https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip", >> temp_download_ffmpeg.ps1
echo         "https://github.com/GyanD/codexffmpeg/releases/download/7.0.2/ffmpeg-7.0.2-essentials_build.zip" >> temp_download_ffmpeg.ps1
echo     ^) >> temp_download_ffmpeg.ps1
echo     $output = "ffmpeg-win.zip" >> temp_download_ffmpeg.ps1
echo. >> temp_download_ffmpeg.ps1
echo     foreach ($url in $urls) { >> temp_download_ffmpeg.ps1
echo         try { >> temp_download_ffmpeg.ps1
echo             Write-Host "Trying: $url" >> temp_download_ffmpeg.ps1
echo             $webClient = New-Object System.Net.WebClient >> temp_download_ffmpeg.ps1
echo             $webClient.DownloadFile($url, $output) >> temp_download_ffmpeg.ps1
echo             Write-Host "✅ Download completed from: $url" >> temp_download_ffmpeg.ps1
echo             break >> temp_download_ffmpeg.ps1
echo         } catch { >> temp_download_ffmpeg.ps1
echo             Write-Host "Failed: $url - $_" >> temp_download_ffmpeg.ps1
echo             if ($url -eq $urls[-1]) { throw $_ } >> temp_download_ffmpeg.ps1
echo         } >> temp_download_ffmpeg.ps1
echo     } >> temp_download_ffmpeg.ps1
echo. >> temp_download_ffmpeg.ps1
echo     Write-Host "📦 Extracting FFmpeg..." >> temp_download_ffmpeg.ps1
echo     Expand-Archive -Path $output -DestinationPath "temp_ffmpeg" -Force >> temp_download_ffmpeg.ps1
echo. >> temp_download_ffmpeg.ps1
echo     Write-Host "Finding FFmpeg executable..." >> temp_download_ffmpeg.ps1
echo     if (Test-Path "temp_ffmpeg") { >> temp_download_ffmpeg.ps1
echo         $ffmpegFiles = Get-ChildItem -Path "temp_ffmpeg" -Recurse -Name "ffmpeg.exe" >> temp_download_ffmpeg.ps1
echo         if ($ffmpegFiles.Count -gt 0) { >> temp_download_ffmpeg.ps1
echo             $ffmpegPath = $ffmpegFiles[0] >> temp_download_ffmpeg.ps1
echo             $sourcePath = Join-Path "temp_ffmpeg" $ffmpegPath >> temp_download_ffmpeg.ps1
echo             if (!(Test-Path "assets\ffmpeg\win")) { New-Item -ItemType Directory -Path "assets\ffmpeg\win" -Force } >> temp_download_ffmpeg.ps1
echo             Copy-Item $sourcePath "assets\ffmpeg\win\ffmpeg.exe" -Force >> temp_download_ffmpeg.ps1
echo             Write-Host "FFmpeg installed to assets/ffmpeg/win/ffmpeg.exe" >> temp_download_ffmpeg.ps1
echo         } else { >> temp_download_ffmpeg.ps1
echo             throw "FFmpeg executable not found in downloaded archive" >> temp_download_ffmpeg.ps1
echo         } >> temp_download_ffmpeg.ps1
echo     } else { >> temp_download_ffmpeg.ps1
echo         throw "Extraction directory temp_ffmpeg not found" >> temp_download_ffmpeg.ps1
echo     } >> temp_download_ffmpeg.ps1
echo. >> temp_download_ffmpeg.ps1
echo     Write-Host "🧹 Cleaning up temporary files..." >> temp_download_ffmpeg.ps1
echo     Remove-Item $output -Force -ErrorAction SilentlyContinue >> temp_download_ffmpeg.ps1
echo     Remove-Item "temp_ffmpeg" -Recurse -Force -ErrorAction SilentlyContinue >> temp_download_ffmpeg.ps1
echo     Write-Host "✅ FFmpeg setup completed successfully!" >> temp_download_ffmpeg.ps1
echo } >> temp_download_ffmpeg.ps1
echo catch { >> temp_download_ffmpeg.ps1
echo     Write-Host "FFmpeg download failed: $($_.Exception.Message)" >> temp_download_ffmpeg.ps1
echo     Write-Host "Please download FFmpeg manually from https://ffmpeg.org/download.html" >> temp_download_ffmpeg.ps1
echo     Write-Host "Extract ffmpeg.exe to: assets\\ffmpeg\\win\\ffmpeg.exe" >> temp_download_ffmpeg.ps1
echo     exit 1 >> temp_download_ffmpeg.ps1
echo } >> temp_download_ffmpeg.ps1

:: Run the PowerShell script
powershell -ExecutionPolicy Bypass -File temp_download_ffmpeg.ps1

:: Clean up PowerShell script
del temp_download_ffmpeg.ps1

:: If PowerShell download failed, try alternative methods
if not exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ⚠️  PowerShell download failed, trying alternative methods...
    
    :: Test network connectivity first
    echo Testing network connectivity...
    ping -n 1 8.8.8.8 >nul 2>&1
    if errorlevel 1 (
        echo ❌ No internet connection detected
        echo Please check your network connection and try again
        goto :manual_instructions
    )
    
    :: Test DNS resolution
    echo Testing DNS resolution...
    nslookup github.com >nul 2>&1
    if errorlevel 1 (
        echo ⚠️ DNS resolution issues detected
        echo Trying with IP addresses and alternative DNS...
    ) else (
        echo ✅ DNS resolution working
    )
    
    :: Try using curl with multiple URLs
    echo Trying curl download...
    
    :: Try gyan.dev essentials build
    echo Trying: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
    curl -L --connect-timeout 30 --max-time 300 "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -o "ffmpeg-win.zip"
    
    :: If that fails, try GitHub releases
    if not exist "ffmpeg-win.zip" (
        echo Trying: https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip
        curl -L --connect-timeout 30 --max-time 300 "https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip" -o "ffmpeg-win.zip"
    )
    
    :: Last resort - try older stable version
    if not exist "ffmpeg-win.zip" (
        echo Trying: https://github.com/GyanD/codexffmpeg/releases/download/7.0.2/ffmpeg-7.0.2-essentials_build.zip
        curl -L --connect-timeout 30 --max-time 300 "https://github.com/GyanD/codexffmpeg/releases/download/7.0.2/ffmpeg-7.0.2-essentials_build.zip" -o "ffmpeg-win.zip"
    )
    
    :: Final fallback - try direct download from ffmpeg.org
    if not exist "ffmpeg-win.zip" (
        echo Trying: https://ffmpeg.org/releases/ffmpeg-snapshot.tar.bz2
        echo Note: This is a source archive, looking for pre-built binaries...
        curl -L --connect-timeout 30 --max-time 300 "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-7.1-essentials_build.zip" -o "ffmpeg-win.zip"
    )
    
    if exist "ffmpeg-win.zip" (
        echo Extracting with PowerShell...
        
        :: Clean up any existing temp directory first
        if exist "temp_ffmpeg" rmdir /s /q "temp_ffmpeg" >nul 2>&1
        
        :: Extract the zip file
        powershell -Command "if (Test-Path 'ffmpeg-win.zip') { Expand-Archive -Path 'ffmpeg-win.zip' -DestinationPath 'temp_ffmpeg' -Force; Write-Host 'Extraction completed' } else { Write-Host 'Zip file not found' }"
        
        :: Wait a moment for extraction to complete
        timeout /t 2 >nul
        
        echo Finding FFmpeg executable...
        if exist "temp_ffmpeg" (
            for /r "temp_ffmpeg" %%i in (ffmpeg.exe) do (
                echo Found FFmpeg at: %%i
                if not exist "assets\ffmpeg\win" mkdir "assets\ffmpeg\win"
                copy "%%i" "assets\ffmpeg\win\ffmpeg.exe" >nul
                if exist "assets\ffmpeg\win\ffmpeg.exe" (
                    echo ✅ FFmpeg successfully installed!
                    goto :cleanup_curl
                )
            )
        ) else (
            echo ❌ Extraction failed - temp_ffmpeg directory not created
        )
        
        :cleanup_curl
        echo Cleaning up...
        del "ffmpeg-win.zip" >nul 2>&1
        rmdir /s /q "temp_ffmpeg" >nul 2>&1
    ) else (
        echo ❌ Download failed - ffmpeg-win.zip not found
    )
)

:: Check if curl method succeeded
if exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ✅ FFmpeg installation completed successfully via curl!
    goto :test_ffmpeg
)

:: No more fallback methods available

if not exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ❌ All automatic download methods failed
    echo.
    echo NETWORK TROUBLESHOOTING:
    echo 1. Check your internet connection
    echo 2. Try disabling antivirus/firewall temporarily
    echo 3. Check if your network blocks downloads from GitHub/gyan.dev
    echo 4. Try running this script as Administrator
    echo.
    goto :manual_instructions
)

:test_ffmpeg
echo ========================================
echo Testing FFmpeg Installation
echo ========================================

:: Test the FFmpeg executable
echo Testing FFmpeg functionality...
"assets\ffmpeg\win\ffmpeg.exe" -version >nul 2>&1
if errorlevel 1 (
    echo ❌ FFmpeg test failed
    goto :manual_instructions
) else (
    echo ✅ FFmpeg is working correctly
)

:: Test screen capture capability
echo Testing screen capture capability...
"assets\ffmpeg\win\ffmpeg.exe" -f gdigrab -i desktop -frames:v 1 -f null - >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Screen capture test failed - may need additional permissions
    echo This is normal on some Windows systems
) else (
    echo ✅ Screen capture capability confirmed
)

echo ========================================
echo FFmpeg Setup Completed Successfully!
echo ========================================
echo.
echo FFmpeg Location: assets\ffmpeg\win\ffmpeg.exe
echo Screen Capture: gdigrab (Windows native)
echo.
echo You can now build the Windows executable with:
echo   build-windows.bat
echo ========================================
goto :end

:manual_instructions
echo ========================================
echo Manual Installation Required
echo ========================================
echo.
echo Automatic installation failed. Please install FFmpeg manually:
echo.
echo 1. Download FFmpeg from: https://ffmpeg.org/download.html#build-windows
echo 2. Extract the archive
echo 3. Copy ffmpeg.exe to: assets\ffmpeg\win\ffmpeg.exe
echo 4. Run this script again to test the installation
echo.
echo Alternative: Install system-wide FFmpeg and it will be detected automatically
echo ========================================

:end
pause
