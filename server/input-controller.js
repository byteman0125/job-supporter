const { exec } = require('child_process');
const os = require('os');

class InputController {
  constructor() {
    this.platform = os.platform();
    this.lastActionTime = 0;
    this.lastKeyTime = 0;
    this.lastMouseTime = 0;
    this.maxActionsPerSecond = 20; // Rate limiting
    this.maxKeysPerSecond = 50;    // Faster rate for keyboard (20ms between keys)
    this.maxMousePerSecond = 120;  // Much faster rate for smooth mouse (8ms between actions)
    
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

  // Mouse movement
  async moveMouse(x, y) {
    if (!this.isMouseActionAllowed()) return false;

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

  // Mouse click
  async clickMouse(x, y, button = 'left') {
    if (!this.isMouseActionAllowed()) return false;

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

  // Mouse scroll
  async scrollMouse(x, y, delta) {
    if (!this.isMouseActionAllowed()) return false;

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

  // Keyboard input
  async sendKey(key, modifiers = {}) {
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
      
      // Add small delay for character keys to prevent timing issues
      if (result && key.length === 1 && !modifiers.ctrl && !modifiers.alt && !modifiers.meta) {
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay for character keys
      }
      
      return result;
    } catch (error) {
      console.error('❌ Keyboard input error:', error.message);
      return false;
    }
  }

  // Windows implementations
  async windowsMoveMouse(x, y) {
    const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Windows mouse move failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async windowsClickMouse(x, y, button) {
    // Move to position first
    await this.windowsMoveMouse(x, y);
    
    // Map button names to Windows constants
    const buttonMap = {
      'left': '0x02', // MOUSEEVENTF_LEFTDOWN
      'right': '0x08', // MOUSEEVENTF_RIGHTDOWN
      'middle': '0x20' // MOUSEEVENTF_MIDDLEDOWN
    };
    
    const downFlag = buttonMap[button] || buttonMap['left'];
    const upFlag = button === 'right' ? '0x10' : button === 'middle' ? '0x40' : '0x04';
    
    const command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo); }'; [Mouse]::mouse_event(${downFlag}, 0, 0, 0, 0); Start-Sleep -Milliseconds 50; [Mouse]::mouse_event(${upFlag}, 0, 0, 0, 0)"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
        if (error) {
          console.error('❌ Windows mouse click failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async windowsScrollMouse(x, y, delta) {
    await this.windowsMoveMouse(x, y);
    
    const scrollAmount = Math.sign(delta) * 120; // Windows scroll units
    const command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo); }'; [Mouse]::mouse_event(0x0800, 0, 0, ${scrollAmount}, 0)"`;
    
    return new Promise((resolve) => {
      exec(command, (error) => {
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
