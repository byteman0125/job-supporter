@echo off
echo ========================================
echo Remote Provider Server - Windows Build
echo ========================================

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Navigate to server directory
cd /d "%~dp0"
echo Current directory: %CD%

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Install pkg globally if not already installed
echo Checking for pkg...
pkg --version >nul 2>&1
if errorlevel 1 (
    echo Installing pkg globally...
    npm install -g pkg
    if errorlevel 1 (
        echo ERROR: Failed to install pkg
        pause
        exit /b 1
    )
)

:: Create dist directory if it doesn't exist
if not exist "dist" mkdir dist

echo ========================================
echo STEP 1: Building Windows Executable
echo ========================================
pkg main-cli.js --targets node18-win-x64 --output dist/svchost.exe

if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

:: Copy assets to dist folder
echo Copying assets...
if exist "assets" (
    xcopy "assets" "dist\assets\" /E /I /Y >nul
    echo Assets copied to dist/assets/
)

:: Copy JavaScript modules
if exist "ffmpeg-crossplatform.js" copy "ffmpeg-crossplatform.js" "dist\" >nul
if exist "system-tray.js" copy "system-tray.js" "dist\" >nul

echo ========================================
echo STEP 2: Setting up FFmpeg for Windows
echo ========================================

:: Check if FFmpeg setup script exists
if exist "setup-ffmpeg-windows.bat" (
    echo Running FFmpeg setup script...
    call setup-ffmpeg-windows.bat
) else (
    echo ⚠️  FFmpeg setup script not found: setup-ffmpeg-windows.bat
    echo Please run setup-ffmpeg-windows.bat first to install FFmpeg
    pause
    exit /b 1
)

echo ========================================
echo STEP 3: Creating Windows Service Installer
echo ========================================

:: Create the service installer script
echo @echo off > "dist\install-service.bat"
echo :: Remote Provider Server - Windows Service Installer >> "dist\install-service.bat"
echo echo ======================================== >> "dist\install-service.bat"
echo echo Remote Provider Server Installation >> "dist\install-service.bat"
echo echo ======================================== >> "dist\install-service.bat"
echo echo. >> "dist\install-service.bat"
echo :: Check for admin privileges >> "dist\install-service.bat"
echo net session ^>nul 2^>^&1 >> "dist\install-service.bat"
echo if %%errorLevel%% neq 0 ^( >> "dist\install-service.bat"
echo     echo ERROR: Administrator privileges required! >> "dist\install-service.bat"
echo     echo Please right-click and select "Run as administrator" >> "dist\install-service.bat"
echo     pause >> "dist\install-service.bat"
echo     exit /b 1 >> "dist\install-service.bat"
echo ^) >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo set SERVICE_DIR=%%~dp0 >> "dist\install-service.bat"
echo set SERVICE_NAME=RemoteProviderServer >> "dist\install-service.bat"
echo set SERVICE_DISPLAY_NAME=Remote Provider Server >> "dist\install-service.bat"
echo set EXECUTABLE_PATH=%%SERVICE_DIR%%svchost.exe >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo echo Installing service from: %%SERVICE_DIR%% >> "dist\install-service.bat"
echo echo Executable: %%EXECUTABLE_PATH%% >> "dist\install-service.bat"
echo echo. >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo :: Stop existing service >> "dist\install-service.bat"
echo sc query "%%SERVICE_NAME%%" ^>nul 2^>^&1 >> "dist\install-service.bat"
echo if %%errorlevel%% equ 0 ^( >> "dist\install-service.bat"
echo     echo Stopping existing service... >> "dist\install-service.bat"
echo     sc stop "%%SERVICE_NAME%%" ^>nul 2^>^&1 >> "dist\install-service.bat"
echo     timeout /t 3 ^>nul >> "dist\install-service.bat"
echo     sc delete "%%SERVICE_NAME%%" ^>nul 2^>^&1 >> "dist\install-service.bat"
echo     timeout /t 2 ^>nul >> "dist\install-service.bat"
echo ^) >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo :: Create service >> "dist\install-service.bat"
echo echo Creating Windows service... >> "dist\install-service.bat"
echo sc create "%%SERVICE_NAME%%" binPath= "\"%%EXECUTABLE_PATH%%\"" DisplayName= "%%SERVICE_DISPLAY_NAME%%" start= auto >> "dist\install-service.bat"
echo sc description "%%SERVICE_NAME%%" "Remote Provider Server - Auto-start service" >> "dist\install-service.bat"
echo sc failure "%%SERVICE_NAME%%" reset= 86400 actions= restart/5000/restart/10000/restart/30000 >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo :: Start service >> "dist\install-service.bat"
echo echo Starting service... >> "dist\install-service.bat"
echo sc start "%%SERVICE_NAME%%" >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo :: Add firewall rule >> "dist\install-service.bat"
echo netsh advfirewall firewall add rule name="Remote Provider Server" dir=in action=allow program="%%EXECUTABLE_PATH%%" enable=yes ^>nul 2^>^&1 >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo :: Create auto-start registry entry >> "dist\install-service.bat"
echo reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RemoteProviderServer" /t REG_SZ /d "\"%%EXECUTABLE_PATH%%\"" /f ^>nul 2^>^&1 >> "dist\install-service.bat"
echo. >> "dist\install-service.bat"
echo echo ======================================== >> "dist\install-service.bat"
echo echo INSTALLATION COMPLETED! >> "dist\install-service.bat"
echo echo Service will auto-start on system boot >> "dist\install-service.bat"
echo echo ======================================== >> "dist\install-service.bat"
echo pause >> "dist\install-service.bat"

:: Create uninstaller
echo @echo off > "dist\uninstall.bat"
echo echo Uninstalling Remote Provider Server... >> "dist\uninstall.bat"
echo net session ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo if %%errorLevel%% neq 0 ^( >> "dist\uninstall.bat"
echo     echo ERROR: Administrator privileges required! >> "dist\uninstall.bat"
echo     pause >> "dist\uninstall.bat"
echo     exit /b 1 >> "dist\uninstall.bat"
echo ^) >> "dist\uninstall.bat"
echo sc stop "RemoteProviderServer" >> "dist\uninstall.bat"
echo sc delete "RemoteProviderServer" >> "dist\uninstall.bat"
echo reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RemoteProviderServer" /f ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo netsh advfirewall firewall delete rule name="Remote Provider Server" ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo echo Service uninstalled! >> "dist\uninstall.bat"
echo pause >> "dist\uninstall.bat"

echo ========================================
echo STEP 4: Creating NSIS Installer
echo ========================================

:: Check for NSIS
makensis /VERSION >nul 2>&1
if errorlevel 1 (
    echo NSIS not found - creating self-extracting archive...
    goto :create_sfx
) else (
    echo NSIS found - creating proper installer...
    goto :create_nsis
)

:create_nsis
:: Create NSIS script
echo ; Remote Provider Server Windows Installer > "RemoteProvider.nsi"
echo !define PRODUCT_NAME "Remote Provider Server" >> "RemoteProvider.nsi"
echo !define PRODUCT_VERSION "1.0.0" >> "RemoteProvider.nsi"
echo !define PRODUCT_PUBLISHER "Remote Provider" >> "RemoteProvider.nsi"
echo !define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\svchost.exe" >> "RemoteProvider.nsi"
echo !define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" >> "RemoteProvider.nsi"
echo !define PRODUCT_UNINST_ROOT_KEY "HKLM" >> "RemoteProvider.nsi"
echo. >> "RemoteProvider.nsi"
echo SetCompressor lzma >> "RemoteProvider.nsi"
echo RequestExecutionLevel admin >> "RemoteProvider.nsi"
echo InstallDir "$PROGRAMFILES\${PRODUCT_NAME}" >> "RemoteProvider.nsi"
echo. >> "RemoteProvider.nsi"
echo Page directory >> "RemoteProvider.nsi"
echo Page instfiles >> "RemoteProvider.nsi"
echo. >> "RemoteProvider.nsi"
echo Section "MainSection" SEC01 >> "RemoteProvider.nsi"
echo   SetOutPath "$INSTDIR" >> "RemoteProvider.nsi"
echo   File /r "dist\*.*" >> "RemoteProvider.nsi"
echo   ExecWait '"$INSTDIR\install-service.bat"' >> "RemoteProvider.nsi"
echo   WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)" >> "RemoteProvider.nsi"
echo   WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe" >> "RemoteProvider.nsi"
echo   WriteUninstaller "$INSTDIR\uninst.exe" >> "RemoteProvider.nsi"
echo SectionEnd >> "RemoteProvider.nsi"
echo. >> "RemoteProvider.nsi"
echo Section Uninstall >> "RemoteProvider.nsi"
echo   ExecWait '"$INSTDIR\uninstall.bat"' >> "RemoteProvider.nsi"
echo   RMDir /r "$INSTDIR" >> "RemoteProvider.nsi"
echo   DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" >> "RemoteProvider.nsi"
echo SectionEnd >> "RemoteProvider.nsi"

makensis RemoteProvider.nsi
if errorlevel 1 (
    echo NSIS compilation failed
    goto :create_sfx
) else (
    echo ✅ NSIS installer created: RemoteProvider.exe
    goto :finish
)

:create_sfx
echo Creating self-extracting archive...
echo Manual installation: Run dist\install-service.bat as administrator

:finish
:: Clean up
if exist "RemoteProvider.nsi" del "RemoteProvider.nsi"

:: Create README
echo Remote Provider Server - Windows Distribution > "dist\README.txt"
echo ============================================== >> "dist\README.txt"
echo. >> "dist\README.txt"
echo INSTALLATION: >> "dist\README.txt"
echo 1. Run install-service.bat as Administrator >> "dist\README.txt"
echo 2. Service will auto-start on system boot >> "dist\README.txt"
echo 3. Server will run in background >> "dist\README.txt"
echo. >> "dist\README.txt"
echo UNINSTALLATION: >> "dist\README.txt"
echo 1. Run uninstall.bat as Administrator >> "dist\README.txt"
echo. >> "dist\README.txt"
echo FEATURES: >> "dist\README.txt"
echo - Windows Service integration >> "dist\README.txt"
echo - Auto-start on boot >> "dist\README.txt"
echo - Firewall configuration >> "dist\README.txt"
echo - Registry auto-start entry >> "dist\README.txt"
echo - FFmpeg screen capture >> "dist\README.txt"

echo.
echo ========================================
echo WINDOWS BUILD COMPLETED!
echo ========================================
echo.
echo Files created:
echo ✅ dist/svchost.exe - Main executable
echo ✅ dist/install-service.bat - Service installer
echo ✅ dist/uninstall.bat - Service uninstaller
if exist "RemoteProvider.exe" echo ✅ RemoteProvider.exe - NSIS installer
echo ✅ dist/README.txt - Installation instructions
echo.
echo Distribution: Share the entire dist/ folder
echo Quick install: Run dist/install-service.bat as Administrator
echo ========================================

pause
