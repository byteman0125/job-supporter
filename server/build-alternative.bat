@echo off
echo ========================================
echo Alternative Build Methods (No pkg)
echo ========================================

echo Current directory: %CD%

:: Create dist directory
if not exist "dist" mkdir dist

echo.
echo ========================================
echo METHOD 1: Node.js Bundle (Recommended)
echo ========================================

echo Creating portable Node.js application...

:: Copy all necessary files
echo Copying application files...
copy "main-cli.js" "dist\" >nul
copy "ffmpeg-crossplatform.js" "dist\" >nul
copy "system-tray.js" "dist\" >nul
copy "package.json" "dist\" >nul

:: Copy assets if they exist
if exist "assets" (
    xcopy "assets" "dist\assets\" /E /I /Y >nul
    echo Assets copied
)

:: Install dependencies in dist folder
echo Installing dependencies...
cd dist
call npm install --production
cd ..

:: Create launcher script
echo @echo off > "dist\remote-server.bat"
echo :: Remote Provider Server Launcher >> "dist\remote-server.bat"
echo cd /d "%%~dp0" >> "dist\remote-server.bat"
echo node main-cli.js --background --silent >> "dist\remote-server.bat"

:: Create installer
echo @echo off > "dist\install.bat"
echo :: Remote Provider Server Installer >> "dist\install.bat"
echo echo Installing Remote Provider Server... >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Add to startup >> "dist\install.bat"
echo set "STARTUP_FOLDER=%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup" >> "dist\install.bat"
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%STARTUP_FOLDER%%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%%~dp0remote-server.bat'; $Shortcut.WorkingDirectory = '%%~dp0'; $Shortcut.WindowStyle = 7; $Shortcut.Save()" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Start the server >> "dist\install.bat"
echo echo Starting server... >> "dist\install.bat"
echo start "" /min "%%~dp0remote-server.bat" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo echo Installation completed! >> "dist\install.bat"
echo pause >> "dist\install.bat"

:: Create uninstaller
echo @echo off > "dist\uninstall.bat"
echo :: Remote Provider Server Uninstaller >> "dist\uninstall.bat"
echo echo Uninstalling Remote Provider Server... >> "dist\uninstall.bat"
echo taskkill /f /im "node.exe" /fi "WINDOWTITLE eq Remote Provider Server" >nul 2>&1 >> "dist\uninstall.bat"
echo del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup\RemoteProviderServer.lnk" >nul 2>&1 >> "dist\uninstall.bat"
echo echo Uninstallation completed! >> "dist\uninstall.bat"
echo pause >> "dist\uninstall.bat"

echo.
echo ✅ METHOD 1 COMPLETED!
echo.
echo Created files:
echo   - dist\remote-server.bat (Main launcher)
echo   - dist\install.bat (Installer)
echo   - dist\uninstall.bat (Uninstaller)
echo   - dist\node_modules\ (Dependencies)
echo.

echo ========================================
echo METHOD 2: Creating Nexe Build
echo ========================================

echo Checking for nexe...
nexe --version >nul 2>&1
if errorlevel 1 (
    echo nexe not found. Installing...
    npm install -g nexe
    if errorlevel 1 (
        echo Failed to install nexe. Skipping Method 2.
        goto :method3
    )
)

echo Building with nexe...
nexe main-cli.js --target windows-x64-18.17.0 --output dist\remote-server-nexe.exe
if exist "dist\remote-server-nexe.exe" (
    echo ✅ Nexe build successful: dist\remote-server-nexe.exe
) else (
    echo ❌ Nexe build failed
)

:method3
echo.
echo ========================================
echo METHOD 3: PowerShell Wrapper
echo ========================================

:: Create PowerShell launcher that hides console
echo # Remote Provider Server PowerShell Launcher > "dist\remote-server.ps1"
echo $processInfo = New-Object System.Diagnostics.ProcessStartInfo >> "dist\remote-server.ps1"
echo $processInfo.FileName = "node" >> "dist\remote-server.ps1"
echo $processInfo.Arguments = "main-cli.js --background --silent" >> "dist\remote-server.ps1"
echo $processInfo.WorkingDirectory = $PSScriptRoot >> "dist\remote-server.ps1"
echo $processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden >> "dist\remote-server.ps1"
echo $processInfo.CreateNoWindow = $true >> "dist\remote-server.ps1"
echo [System.Diagnostics.Process]::Start($processInfo) >> "dist\remote-server.ps1"

:: Create batch file that calls PowerShell
echo @echo off > "dist\remote-server-hidden.bat"
echo powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%%~dp0remote-server.ps1" >> "dist\remote-server-hidden.bat"

echo ✅ METHOD 3 COMPLETED!
echo Created: dist\remote-server-hidden.bat (Completely hidden execution)

echo.
echo ========================================
echo BUILD SUMMARY
echo ========================================
echo.
echo ✅ METHOD 1 (Recommended): Node.js Bundle
echo    - Run: dist\install.bat
echo    - Requires Node.js on target system
echo    - Most reliable, easy to debug
echo.
if exist "dist\remote-server-nexe.exe" (
    echo ✅ METHOD 2: Nexe Executable
    echo    - Run: dist\remote-server-nexe.exe
    echo    - No Node.js required on target
    echo    - Single executable file
    echo.
)
echo ✅ METHOD 3: PowerShell Hidden
echo    - Run: dist\remote-server-hidden.bat  
echo    - Completely hidden console
echo    - Requires Node.js on target system
echo.

echo Choose the method that works best for your needs!
echo ========================================

pause
