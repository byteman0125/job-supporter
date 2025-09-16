# Remote Provider Server - Usage Guide

## Running Modes

The Remote Provider Server supports different running modes to suit your needs:

### 1. Normal Mode (Default)
```bash
remote-server.exe
```
- Shows console window with all output
- Visible in taskbar
- Full logging and status messages

### 2. Background Mode
```bash
remote-server.exe --background
```
- Minimizes console window on startup
- Runs primarily in system tray
- Reduced console output
- Still visible in Task Manager (transparent operation)

### 3. Silent Background Mode
```bash
remote-server.exe --background --silent
```
- Minimizes console window
- Suppresses all console output
- Status updates only via system tray
- Ideal for auto-start installations

### 4. Minimized Mode
```bash
remote-server.exe --minimized
```
- Same as --background mode
- Alternative flag name

## Command Line Options

| Option | Description |
|--------|-------------|
| `--background` | Run in background with minimal console output |
| `--minimized` | Same as --background |
| `--silent` | Suppress all console output |

## Auto-Start Configuration

When installed via `install.bat`, the application automatically:
- Starts in `--background --silent` mode
- Adds itself to Windows startup (user-level only)
- Creates system tray icon for status monitoring
- Runs without admin privileges

## System Tray

The system tray icon provides:
- Status indicator (connecting, connected, capturing, offline)
- No popup notifications (clean operation)
- Process remains visible in Task Manager

## Legitimate Background Operation

This application uses only legitimate methods for background operation:
- ✅ Console window minimization (not hiding)
- ✅ User-level startup registration (HKCU registry)
- ✅ System tray for status display
- ✅ Process remains visible in Task Manager
- ✅ No system-level modifications
- ✅ No admin privileges required

## Security & Transparency

- Process title: "Remote Provider Server" (clearly identifiable)
- Executable name: "remote-server.exe" (not system process name)
- Visible in Task Manager at all times
- No attempt to hide from system monitoring tools
- Uses standard Windows APIs only
