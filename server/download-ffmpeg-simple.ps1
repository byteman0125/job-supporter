# Simple FFmpeg downloader with multiple fallback URLs
$ErrorActionPreference = "Stop"

# Create directory if it doesn't exist
$ffmpegDir = "assets\ffmpeg\win"
if (!(Test-Path $ffmpegDir)) {
    New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null
}

# Multiple download URLs for FFmpeg essentials
$urls = @(
    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    "https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip",
    "https://github.com/GyanD/codexffmpeg/releases/download/7.0.2/ffmpeg-7.0.2-essentials_build.zip",
    "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-7.1-essentials_build.zip"
)

$downloaded = $false
$tempZip = "ffmpeg-temp.zip"
$tempDir = "ffmpeg-temp-extract"

foreach ($url in $urls) {
    try {
        Write-Host "Trying to download from: $url"
        
        # Use WebClient for better compatibility
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        $webClient.DownloadFile($url, $tempZip)
        
        if (Test-Path $tempZip) {
            $fileSize = (Get-Item $tempZip).Length
            if ($fileSize -gt 1MB) {
                Write-Host "✅ Downloaded successfully ($([math]::Round($fileSize/1MB, 2)) MB)"
                $downloaded = $true
                break
            } else {
                Write-Host "⚠️ File too small, might be an error page"
                Remove-Item $tempZip -ErrorAction SilentlyContinue
            }
        }
        
    } catch {
        Write-Host "❌ Failed: $_"
        Remove-Item $tempZip -ErrorAction SilentlyContinue
    }
}

if ($downloaded) {
    try {
        Write-Host "📦 Extracting FFmpeg..."
        
        # Extract the zip file
        Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force
        
        # Find ffmpeg.exe in the extracted files
        $ffmpegExe = Get-ChildItem -Path $tempDir -Name "ffmpeg.exe" -Recurse | Select-Object -First 1
        
        if ($ffmpegExe) {
            $sourcePath = Join-Path $tempDir $ffmpegExe
            $targetPath = Join-Path $ffmpegDir "ffmpeg.exe"
            
            Copy-Item $sourcePath $targetPath -Force
            Write-Host "✅ FFmpeg installed to: $targetPath"
            
            # Test the installation
            & $targetPath -version 2>&1 | Select-Object -First 3 | Write-Host
            Write-Host "✅ FFmpeg is working!"
            
        } else {
            throw "FFmpeg executable not found in the downloaded archive"
        }
        
    } catch {
        Write-Host "❌ Extraction failed: $_"
        exit 1
    } finally {
        # Clean up
        Remove-Item $tempZip -ErrorAction SilentlyContinue
        Remove-Item $tempDir -Recurse -ErrorAction SilentlyContinue
    }
    
} else {
    Write-Host "❌ All download attempts failed"
    Write-Host ""
    Write-Host "Manual installation required:"
    Write-Host "1. Download FFmpeg from: https://www.gyan.dev/ffmpeg/builds/"
    Write-Host "2. Extract the archive"
    Write-Host "3. Copy ffmpeg.exe to: $ffmpegDir\\ffmpeg.exe"
    exit 1
}
