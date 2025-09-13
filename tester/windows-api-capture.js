const { exec } = require('child_process');

class WindowsAPICapture {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.testWindowsAPI();
      this.isInitialized = true;
      console.log('✅ Windows API capture initialized');
    } catch (error) {
      console.log('⚠️ Windows API capture not available:', error.message);
      throw error;
    }
  }

  async testWindowsAPI() {
    return new Promise((resolve, reject) => {
      const testScript = `
        try {
          # Test Windows API access
          Add-Type -TypeDefinition '
            using System;
            using System.Runtime.InteropServices;
            using System.Drawing;
            using System.Drawing.Imaging;
            
            public class Win32API {
              [DllImport("user32.dll")]
              public static extern IntPtr GetDesktopWindow();
              
              [DllImport("user32.dll")]
              public static extern IntPtr GetWindowDC(IntPtr hWnd);
              
              [DllImport("gdi32.dll")]
              public static extern IntPtr CreateCompatibleDC(IntPtr hdc);
              
              [DllImport("gdi32.dll")]
              public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);
              
              [DllImport("gdi32.dll")]
              public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
              
              [DllImport("user32.dll")]
              public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);
              
              [DllImport("gdi32.dll")]
              public static extern bool DeleteDC(IntPtr hdc);
              
              [DllImport("gdi32.dll")]
              public static extern bool DeleteObject(IntPtr hObject);
              
              [DllImport("user32.dll")]
              public static extern bool ReleaseDC(IntPtr hWnd, IntPtr hDc);
            }
          '
          
          Write-Output "Windows API access available"
        } catch {
          Write-Output "Windows API access not available"
          exit 1
        }
      `;
      
      exec(`powershell -command "${testScript}"`, (error, stdout) => {
        if (error) {
          reject(new Error('Windows API access not available'));
        } else {
          console.log('Windows API test:', stdout.trim());
          resolve();
        }
      });
    });
  }

  async captureScreenWithWindowsAPI() {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      // Use Windows API for direct screen capture
      const captureScript = `
        Add-Type -TypeDefinition '
          using System;
          using System.Runtime.InteropServices;
          using System.Drawing;
          using System.Drawing.Imaging;
          using System.IO;
          
          public class ScreenCapture {
            [DllImport("user32.dll")]
            public static extern IntPtr GetDesktopWindow();
            
            [DllImport("user32.dll")]
            public static extern IntPtr GetWindowDC(IntPtr hWnd);
            
            [DllImport("gdi32.dll")]
            public static extern IntPtr CreateCompatibleDC(IntPtr hdc);
            
            [DllImport("gdi32.dll")]
            public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);
            
            [DllImport("gdi32.dll")]
            public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
            
            [DllImport("user32.dll")]
            public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);
            
            [DllImport("gdi32.dll")]
            public static extern bool DeleteDC(IntPtr hdc);
            
            [DllImport("gdi32.dll")]
            public static extern bool DeleteObject(IntPtr hObject);
            
            [DllImport("user32.dll")]
            public static extern bool ReleaseDC(IntPtr hWnd, IntPtr hDc);
            
            [DllImport("user32.dll")]
            public static extern int GetSystemMetrics(int nIndex);
            
            public static string CaptureScreen() {
              try {
                // Get screen dimensions
                int screenWidth = GetSystemMetrics(0);  // SM_CXSCREEN
                int screenHeight = GetSystemMetrics(1); // SM_CYSCREEN
                
                // Get desktop window
                IntPtr desktopWindow = GetDesktopWindow();
                IntPtr desktopDC = GetWindowDC(desktopWindow);
                
                // Create compatible DC and bitmap
                IntPtr memoryDC = CreateCompatibleDC(desktopDC);
                IntPtr bitmap = CreateCompatibleBitmap(desktopDC, screenWidth, screenHeight);
                IntPtr oldBitmap = SelectObject(memoryDC, bitmap);
                
                // Copy screen to bitmap
                PrintWindow(desktopWindow, memoryDC, 0);
                
                // Convert to .NET Bitmap
                Bitmap screenBitmap = Bitmap.FromHbitmap(bitmap);
                
                // Convert to base64
                MemoryStream memoryStream = new MemoryStream();
                screenBitmap.Save(memoryStream, ImageFormat.Png);
                byte[] bytes = memoryStream.ToArray();
                string base64 = Convert.ToBase64String(bytes);
                
                // Cleanup
                SelectObject(memoryDC, oldBitmap);
                DeleteObject(bitmap);
                DeleteDC(memoryDC);
                ReleaseDC(desktopWindow, desktopDC);
                screenBitmap.Dispose();
                memoryStream.Dispose();
                
                return base64;
              } catch (Exception ex) {
                throw new Exception("Screen capture failed: " + ex.Message);
              }
            }
          }
        '
        
        try {
          $base64 = [ScreenCapture]::CaptureScreen()
          Write-Output $base64
        } catch {
          Write-Error "Windows API screen capture failed: $_"
          exit 1
        }
      `;
      
      exec(`powershell -command "${captureScript}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Windows API capture error:', error);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

module.exports = WindowsAPICapture;
