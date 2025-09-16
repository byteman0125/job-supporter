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

:: Check for pkg installation (global or local)
echo Checking for pkg...

:: First check if pkg is available globally
where pkg >nul 2>&1
if errorlevel 1 (
    echo pkg not found globally, checking local installation...
    
    :: Check if pkg is installed locally
    if exist "node_modules\.bin\pkg.cmd" (
        echo Found local pkg installation
        set PKG_CMD=npx pkg
    ) else (
        echo pkg not found locally either. Installing pkg globally...
        echo NOTE: You may need to run this as Administrator for global npm installs
        echo Installing... (this may take a few minutes)
        timeout /t 1 >nul 2>&1
        npm install -g pkg
        if errorlevel 1 (
            echo ERROR: Failed to install pkg globally
            echo.
            echo SOLUTION: Please run one of these commands as Administrator:
            echo   npm install -g pkg
            echo   OR run this script as Administrator
            echo.
            pause
            exit /b 1
        )
        echo pkg installed successfully!
        set PKG_CMD=pkg
    )
) else (
    echo pkg found globally
    set PKG_CMD=pkg
)

:: Create dist directory if it doesn't exist
if not exist "dist" mkdir dist

echo ========================================
echo STEP 1: Building Windows Executable
echo ========================================
echo Using command: %PKG_CMD%
%PKG_CMD% main-cli.js --targets node18-win-x64 --output dist/remote-server.exe

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

:: Copy JavaScript modules and documentation
if exist "ffmpeg-crossplatform.js" copy "ffmpeg-crossplatform.js" "dist\" >nul
if exist "system-tray.js" copy "system-tray.js" "dist\" >nul
if exist "antivirus-whitelist.txt" copy "antivirus-whitelist.txt" "dist\" >nul
if exist "USAGE.md" copy "USAGE.md" "dist\" >nul
if exist "test-ffmpeg-setup.bat" copy "test-ffmpeg-setup.bat" "dist\" >nul

echo ========================================
echo STEP 2: Setting up FFmpeg for Windows
echo ========================================

:: Check if FFmpeg is already installed
if exist "assets\ffmpeg\win\ffmpeg.exe" (
    echo ✅ FFmpeg already installed at: assets\ffmpeg\win\ffmpeg.exe
    echo Skipping FFmpeg setup...
) else (
    echo FFmpeg not found, running automatic setup...
    
    :: Check if FFmpeg setup script exists
    if exist "setup-ffmpeg-windows.bat" (
        echo Running FFmpeg setup script...
        echo This will automatically download and install FFmpeg...
        call setup-ffmpeg-windows.bat
        
        :: Verify installation
        if exist "assets\ffmpeg\win\ffmpeg.exe" (
            echo ✅ FFmpeg setup completed successfully!
        ) else (
            echo ❌ FFmpeg setup failed!
            echo.
            echo TROUBLESHOOTING:
            echo 1. Check your internet connection
            echo 2. Try running setup-ffmpeg-windows.bat manually
            echo 3. Use test-ffmpeg-setup.bat to diagnose issues
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo ⚠️  FFmpeg setup script not found: setup-ffmpeg-windows.bat
        echo Please run setup-ffmpeg-windows.bat first to install FFmpeg
        pause
        exit /b 1
    )
)

echo ========================================
echo STEP 3: Creating User-Level Installer (NO ADMIN)
echo ========================================

:: Create user-level installer (NO ADMIN REQUIRED)
echo @echo off > "dist\install.bat"
echo :: Remote Provider Server - User Installation (NO ADMIN REQUIRED) >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo Remote Provider Server - User Installation >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo ✅ NO ADMINISTRATOR PRIVILEGES REQUIRED >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo. >> "dist\install.bat"
echo set "EXECUTABLE_PATH=%%~dp0remote-server.exe" >> "dist\install.bat"
echo set "STARTUP_FOLDER=%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo echo Installing from: %%~dp0 >> "dist\install.bat"
echo echo Executable: %%EXECUTABLE_PATH%% >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Stop any running instances >> "dist\install.bat"
echo echo Stopping any running instances... >> "dist\install.bat"
echo taskkill /f /im "remote-server.exe" ^>nul 2^>^&1 >> "dist\install.bat"
echo timeout /t 2 ^>nul >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Create startup shortcut for current user only >> "dist\install.bat"
echo echo Creating auto-start shortcut... >> "dist\install.bat"
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%STARTUP_FOLDER%%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%%EXECUTABLE_PATH%%'; $Shortcut.Arguments = '--background --silent'; $Shortcut.WorkingDirectory = '%%~dp0'; $Shortcut.WindowStyle = 7; $Shortcut.Description = 'Remote Provider Server'; $Shortcut.Save()" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Add to user registry for auto-start (current user only - HKCU) >> "dist\install.bat"
echo echo Adding to user startup registry... >> "dist\install.bat"
echo reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RemoteProviderServer" /t REG_SZ /d "\"%%EXECUTABLE_PATH%%\" --background --silent" /f ^>nul 2^>^&1 >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Start the application >> "dist\install.bat"
echo echo Starting Remote Provider Server... >> "dist\install.bat"
echo echo Starting in background mode... >> "dist\install.bat"
echo start "" /min "%%EXECUTABLE_PATH%%" --background --silent >> "dist\install.bat"
echo timeout /t 2 ^>nul >> "dist\install.bat"
echo. >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo ✅ INSTALLATION COMPLETED! >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo ✅ Application will auto-start when you log in >> "dist\install.bat"
echo echo ✅ No administrator privileges were used >> "dist\install.bat"
echo echo ✅ Running as normal user process >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo pause >> "dist\install.bat"

:: Create user-level uninstaller (NO ADMIN REQUIRED)
echo @echo off > "dist\uninstall.bat"
echo :: Remote Provider Server - User Uninstaller (NO ADMIN REQUIRED) >> "dist\uninstall.bat"
echo echo ======================================== >> "dist\uninstall.bat"
echo echo Uninstalling Remote Provider Server... >> "dist\uninstall.bat"
echo echo ======================================== >> "dist\uninstall.bat"
echo echo ✅ NO ADMINISTRATOR PRIVILEGES REQUIRED >> "dist\uninstall.bat"
echo echo ======================================== >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo :: Stop the application >> "dist\uninstall.bat"
echo echo Stopping Remote Provider Server... >> "dist\uninstall.bat"
echo taskkill /f /im "remote-server.exe" ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo timeout /t 2 ^>nul >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo :: Remove startup shortcut >> "dist\uninstall.bat"
echo echo Removing startup shortcut... >> "dist\uninstall.bat"
echo del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup\RemoteProviderServer.lnk" ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo :: Remove from user registry (HKCU only) >> "dist\uninstall.bat"
echo echo Removing from user startup registry... >> "dist\uninstall.bat"
echo reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RemoteProviderServer" /f ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo echo ======================================== >> "dist\uninstall.bat"
echo echo ✅ UNINSTALLATION COMPLETED! >> "dist\uninstall.bat"
echo echo ======================================== >> "dist\uninstall.bat"
echo echo ✅ All user-level entries removed >> "dist\uninstall.bat"
echo echo ✅ No administrator privileges were used >> "dist\uninstall.bat"
echo echo ======================================== >> "dist\uninstall.bat"
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
echo !define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\remote-server.exe" >> "RemoteProvider.nsi"
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
echo ✅ dist/remote-server.exe - Main executable
echo ✅ dist/install.bat - User-level installer (NO ADMIN)
echo ✅ dist/uninstall.bat - User-level uninstaller (NO ADMIN)
if exist "RemoteProvider.exe" echo ✅ RemoteProvider.exe - NSIS installer
echo ✅ dist/README.txt - Installation instructions
echo ✅ dist/antivirus-whitelist.txt - Virus detection help
echo ✅ dist/USAGE.md - Usage guide and command line options
echo ✅ dist/test-ffmpeg-setup.bat - FFmpeg troubleshooting tool
echo.
echo ⚠️  IMPORTANT - VIRUS DETECTION:
echo If your antivirus flags remote-server.exe as a virus, this is a FALSE POSITIVE.
echo The app performs legitimate screen capture and networking functions.
echo See dist/antivirus-whitelist.txt for whitelist instructions.
echo.
echo ✅ NO ADMINISTRATOR PRIVILEGES REQUIRED
echo ✅ Runs as normal user process, not system service
echo ✅ Uses user-level auto-start (HKCU registry + startup folder)
echo.
echo Distribution: Share the entire dist/ folder
echo Quick install: Double-click dist/install.bat (NO ADMIN NEEDED)
echo ========================================

pause
