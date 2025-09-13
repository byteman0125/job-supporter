const { spawn } = require('child_process');
const path = require('path');

class LegitimateIPC {
  constructor() {
    this.workerProcess = null;
  }

  async startWorkerProcess() {
    if (this.workerProcess) return;

    // Start a legitimate worker process for screen capture
    const workerScript = `
      const { exec } = require('child_process');
      const process = require('process');
      
      // Listen for capture requests
      process.stdin.on('data', async (data) => {
        try {
          const request = JSON.parse(data.toString());
          
          if (request.type === 'capture') {
            // Perform screen capture using legitimate methods
            const result = await captureScreen();
            process.stdout.write(JSON.stringify({ success: true, data: result }) + '\\n');
          }
        } catch (error) {
          process.stdout.write(JSON.stringify({ success: false, error: error.message }) + '\\n');
        }
      });
      
      async function captureScreen() {
        return new Promise((resolve, reject) => {
          const script = \`
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen
            $bounds = $screen.Bounds
            $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
            
            $memoryStream = New-Object System.IO.MemoryStream
            $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
            $bytes = $memoryStream.ToArray()
            $base64 = [System.Convert]::ToBase64String($bytes)
            
            Write-Output $base64
            $graphics.Dispose()
            $bitmap.Dispose()
            $memoryStream.Dispose()
          \`;
          
          require('child_process').exec(\`powershell -command "\${script}"\`, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout.trim());
          });
        });
      }
    `;

    // Create a temporary worker file
    const workerPath = path.join(__dirname, 'temp-worker.js');
    require('fs').writeFileSync(workerPath, workerScript);

    // Start the worker process
    this.workerProcess = spawn('node', [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log('✅ Legitimate worker process started');
  }

  async captureScreen() {
    if (!this.workerProcess) {
      await this.startWorkerProcess();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Capture timeout'));
      }, 10000);

      const onData = (data) => {
        try {
          const response = JSON.parse(data.toString());
          clearTimeout(timeout);
          this.workerProcess.stdout.removeListener('data', onData);
          
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        } catch (error) {
          // Continue listening
        }
      };

      this.workerProcess.stdout.on('data', onData);
      this.workerProcess.stdin.write(JSON.stringify({ type: 'capture' }) + '\n');
    });
  }

  cleanup() {
    if (this.workerProcess) {
      this.workerProcess.kill();
      this.workerProcess = null;
    }
  }
}

module.exports = LegitimateIPC;
