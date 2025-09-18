const { exec } = require('child_process');
const os = require('os');

class InputController {
  constructor() {
    this.platform = os.platform();
    this.lastActionTime = 0;
    this.lastKeyTime = 0;
    this.lastMouseTime = 0;
    this.maxActionsPerSecond = 20; // Rate limiting
    this.maxKeysPerSecond = 100;   // Much faster rate for keyboard (10ms between keys)
    this.maxMousePerSecond = 30;   // 30 FPS mouse rate (33ms between actions)
    
    // Keyboard queue for sequential processing
    this.keyboardQueue = [];
    this.processingKeyboard = false;
    
    // Mouse click queue for rapid-fire clicking
    this.clickQueue = [];
    this.processingClicks = false;
    
    // Dangerous key combinations to block
    this.dangerousKeys = [
      'ctrl+alt+delete',
      'ctrl+alt+del',
      'alt+f4',
      'win+l',
      'cmd+q',
      'ctrl+shift+esc'
    ];
    
    console.log(`🎮 Input Controller initialized for platform: ${this.platform}`);
  }

  // Rate limiting check
  isActionAllowed() {
    const now = Date.now();
    const timeSinceLastAction = now - this.lastActionTime;
    const minInterval = 1000 / this.maxActionsPerSecond; // 50ms for 20 actions/sec
    
    if (timeSinceLastAction < minInterval) {
      return false;
    }
    
    this.lastActionTime = now;
    return true;
  }

  // Rate limiting for keyboard actions (faster)
  isKeyActionAllowed() {
    const now = Date.now();
    const timeSinceLastKey = now - this.lastKeyTime;
    const minInterval = 1000 / this.maxKeysPerSecond; // 20ms for 50 keys/sec
    
    if (timeSinceLastKey < minInterval) {
      return false;
    }
    
    this.lastKeyTime = now;
    return true;
  }

  // Rate limiting for mouse actions (standard)
  isMouseActionAllowed() {
    const now = Date.now();
    const timeSinceLastMouse = now - this.lastMouseTime;
    const minInterval = 1000 / this.maxMousePerSecond; // 50ms for 20 actions/sec
    
    if (timeSinceLastMouse < minInterval) {
      return false;
    }
    
    this.lastMouseTime = now;
    return true;
  }

  // Check if key combination is safe
  isSafeKeyCombo(key, modifiers) {
    const combo = this.buildKeyCombo(key, modifiers).toLowerCase();
    return !this.dangerousKeys.some(dangerous => combo.includes(dangerous));
  }

  // Build key combination string for safety check
  buildKeyCombo(key, modifiers) {
    const parts = [];
    if (modifiers.ctrl) parts.push('ctrl');
    if (modifiers.alt) parts.push('alt');
    if (modifiers.shift) parts.push('shift');
    if (modifiers.meta) parts.push(this.platform === 'darwin' ? 'cmd' : 'win');
    parts.push(key.toLowerCase());
    return parts.join('+');
  }

  // Mouse movement (no rate limiting - already throttled on client at 60 FPS)
  async moveMouse(x, y) {
    try {
      let result;
      switch (this.platform) {
        case 'win32':
          result = await this.windowsMoveMouse(x, y);
          break;
        case 'linux':
          result = await this.linuxMoveMouse(x, y);
          break;
        case 'darwin':
          result = await this.macosMoveMouse(x, y);
          break;
        default:
          return false;
      }
      
      return result;
    } catch (error) {
      return false;
    }
  }

  // High-speed mouse movement (bypasses rate limiting for smooth control)
  async moveMouseFast(x, y) {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.windowsMoveMouse(x, y);
        case 'linux':
          return await this.linuxMoveMouse(x, y);
        case 'darwin':
          return await this.macosMoveMouse(x, y);
        default:
          console.error('❌ Unsupported platform for mouse movement:', this.platform);
          return false;
      }
    } catch (error) {
      console.error('❌ Mouse move error:', error.message);
      return false;
    }
  }

  // Mouse click (no rate limiting for responsive clicking)
  async clickMouse(x, y, button = 'left') {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.windowsClickMouse(x, y, button);
        case 'linux':
          return await this.linuxClickMouse(x, y, button);
        case 'darwin':
          return await this.macosClickMouse(x, y, button);
        default:
          console.error('❌ Unsupported platform for mouse click:', this.platform);
          return false;
      }
    } catch (error) {
      console.error('❌ Mouse click error:', error.message);
      return false;
    }
  }

  // Mouse scroll (no rate limiting for responsive scrolling)
  async scrollMouse(x, y, delta) {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.windowsScrollMouse(x, y, delta);
        case 'linux':
          return await this.linuxScrollMouse(x, y, delta);
        case 'darwin':
          return await this.macosScrollMouse(x, y, delta);
        default:
          console.error('❌ Unsupported platform for mouse scroll:', this.platform);
          return false;
      }
    } catch (error) {
      console.error('❌ Mouse scroll error:', error.message);
      return false;
    }
  }

  // Keyboard input with queuing for proper order
  async sendKey(key, modifiers = {}) {
    return new Promise((resolve) => {
      // Add to queue
      this.keyboardQueue.push({ key, modifiers, resolve });
      
      // Process queue if not already processing
      if (!this.processingKeyboard) {
        this.processKeyboardQueue();
      }
    });
  }

  // Process keyboard queue sequentially
  async processKeyboardQueue() {
    if (this.processingKeyboard || this.keyboardQueue.length === 0) {
      return;
    }

    this.processingKeyboard = true;

    while (this.keyboardQueue.length > 0) {
      const { key, modifiers, resolve } = this.keyboardQueue.shift();
      
      try {
        const result = await this.sendKeyDirect(key, modifiers);
        resolve(result);
        
        // Add delay between characters to prevent timing issues
        if (key.length === 1 && !modifiers.ctrl && !modifiers.alt && !modifiers.meta) {
          await new Promise(r => setTimeout(r, 25)); // 25ms delay between characters for perfect order
        }
      } catch (error) {
        console.error('❌ Keyboard queue processing error:', error.message);
        resolve(false);
      }
    }

    this.processingKeyboard = false;
  }

  // Direct keyboard input (used by queue)
  async sendKeyDirect(key, modifiers = {}) {
    if (!this.isKeyActionAllowed()) return false;
    if (!this.isSafeKeyCombo(key, modifiers)) {
      console.warn('⚠️ Blocked dangerous key combination:', this.buildKeyCombo(key, modifiers));
      return false;
    }

    try {
      let result;
      switch (this.platform) {
        case 'win32':
          result = await this.windowsSendKey(key, modifiers);
          break;
        case 'linux':
          result = await this.linuxSendKey(key, modifiers);
          break;
        case 'darwin':
          result = await this.macosSendKey(key, modifiers);
          break;
        default:
          console.error('❌ Unsupported platform for keyboard input:', this.platform);
          return false;
      }
      
      return result;
    } catch (error) {
      console.error('❌ Keyboard input error:', error.message);
      return false;
    }
  }

  // Windows implementations
  async windowsMoveMouse(x, y) {
    // Try multiple approaches for reliable mouse movement
    
    // Approach 1: Windows Forms (primary)
    const formsCommand = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y}) } catch { exit 1 }"`;
    
    return new Promise((resolve) => {
      exec(formsCommand, { timeout: 1000 }, (error) => {
        if (!error) {
          resolve(true);
          return;
        }
        
        // Approach 2: SetCursorPos API fallback
        const apiCommand = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "try { Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern bool SetCursorPos(int x,int y);' -Name Mouse -Namespace Win32; [Win32.Mouse]::SetCursorPos(${x},${y}) } catch { exit 1 }"`;
        
        exec(apiCommand, { timeout: 1000 }, (apiError) => {
          if (apiError) {
            console.error('❌ Windows mouse move failed (all methods):', apiError.message);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    });
  }

  async windowsClickMouse(x, y, button) {
    console.log(`🖱️ Attempting ${button} click at (${x}, ${y})`);
    
    if (button === 'left') {
      // SIMPLEST POSSIBLE: Try multiple basic methods
      console.log('🖱️ Trying left click - Method 1: Direct Windows API');
      
      // Method 1: Windows API using TypeDefinition (avoiding line break issues)
      const csharpCode = `
using System;
using System.Runtime.InteropServices;
public static class MouseAPI {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);
}`;
      
      const apiCommand = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-Type -TypeDefinition @'${csharpCode}'@; [MouseAPI]::mouse_event(2,0,0,0,0); [MouseAPI]::mouse_event(4,0,0,0,0)"`;
      
      return new Promise((resolve) => {
        exec(apiCommand, { timeout: 3000 }, (error, stdout, stderr) => {
          console.log('🖱️ API Method - Error:', error?.message || 'none');
          console.log('🖱️ API Method - Stdout:', stdout || 'empty');
          console.log('🖱️ API Method - Stderr:', stderr || 'empty');
          
          if (!error) {
            console.log('✅ Left click succeeded with API method');
            resolve(true);
            return;
          }
          
          console.log('🖱️ Trying left click - Method 2: Simple VBScript');
          // Method 2: Simple VBScript approach
          const vbsScript = `
Set shell = CreateObject("WScript.Shell")
shell.SendKeys " "
`;
          const fs = require('fs');
          const tempScript = `${require('os').tmpdir()}\\leftclick_${Date.now()}.vbs`;
          
          try {
            fs.writeFileSync(tempScript, vbsScript);
            exec(`cscript //nologo "${tempScript}"`, { timeout: 2000 }, (vbsError) => {
              try { fs.unlinkSync(tempScript); } catch {}
              
              if (!vbsError) {
                console.log('✅ Left click succeeded with VBScript');
                resolve(true);
              } else {
                console.log('❌ All left click methods failed');
                resolve(false);
              }
            });
          } catch (fsError) {
            console.log('❌ All left click methods failed');
            resolve(false);
          }
        });
      });
      
    } else if (button === 'right') {
      // Right click method using TypeDefinition (avoiding line break issues)
      const csharpCode = `
using System;
using System.Runtime.InteropServices;
public static class MouseAPI {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);
}`;
      
      const rightApiCommand = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-Type -TypeDefinition @'${csharpCode}'@; [MouseAPI]::mouse_event(8,0,0,0,0); [MouseAPI]::mouse_event(16,0,0,0,0)"`;
      
      return new Promise((resolve) => {
        exec(rightApiCommand, { timeout: 2000 }, (error) => {
          if (!error) {
            console.log('✅ Right click executed with API');
            resolve(true);
          } else {
            console.error('❌ Right click failed:', error.message);
            resolve(false);
          }
        });
      });
      
    } else {
      // Middle click: Use Enter as fallback
      const middleClickCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`;
      
      return new Promise((resolve) => {
        exec(middleClickCommand, { timeout: 1000 }, (error) => {
          if (error) {
            console.error('❌ Windows middle click failed:', error.message);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }
  }

  async windowsScrollMouse(x, y, delta) {
    // Use SendKeys for scroll simulation (more reliable)
    
    const scrollDirection = delta > 0 ? '{UP}' : '{DOWN}';
    const scrollCount = Math.abs(Math.round(delta / 120)) || 1;
    
    let scrollKeys = '';
    for (let i = 0; i < scrollCount; i++) {
      scrollKeys += scrollDirection;
    }
    
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${scrollKeys}')"`;
    
    return new Promise((resolve) => {
      exec(command, { timeout: 500 }, (error) => {
        if (error) {
          console.error('❌ Windows mouse scroll failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async windowsSendKey(key, modifiers) {
    // Handle special keys first
    const specialKeys = {
      'Enter': '{ENTER}',
      'Backspace': '{BACKSPACE}',
      'Delete': '{DELETE}',
      'Tab': '{TAB}',
      'Escape': '{ESC}',
      'ArrowUp': '{UP}',
      'ArrowDown': '{DOWN}',
      'ArrowLeft': '{LEFT}',
      'ArrowRight': '{RIGHT}',
      'Home': '{HOME}',
      'End': '{END}',
      'PageUp': '{PGUP}',
      'PageDown': '{PGDN}',
      'Insert': '{INSERT}',
      'CapsLock': '{CAPSLOCK}',
      'NumLock': '{NUMLOCK}',
      'ScrollLock': '{SCROLLLOCK}',
      'PrintScreen': '{PRTSC}',
      'Pause': '{BREAK}',
      ' ': ' ',
      // Function keys
      'F1': '{F1}', 'F2': '{F2}', 'F3': '{F3}', 'F4': '{F4}',
      'F5': '{F5}', 'F6': '{F6}', 'F7': '{F7}', 'F8': '{F8}',
      'F9': '{F9}', 'F10': '{F10}', 'F11': '{F11}', 'F12': '{F12}'
    };
    
    let keyString = specialKeys[key] || key;
    
    // For regular characters, escape SendKeys special characters
    if (!specialKeys[key]) {
      // SendKeys treats these as special: + ^ % ~ { } [ ] ( )
      keyString = keyString.replace(/[\+\^\%\~\{\}\[\]\(\)]/g, '{$&}');
      
      // Debug logging for character keys
      console.log(`🔤 Processing character: "${key}" -> "${keyString}"`);
    }
    
    // Build modifier prefix (order matters in SendKeys: +^%key)
    let modifierPrefix = '';
    if (modifiers.shift) modifierPrefix += '+';
    if (modifiers.ctrl) modifierPrefix += '^';
    if (modifiers.alt) modifierPrefix += '%';
    
    // Combine modifiers with key
    const finalKeyString = modifierPrefix + keyString;
    
    // Escape quotes and backticks for PowerShell command
    const escapedKey = finalKeyString.replace(/['"]/g, '`$&').replace(/`/g, '``');
    
    const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedKey}')"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Windows key send failed:', error.message, 'Key:', finalKeyString);
          console.error('Command was:', command);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Linux implementations
  async linuxMoveMouse(x, y) {
    const command = `xdotool mousemove ${x} ${y}`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Linux mouse move failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async linuxClickMouse(x, y, button) {
    // Move first
    await this.linuxMoveMouse(x, y);
    
    // Map button names to xdotool button numbers
    const buttonMap = {
      'left': '1',
      'middle': '2',
      'right': '3'
    };
    
    const buttonNum = buttonMap[button] || '1';
    const command = `xdotool click ${buttonNum}`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Linux mouse click failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async linuxScrollMouse(x, y, delta) {
    await this.linuxMoveMouse(x, y);
    
    const button = delta > 0 ? '5' : '4'; // 4 = scroll up, 5 = scroll down
    const command = `xdotool click ${button}`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Linux mouse scroll failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async linuxSendKey(key, modifiers) {
    // Handle special keys
    const specialKeys = {
      'Enter': 'Return',
      'Backspace': 'BackSpace',
      'Delete': 'Delete',
      'Tab': 'Tab',
      'Escape': 'Escape',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'Prior',
      'PageDown': 'Next',
      'Insert': 'Insert',
      'CapsLock': 'Caps_Lock',
      'NumLock': 'Num_Lock',
      'ScrollLock': 'Scroll_Lock',
      'PrintScreen': 'Print',
      'Pause': 'Pause',
      ' ': 'space',
      // Function keys
      'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
      'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
      'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
    };
    
    let keyString = specialKeys[key] || key;
    
    // Build modifier string
    const modifierParts = [];
    if (modifiers.ctrl) modifierParts.push('ctrl');
    if (modifiers.alt) modifierParts.push('alt');
    if (modifiers.shift) modifierParts.push('shift');
    if (modifiers.meta) modifierParts.push('super');
    
    let command;
    if (modifierParts.length > 0) {
      command = `xdotool key ${modifierParts.join('+')}+${keyString}`;
    } else {
      command = `xdotool key ${keyString}`;
    }
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Linux key send failed:', error.message, 'Command:', command);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // macOS implementations
  async macosMoveMouse(x, y) {
    const command = `osascript -e "tell application \\"System Events\\" to set the position of the mouse to {${x}, ${y}}"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ macOS mouse move failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async macosClickMouse(x, y, button) {
    await this.macosMoveMouse(x, y);
    
    const clickType = button === 'right' ? 'right click' : button === 'middle' ? 'middle click' : 'click';
    const command = `osascript -e "tell application \\"System Events\\" to ${clickType} at {${x}, ${y}}"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ macOS mouse click failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async macosScrollMouse(x, y, delta) {
    await this.macosMoveMouse(x, y);
    
    const scrollDirection = delta > 0 ? 'down' : 'up';
    const command = `osascript -e "tell application \\"System Events\\" to scroll ${scrollDirection} at {${x}, ${y}}"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ macOS mouse scroll failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async macosSendKey(key, modifiers) {
    let keyString = key;
    
    // Handle special keys
    const specialKeys = {
      'Enter': 'return',
      'Backspace': 'delete',
      'Delete': 'forward delete',
      'Tab': 'tab',
      'Escape': 'escape',
      'ArrowUp': 'up arrow',
      'ArrowDown': 'down arrow',
      'ArrowLeft': 'left arrow',
      'ArrowRight': 'right arrow',
      ' ': 'space'
    };
    
    if (specialKeys[key]) {
      keyString = specialKeys[key];
    }
    
    // Build modifier string
    const modifierParts = [];
    if (modifiers.ctrl) modifierParts.push('control');
    if (modifiers.alt) modifierParts.push('option');
    if (modifiers.shift) modifierParts.push('shift');
    if (modifiers.meta) modifierParts.push('command');
    
    let keystroke;
    if (modifierParts.length > 0) {
      keystroke = `keystroke "${keyString}" using {${modifierParts.join(', ')}} down`;
    } else {
      keystroke = `keystroke "${keyString}"`;
    }
    
    const command = `osascript -e "tell application \\"System Events\\" to ${keystroke}"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ macOS key send failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}

module.exports = InputController;
