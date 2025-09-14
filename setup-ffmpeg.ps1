# PowerShell script to download and setup FFmpeg
Write-Host "Setting up FFmpeg for Windows..." -ForegroundColor Green

# Create assets directories if they don't exist
if (!(Test-Path "tester\assets\ffmpeg")) {
    New-Item -ItemType Directory -Path "tester\assets\ffmpeg" -Force
}
if (!(Test-Path "supporter\assets\ffmpeg")) {
    New-Item -ItemType Directory -Path "supporter\assets\ffmpeg" -Force
}

# Download FFmpeg
$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$zipFile = "ffmpeg.zip"

Write-Host "Downloading FFmpeg..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "Download completed!" -ForegroundColor Green
} catch {
    Write-Host "Download failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Extract FFmpeg
Write-Host "Extracting FFmpeg..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipFile -DestinationPath "temp" -Force
    
    # Find the extracted directory
    $extractedDir = Get-ChildItem -Path "temp" -Directory | Where-Object { $_.Name -like "ffmpeg-*" } | Select-Object -First 1
    
    if ($extractedDir) {
        $ffmpegPath = Join-Path $extractedDir.FullName "bin\ffmpeg.exe"
        
        if (Test-Path $ffmpegPath) {
            # Copy to both assets directories
            Copy-Item $ffmpegPath "tester\assets\ffmpeg\ffmpeg.exe" -Force
            Copy-Item $ffmpegPath "supporter\assets\ffmpeg\ffmpeg.exe" -Force
            
            Write-Host "FFmpeg setup completed successfully!" -ForegroundColor Green
            Write-Host "FFmpeg installed to:" -ForegroundColor Cyan
            Write-Host "  - tester\assets\ffmpeg\ffmpeg.exe" -ForegroundColor Cyan
            Write-Host "  - supporter\assets\ffmpeg\ffmpeg.exe" -ForegroundColor Cyan
        } else {
            Write-Host "FFmpeg executable not found in extracted files!" -ForegroundColor Red
        }
    } else {
        Write-Host "Could not find extracted FFmpeg directory!" -ForegroundColor Red
    }
} catch {
    Write-Host "Extraction failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Cleanup
    if (Test-Path $zipFile) { Remove-Item $zipFile -Force }
    if (Test-Path "temp") { Remove-Item "temp" -Recurse -Force }
}

Write-Host "Setup complete!" -ForegroundColor Green
