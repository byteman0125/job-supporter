# FFmpeg Setup Script for Screen Capture
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FFmpeg Setup for Screen Capture" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running on Windows
if ($env:OS -ne "Windows_NT") {
    Write-Host "Error: This script is for Windows only" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Creating FFmpeg directory structure..." -ForegroundColor Yellow
$ffmpegDir = "tester\assets\ffmpeg\bin"
if (!(Test-Path $ffmpegDir)) {
    New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null
}

Write-Host ""
Write-Host "Downloading FFmpeg..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on your internet connection..." -ForegroundColor Gray

try {
    # Set security protocol for HTTPS
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    # Download FFmpeg
    $downloadUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $zipFile = "ffmpeg-temp.zip"
    
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -UseBasicParsing
    
    if (!(Test-Path $zipFile)) {
        throw "Download failed"
    }
    
    Write-Host ""
    Write-Host "Extracting FFmpeg..." -ForegroundColor Yellow
    
    # Extract the zip file
    Expand-Archive -Path $zipFile -DestinationPath "ffmpeg-temp" -Force
    
    # Find the extracted directory
    $extractedDir = Get-ChildItem "ffmpeg-temp" -Directory | Select-Object -First 1
    $binDir = Join-Path $extractedDir.FullName "bin"
    
    Write-Host ""
    Write-Host "Copying essential files..." -ForegroundColor Yellow
    
    # Copy only the essential files
    $essentialFiles = @(
        "ffmpeg.exe",
        "avcodec-*.dll",
        "avdevice-*.dll", 
        "avfilter-*.dll",
        "avformat-*.dll",
        "avutil-*.dll",
        "swresample-*.dll",
        "swscale-*.dll"
    )
    
    foreach ($pattern in $essentialFiles) {
        $files = Get-ChildItem $binDir -Name $pattern -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $sourcePath = Join-Path $binDir $file
            $destPath = Join-Path $ffmpegDir $file
            Copy-Item $sourcePath $destPath -Force
            Write-Host "  Copied: $file" -ForegroundColor Green
        }
    }
    
    Write-Host ""
    Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
    Remove-Item "ffmpeg-temp" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "Testing FFmpeg installation..." -ForegroundColor Yellow
    
    $ffmpegExe = Join-Path $ffmpegDir "ffmpeg.exe"
    if (Test-Path $ffmpegExe) {
        Write-Host "✅ FFmpeg executable found" -ForegroundColor Green
        
        # Test FFmpeg
        try {
            $result = & $ffmpegExe -version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ FFmpeg is working correctly" -ForegroundColor Green
            } else {
                Write-Host "⚠️ FFmpeg found but may have dependency issues" -ForegroundColor Yellow
                Write-Host "You may need to install Visual C++ Redistributable" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️ FFmpeg found but may have dependency issues" -ForegroundColor Yellow
            Write-Host "You may need to install Visual C++ Redistributable" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ FFmpeg executable not found" -ForegroundColor Red
        Write-Host "Setup may have failed" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Setup Complete!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Essential files installed:" -ForegroundColor Yellow
    Get-ChildItem $ffmpegDir | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor White }
    
    Write-Host ""
    $totalSize = (Get-ChildItem $ffmpegDir | Measure-Object -Property Length -Sum).Sum
    Write-Host "Total size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Yellow
    Write-Host "  node test-ffmpeg.js" -ForegroundColor White
    Write-Host "  npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "The app will automatically use FFmpeg for screen capture with native cursor support." -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
