const { exec } = require('child_process');

class WindowsControl {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      // Test if we have the necessary privileges
      this.testPrivileges().then(() => {
        this.isInitialized = true;
        console.log('✅ Windows control initialized with manifest privileges');
        resolve();
      }).catch((error) => {
        console.log('⚠️ Windows control initialization failed:', error.message);
        this.isInitialized = false;
        resolve(); // Continue anyway, will use fallback methods
      });
    });

    return this.initPromise;
  }

  async testPrivileges() {
    return new Promise((resolve, reject) => {
      // Test mouse position access
      exec('powershell -command "Add-Type -AssemblyName System.Windows.Forms; $pos = [System.Windows.Forms.Cursor]::Position; Write-Output \'OK\'"', (error) => {
        if (error) {
          reject(new Error('Mouse position access failed'));
        } else {
          resolve();
        }
      });
    });
  }

  async getMousePosition() {
    await this.initialize();
    
    return new Promise((resolve) => {
      const approaches = [
        // Approach 1: Windows Forms (most reliable with manifest)
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; $pos = [System.Windows.Forms.Cursor]::Position; Write-Output \"$($pos.X),$($pos.Y)\""`,
        
        // Approach 2: Direct Windows API
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\"user32.dll\")] public static extern bool GetCursorPos(out System.Drawing.Point lpPoint); }'; $point = New-Object System.Drawing.Point; [Mouse]::GetCursorPos([ref]$point); Write-Output \"$($point.X),$($point.Y)\""`,
        
        // Approach 3: Using GetCursorPos with proper error handling
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\"user32.dll\")] public static extern bool GetCursorPos(out POINT lpPoint); [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; } }'; $point = New-Object Win32+POINT; [Win32]::GetCursorPos([ref]$point); Write-Output \"$($point.X),$($point.Y)\""`
      ];

      let currentApproach = 0;

      const tryNextApproach = () => {
        if (currentApproach >= approaches.length) {
          console.error('❌ All Windows mouse position approaches failed');
          resolve({ x: 0, y: 0 });
          return;
        }

        const command = approaches[currentApproach];
        exec(command, (error, stdout) => {
          if (error) {
            console.error(`❌ Mouse position approach ${currentApproach + 1} failed:`, error.message);
            currentApproach++;
            tryNextApproach();
          } else {
            try {
              const [x, y] = stdout.trim().split(',').map(Number);
              if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
                console.log(`✅ Windows mouse position: (${x}, ${y}) via approach ${currentApproach + 1}`);
                resolve({ x, y });
              } else {
                throw new Error('Invalid position format');
              }
            } catch (parseError) {
              console.error(`❌ Failed to parse mouse position: ${stdout}`);
              currentApproach++;
              tryNextApproach();
            }
          }
        });
      };

      tryNextApproach();
    });
  }

  async moveMouse(x, y) {
    await this.initialize();
    
    return new Promise((resolve) => {
      const approaches = [
        // Approach 1: Windows Forms (most reliable with manifest)
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`,
        
        // Approach 2: Direct Windows API
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x, int y); }'; [Mouse]::SetCursorPos(${x}, ${y})"`,
        
        // Approach 3: Using SetCursorPos with proper error handling
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x, int y); }'; [Win32]::SetCursorPos(${x}, ${y})"`
      ];

      let currentApproach = 0;

      const tryNextApproach = () => {
        if (currentApproach >= approaches.length) {
          console.error('❌ All Windows mouse move approaches failed');
          resolve();
          return;
        }

        const command = approaches[currentApproach];
        exec(command, (error) => {
          if (error) {
            console.error(`❌ Mouse move approach ${currentApproach + 1} failed:`, error.message);
            currentApproach++;
            tryNextApproach();
          } else {
            console.log(`✅ Windows mouse moved to (${x}, ${y}) via approach ${currentApproach + 1}`);
            resolve();
          }
        });
      };

      tryNextApproach();
    });
  }

  async clickMouse(x, y, button = 'left') {
    await this.initialize();
    
    // First move to position
    await this.moveMouse(x, y);
    
    return new Promise((resolve) => {
      const mouseDown = button === 'right' ? '0x0008' : '0x0002'; // MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN
      const mouseUp = button === 'right' ? '0x0010' : '0x0004';   // MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP

      const approaches = [
        // Approach 1: Direct mouse_event with proper positioning (most reliable with manifest)
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x, int y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo); }'; [Mouse]::SetCursorPos(${x}, ${y}); Start-Sleep -Milliseconds 20; [Mouse]::mouse_event(${mouseDown}, 0, 0, 0, 0); Start-Sleep -Milliseconds 20; [Mouse]::mouse_event(${mouseUp}, 0, 0, 0, 0)"`,
        
        // Approach 2: Using Windows Forms with SendKeys
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`,
        
        // Approach 3: Using mouse_event with different timing
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\"user32.dll\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo); }'; [Win32]::mouse_event(${mouseDown}, 0, 0, 0, 0); Start-Sleep -Milliseconds 10; [Win32]::mouse_event(${mouseUp}, 0, 0, 0, 0)"`
      ];

      let currentApproach = 0;

      const tryNextApproach = () => {
        if (currentApproach >= approaches.length) {
          console.error('❌ All Windows mouse click approaches failed');
          resolve();
          return;
        }

        const command = approaches[currentApproach];
        exec(command, (error) => {
          if (error) {
            console.error(`❌ Mouse click approach ${currentApproach + 1} failed:`, error.message);
            currentApproach++;
            tryNextApproach();
          } else {
            console.log(`✅ Windows mouse click successful: ${button} at (${x}, ${y}) via approach ${currentApproach + 1}`);
            resolve();
          }
        });
      };

      tryNextApproach();
    });
  }

  async pressKey(key, modifiers = []) {
    await this.initialize();
    
    return new Promise((resolve) => {
      // Build modifier string for Windows
      let keyString = '';
      if (modifiers.includes('ctrl')) keyString += '^';
      if (modifiers.includes('alt')) keyString += '%';
      if (modifiers.includes('shift')) keyString += '+';
      keyString += key;

      const approaches = [
        // Approach 1: Standard SendKeys (most reliable with manifest)
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keyString.replace(/'/g, "''")}')"`,
        
        // Approach 2: Using VBScript
        `cscript //nologo -e:vbscript -c "CreateObject(\"WScript.Shell\").SendKeys \"${keyString}\""`,
        
        // Approach 3: Direct Windows API
        `powershell -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Keyboard { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo); }'; [Keyboard]::keybd_event([byte][char]'${key}', 0, 0, 0); Start-Sleep -Milliseconds 10; [Keyboard]::keybd_event([byte][char]'${key}', 0, 2, 0)"`
      ];

      let currentApproach = 0;

      const tryNextApproach = () => {
        if (currentApproach >= approaches.length) {
          console.error('❌ All Windows keyboard approaches failed');
          resolve();
          return;
        }

        const command = approaches[currentApproach];
        exec(command, (error) => {
          if (error) {
            console.error(`❌ Keyboard approach ${currentApproach + 1} failed:`, error.message);
            currentApproach++;
            tryNextApproach();
          } else {
            console.log(`✅ Windows keyboard input successful: ${key} with modifiers [${modifiers.join(', ')}] via approach ${currentApproach + 1}`);
            resolve();
          }
        });
      };

      tryNextApproach();
    });
  }
}

module.exports = WindowsControl;
