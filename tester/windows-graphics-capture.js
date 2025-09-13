const { exec } = require('child_process');

class WindowsGraphicsCapture {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Check if Windows Graphics Capture API is available
    try {
      await this.testGraphicsCaptureAPI();
      this.isInitialized = true;
      console.log('✅ Windows Graphics Capture API initialized');
    } catch (error) {
      console.log('⚠️ Windows Graphics Capture API not available:', error.message);
      throw error;
    }
  }

  async testGraphicsCaptureAPI() {
    return new Promise((resolve, reject) => {
      // Test if we can access the Windows Graphics Capture API
      const testScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        try {
          # Test basic graphics access
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen
          $bounds = $screen.Bounds
          Write-Output "Graphics API available: $($bounds.Width)x$($bounds.Height)"
        } catch {
          Write-Output "Graphics API not available"
          exit 1
        }
      `;
      
      exec(`powershell -command "${testScript}"`, (error, stdout) => {
        if (error) {
          reject(new Error('Graphics Capture API not available'));
        } else {
          console.log('Graphics API test:', stdout.trim());
          resolve();
        }
      });
    });
  }

  async captureScreen() {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      // Use Windows Graphics Capture API for screen capture
      const captureScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        
        try {
          # Get ALL screens (multi-monitor support)
          $screens = [System.Windows.Forms.Screen]::AllScreens
          $primaryScreen = [System.Windows.Forms.Screen]::PrimaryScreen
          
          # Calculate virtual screen bounds (covers all monitors)
          $virtualBounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
          $virtualX = $virtualBounds.X
          $virtualY = $virtualBounds.Y
          $virtualWidth = $virtualBounds.Width
          $virtualHeight = $virtualBounds.Height
          
          Write-Host "Virtual screen: $virtualX,$virtualY - $virtualWidth x $virtualHeight"
          
          # Create bitmap for entire virtual screen
          $bitmap = New-Object System.Drawing.Bitmap $virtualWidth, $virtualHeight
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          
          # Capture entire virtual screen
          $graphics.CopyFromScreen($virtualX, $virtualY, 0, 0, $virtualWidth, $virtualHeight)
          
          # Convert to base64 with high quality
          $memoryStream = New-Object System.IO.MemoryStream
          $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
          $bytes = $memoryStream.ToArray()
          $base64 = [System.Convert]::ToBase64String($bytes)
          
          Write-Output $base64
          
          # Cleanup
          $graphics.Dispose()
          $bitmap.Dispose()
          $memoryStream.Dispose()
        } catch {
          Write-Error "Screen capture failed: $_"
          exit 1
        }
      `;
      
      exec(`powershell -command "${captureScript}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Graphics capture error:', error);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async capturePrimaryScreen() {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      // Capture only the primary screen
      const captureScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        
        try {
          # Get primary screen only
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen
          $bounds = $screen.Bounds
          
          Write-Host "Primary screen: $($bounds.X),$($bounds.Y) - $($bounds.Width) x $($bounds.Height)"
          
          # Create bitmap for primary screen
          $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          
          # Capture primary screen
          $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Width, $bounds.Height)
          
          # Convert to base64
          $memoryStream = New-Object System.IO.MemoryStream
          $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
          $bytes = $memoryStream.ToArray()
          $base64 = [System.Convert]::ToBase64String($bytes)
          
          Write-Output $base64
          
          # Cleanup
          $graphics.Dispose()
          $bitmap.Dispose()
          $memoryStream.Dispose()
        } catch {
          Write-Error "Primary screen capture failed: $_"
          exit 1
        }
      `;
      
      exec(`powershell -command "${captureScript}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Primary screen capture error:', error);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async getMousePosition() {
    return new Promise((resolve) => {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        Write-Output "$($pos.X),$($pos.Y)"
      `;
      
      exec(`powershell -command "${script}"`, (error, stdout) => {
        if (error) {
          resolve({ x: 0, y: 0 });
        } else {
          const [x, y] = stdout.trim().split(',').map(Number);
          resolve({ x: x || 0, y: y || 0 });
        }
      });
    });
  }
}

module.exports = WindowsGraphicsCapture;
