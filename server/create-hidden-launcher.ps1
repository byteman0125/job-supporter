# PowerShell script to create a completely hidden Node.js launcher
Write-Host "Creating hidden launcher for Remote Provider Server..."

# Create output directory
if (!(Test-Path "hidden-deploy")) {
    New-Item -ItemType Directory -Path "hidden-deploy" | Out-Null
}

# Copy all necessary files
Write-Host "Copying files..."
Copy-Item "*.js" "hidden-deploy\" -Force
Copy-Item "package.json" "hidden-deploy\" -Force

if (Test-Path "assets") {
    Copy-Item "assets" "hidden-deploy\" -Recurse -Force
}

# Create VBS script for completely hidden execution
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\remote-server.ps1""", 0, False
"@

$vbsContent | Out-File "hidden-deploy\remote-server.vbs" -Encoding ASCII

# Create PowerShell script
$ps1Content = @"
# Remote Provider Server - Hidden PowerShell Launcher
Set-Location `$PSScriptRoot

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    & npm install
}

# Start the server completely hidden
`$processInfo = New-Object System.Diagnostics.ProcessStartInfo
`$processInfo.FileName = "node"
`$processInfo.Arguments = "main-cli.js --background --silent"
`$processInfo.WorkingDirectory = `$PSScriptRoot
`$processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
`$processInfo.CreateNoWindow = `$true
`$processInfo.UseShellExecute = `$false

[System.Diagnostics.Process]::Start(`$processInfo) | Out-Null
"@

$ps1Content | Out-File "hidden-deploy\remote-server.ps1" -Encoding UTF8

# Create installer
$installerContent = @"
@echo off
echo Installing Hidden Remote Provider Server...

:: Copy to a permanent location
set "INSTALL_DIR=%APPDATA%\RemoteProviderServer"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

xcopy "%~dp0*" "%INSTALL_DIR%\" /E /I /Y >nul

:: Add to startup (VBS for completely hidden start)
copy "%INSTALL_DIR%\remote-server.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" >nul

:: Start now
echo Starting server...
"%INSTALL_DIR%\remote-server.vbs"

echo.
echo ✅ Installation completed!
echo The server will start completely hidden when you log in.
echo No console window will be visible.
pause
"@

$installerContent | Out-File "hidden-deploy\install.bat" -Encoding ASCII

# Create README
$readmeContent = @"
Hidden Remote Provider Server
=============================

This version runs completely invisibly - no console window at all.

REQUIREMENTS:
- Node.js installed on target system
- PowerShell execution policy allows scripts

INSTALLATION:
1. Run install.bat as normal user (no admin needed)
2. The server installs to %APPDATA%\RemoteProviderServer
3. Adds hidden startup entry

FEATURES:
- Completely invisible operation
- No console window
- Auto-starts on login
- Runs as normal user process
- Still visible in Task Manager as "node.exe"

MANUAL START:
- Double-click remote-server.vbs

The server runs silently and only communicates via system tray.
"@

$readmeContent | Out-File "hidden-deploy\README.txt" -Encoding UTF8

Write-Host ""
Write-Host "✅ Hidden launcher created in 'hidden-deploy' folder!"
Write-Host ""
Write-Host "Features:"
Write-Host "  - Completely invisible (no console window)"
Write-Host "  - Uses VBS + PowerShell for maximum stealth"
Write-Host "  - Auto-installs to user AppData"
Write-Host "  - No admin privileges required"
Write-Host ""
Write-Host "Run hidden-deploy\install.bat to install!"
