const { exec } = require('child_process');

class DirectXCapture {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.testDirectXAccess();
      this.isInitialized = true;
      console.log('✅ DirectX capture initialized');
    } catch (error) {
      console.log('⚠️ DirectX capture not available:', error.message);
      throw error;
    }
  }

  async testDirectXAccess() {
    return new Promise((resolve, reject) => {
      const testScript = `
        try {
          # Test DirectX availability
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing
          
          # Check if we can access graphics hardware
          $graphics = [System.Drawing.Graphics]::FromHwnd([System.IntPtr]::Zero)
          $graphics.Dispose()
          
          Write-Output "DirectX access available"
        } catch {
          Write-Output "DirectX access not available"
          exit 1
        }
      `;
      
      exec(`powershell -command "${testScript}"`, (error, stdout) => {
        if (error) {
          reject(new Error('DirectX access not available'));
        } else {
          console.log('DirectX test:', stdout.trim());
          resolve();
        }
      });
    });
  }

  async captureScreenWithDirectX() {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      // Use DirectX for hardware-accelerated screen capture
      const captureScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        
        try {
          # Get virtual screen bounds
          $virtualBounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
          $virtualX = $virtualBounds.X
          $virtualY = $virtualBounds.Y
          $virtualWidth = $virtualBounds.Width
          $virtualHeight = $virtualBounds.Height
          
          # Create high-performance bitmap
          $bitmap = New-Object System.Drawing.Bitmap $virtualWidth, $virtualHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          
          # Use hardware acceleration if available
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::None
          
          # Capture screen with DirectX acceleration
          $graphics.CopyFromScreen($virtualX, $virtualY, 0, 0, $virtualWidth, $virtualHeight, [System.Drawing.CopyPixelOperation]::SourceCopy)
          
          # Convert to high-quality JPEG for smaller size
          $memoryStream = New-Object System.IO.MemoryStream
          $encoder = [System.Drawing.Imaging.Encoder]::Quality
          $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
          $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, 95L)
          $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageDecoders() | Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }
          $bitmap.Save($memoryStream, $jpegCodec, $encoderParams)
          
          $bytes = $memoryStream.ToArray()
          $base64 = [System.Convert]::ToBase64String($bytes)
          
          Write-Output $base64
          
          # Cleanup
          $graphics.Dispose()
          $bitmap.Dispose()
          $memoryStream.Dispose()
        } catch {
          Write-Error "DirectX screen capture failed: $_"
          exit 1
        }
      `;
      
      exec(`powershell -command "${captureScript}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('DirectX capture error:', error);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

module.exports = DirectXCapture;
