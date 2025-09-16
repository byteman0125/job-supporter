@echo off
echo ========================================
echo Remote Provider Server - Build and Setup Creator
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

:: Build the executable
echo ========================================
echo STEP 1: Building Server Executable
echo ========================================
echo Running: pkg main-cli.js --targets node18-win-x64 --output dist/svchost.exe
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

:: Copy additional files
if exist "ffmpeg-windows.js" copy "ffmpeg-windows.js" "dist\" >nul
if exist "ffmpeg-capture.js" copy "ffmpeg-capture.js" "dist\" >nul
if exist "server-id.txt" copy "server-id.txt" "dist\" >nul

echo ========================================
echo STEP 2: Creating Setup Installer
echo ========================================

:: Create the installer script inside dist folder
echo Creating installer script...
echo @echo off > "dist\install.bat"
echo :: Remote Provider Server Auto-Installer >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo Remote Provider Server Installation >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo :: Check for admin privileges >> "dist\install.bat"
echo net session ^>nul 2^>^&1 >> "dist\install.bat"
echo if %%errorLevel%% neq 0 ^( >> "dist\install.bat"
echo     echo ERROR: Administrator privileges required! >> "dist\install.bat"
echo     echo Please right-click and select "Run as administrator" >> "dist\install.bat"
echo     pause >> "dist\install.bat"
echo     exit /b 1 >> "dist\install.bat"
echo ^) >> "dist\install.bat"
echo. >> "dist\install.bat"
echo set SERVICE_DIR=%%~dp0 >> "dist\install.bat"
echo set SERVICE_NAME=RemoteProviderServer >> "dist\install.bat"
echo set SERVICE_DISPLAY_NAME=Remote Provider Server >> "dist\install.bat"
echo set EXECUTABLE_PATH=%%SERVICE_DIR%%svchost.exe >> "dist\install.bat"
echo. >> "dist\install.bat"
echo echo Installing service from: %%SERVICE_DIR%% >> "dist\install.bat"
echo echo Executable: %%EXECUTABLE_PATH%% >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Stop existing service >> "dist\install.bat"
echo sc query "%%SERVICE_NAME%%" ^>nul 2^>^&1 >> "dist\install.bat"
echo if %%errorlevel%% equ 0 ^( >> "dist\install.bat"
echo     echo Stopping existing service... >> "dist\install.bat"
echo     sc stop "%%SERVICE_NAME%%" ^>nul 2^>^&1 >> "dist\install.bat"
echo     timeout /t 3 ^>nul >> "dist\install.bat"
echo     sc delete "%%SERVICE_NAME%%" ^>nul 2^>^&1 >> "dist\install.bat"
echo     timeout /t 2 ^>nul >> "dist\install.bat"
echo ^) >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Create service >> "dist\install.bat"
echo echo Creating Windows service... >> "dist\install.bat"
echo sc create "%%SERVICE_NAME%%" binPath= "\"%%EXECUTABLE_PATH%%\"" DisplayName= "%%SERVICE_DISPLAY_NAME%%" start= auto >> "dist\install.bat"
echo sc description "%%SERVICE_NAME%%" "Remote Provider Server - Auto-start service" >> "dist\install.bat"
echo sc failure "%%SERVICE_NAME%%" reset= 86400 actions= restart/5000/restart/10000/restart/30000 >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Start service >> "dist\install.bat"
echo echo Starting service... >> "dist\install.bat"
echo sc start "%%SERVICE_NAME%%" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Add firewall rule >> "dist\install.bat"
echo netsh advfirewall firewall add rule name="Remote Provider Server" dir=in action=allow program="%%EXECUTABLE_PATH%%" enable=yes ^>nul 2^>^&1 >> "dist\install.bat"
echo. >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo INSTALLATION COMPLETED! >> "dist\install.bat"
echo echo Service will auto-start on system boot >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo pause >> "dist\install.bat"

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
echo netsh advfirewall firewall delete rule name="Remote Provider Server" ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo echo Service uninstalled! >> "dist\uninstall.bat"
echo pause >> "dist\uninstall.bat"

:: Check if we have makensis (NSIS) to create a proper installer EXE
echo Checking for NSIS installer...
makensis /VERSION >nul 2>&1
if errorlevel 1 (
    echo NSIS not found - creating self-extracting archive instead...
    goto :create_sfx
) else (
    echo NSIS found - creating proper installer...
    goto :create_nsis
)

:create_nsis
:: Create NSIS script
echo Creating NSIS installer script...
echo ; Remote Provider Server Installer > "installer.nsi"
echo !define PRODUCT_NAME "Remote Provider Server" >> "installer.nsi"
echo !define PRODUCT_VERSION "1.0.0" >> "installer.nsi"
echo !define PRODUCT_PUBLISHER "Remote Provider" >> "installer.nsi"
echo. >> "installer.nsi"
echo SetCompressor lzma >> "installer.nsi"
echo InstallDir "$PROGRAMFILES\Remote Provider Server" >> "installer.nsi"
echo. >> "installer.nsi"
echo Page directory >> "installer.nsi"
echo Page instfiles >> "installer.nsi"
echo. >> "installer.nsi"
echo Section "MainSection" SEC01 >> "installer.nsi"
echo   SetOutPath "$INSTDIR" >> "installer.nsi"
echo   File /r "dist\*.*" >> "installer.nsi"
echo   ExecWait '"$INSTDIR\install.bat"' >> "installer.nsi"
echo   CreateShortCut "$DESKTOP\Uninstall Remote Provider.lnk" "$INSTDIR\uninstall.bat" >> "installer.nsi"
echo SectionEnd >> "installer.nsi"

makensis installer.nsi
if errorlevel 1 (
    echo NSIS compilation failed, falling back to SFX...
    goto :create_sfx
) else (
    echo NSIS installer created successfully!
    goto :finish
)

:create_sfx
:: Create self-extracting archive using Windows built-in tools
echo Creating self-extracting installer...

:: Create extraction script
echo @echo off > "extract_and_install.bat"
echo echo Extracting Remote Provider Server... >> "extract_and_install.bat"
echo if not exist "%%TEMP%%\RemoteProviderInstall" mkdir "%%TEMP%%\RemoteProviderInstall" >> "extract_and_install.bat"
echo cd /d "%%TEMP%%\RemoteProviderInstall" >> "extract_and_install.bat"
echo echo Please wait while files are extracted... >> "extract_and_install.bat"
echo timeout /t 2 ^>nul >> "extract_and_install.bat"
echo call install.bat >> "extract_and_install.bat"

:: Check for WinRAR or 7-Zip to create SFX
where winrar >nul 2>&1
if not errorlevel 1 (
    echo Creating WinRAR SFX...
    winrar a -sfx -z"extract_and_install.bat" "RemoteProviderServer-Setup.exe" "dist\*"
    goto :finish
)

where 7z >nul 2>&1
if not errorlevel 1 (
    echo Creating 7-Zip SFX...
    7z a -sfx "RemoteProviderServer-Setup.exe" "dist\*"
    goto :finish
)

echo No SFX creator found - distribution folder ready in dist\
echo Users can run dist\install.bat as administrator to install

:finish
:: Clean up
if exist "installer.nsi" del "installer.nsi"
if exist "extract_and_install.bat" del "extract_and_install.bat"

echo.
echo ========================================
echo BUILD AND SETUP CREATION COMPLETED!
echo ========================================
echo.
echo Server executable: dist\svchost.exe
echo Installation script: dist\install.bat
echo Uninstall script: dist\uninstall.bat
echo.
if exist "RemoteProviderServer-Setup.exe" (
    echo ✓ Setup installer: RemoteProviderServer-Setup.exe
    echo   ^(Users can run this to auto-install the service^)
) else (
    echo ✓ Distribution folder: dist\
    echo   ^(Users should run dist\install.bat as administrator^)
)
echo.
echo The service will:
echo - Auto-start when Windows boots
echo - Restart automatically if it crashes
echo - Run in background even when no user logged in
echo ========================================

pause
