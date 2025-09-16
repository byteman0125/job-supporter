# Code Supporter App

A remote desktop assistance tool designed for coding support scenarios. The application consists of two parts: a **Server (Client)** and a **Viewer (Server)** that communicate via TCP/IP protocol.

## Features

### Server (Client) Application
- **Screen Sharing**: Shares screen with viewer in real-time
- **System Tray Integration**: Minimizes to tray when connected for privacy
- **Keyboard Shortcuts**:
  - `ALT+L`: Input one word at a time (human-like typing speed)
  - `ALT+K`: Input one line at a time (professional programmer speed)
  - `ALT+C`: Copy clipboard data to temp storage
- **Audio Support**: Bidirectional voice communication
- **Privacy Features**: Window becomes invisible during screen sharing
- **Settings Window**: Accessible via tray icon for device configuration

### Viewer (Server) Application
- **Remote Control**: Two modes - View Mode (default) and Control Mode
- **Screen Capture**: Save screenshots to image directory
- **Data Transmission**: Send answers/code to server via text area
- **Audio Support**: Listen to server's audio and speak via microphone
- **Device Selection**: Choose audio input/output devices
- **Real-time Communication**: TCP/IP based communication

## Installation

1. **Install Dependencies**:
   ```bash
   npm run install:all
   ```

2. **Development Mode**:
   ```bash
   # Start Server app
   npm run dev:server
   
   # Start Viewer app (in another terminal)
   npm run dev:viewer
   ```

3. **Build Executables**:
   ```bash
   # Build both apps
   npm run build:all
   
   # Or build individually
   npm run build:server
   npm run build:viewer
   ```

## Usage

### Starting the Viewer (Server)
1. Run the viewer application
2. Note the IP address and port (default: 3000)
3. The server will start and wait for connections

### Connecting the Server (Client)
1. Run the server application
2. Enter the viewer's IP address and port
3. Click "Connect to Viewer"
4. The app will minimize to system tray when connected

### Using the Applications

#### Viewer Controls:
- **View Mode**: Only view the server's screen
- **Control Mode**: Control server's mouse and keyboard
- **Capture**: Save screenshots of server's screen
- **Send Answer**: Type code/answers and send to server

#### Server Shortcuts:
- **ALT+L**: Type received data word by word
- **ALT+K**: Type received data line by line
- **ALT+C**: Copy clipboard to temp data

## Technical Details

- **Framework**: Electron (cross-platform desktop apps)
- **Communication**: TCP/IP with Socket.IO
- **Screen Capture**: Real-time screen sharing
- **Audio**: WebRTC-based audio streaming
- **Build**: Electron Builder for .exe generation
- **Platforms**: Windows and Ubuntu support

## Project Structure

```
code-supporter-app/
├── server/                 # Client application
│   ├── main.js            # Main process
│   ├── renderer/          # UI components
│   └── assets/            # Icons and resources
├── viewer/             # Server application
│   ├── main.js            # Main process
│   ├── renderer/          # UI components
│   ├── assets/            # Icons and resources
│   └── images/            # Screenshot storage
└── package.json           # Root package configuration
```

## Security Notes

- The server app window becomes invisible during screen sharing
- All communication is local network based
- No external servers or cloud services required
- Audio and screen data are transmitted in real-time only

## Troubleshooting

1. **Connection Issues**: Ensure both apps are on the same network
2. **Audio Problems**: Check device permissions and settings
3. **Screen Sharing**: Verify display permissions
4. **Build Issues**: Ensure all dependencies are installed

## License

MIT License - See LICENSE file for details
