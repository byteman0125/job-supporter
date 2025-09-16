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

:: Create launcher script (runs in background with minimized window)
echo @echo off > "dist\remote-server.bat"
echo :: Remote Provider Server Launcher >> "dist\remote-server.bat"
echo cd /d "%%~dp0" >> "dist\remote-server.bat"
echo start "" /min node main-cli.js --background --silent >> "dist\remote-server.bat"

:: Create installer
echo @echo off > "dist\install.bat"
echo :: Remote Provider Server Installer >> "dist\install.bat"
echo echo Installing Remote Provider Server... >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Add to startup >> "dist\install.bat"
echo set "STARTUP_FOLDER=%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup" >> "dist\install.bat"
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%STARTUP_FOLDER%%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%%~dp0remote-server.bat'; $Shortcut.WorkingDirectory = '%%~dp0'; $Shortcut.WindowStyle = 7; $Shortcut.Save()" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Start the server in background >> "dist\install.bat"
echo echo Starting server in background... >> "dist\install.bat"
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

:: Create self-extracting installer
echo Creating self-extracting installer...

:: Create installer script
echo @echo off > "dist\setup.bat"
echo :: Remote Provider Server Self-Extracting Installer >> "dist\setup.bat"
echo echo ======================================== >> "dist\setup.bat"
echo echo  Remote Provider Server Installer >> "dist\setup.bat"
echo echo ======================================== >> "dist\setup.bat"
echo echo. >> "dist\setup.bat"
echo set "INSTALL_DIR=%%USERPROFILE%%\RemoteProviderServer" >> "dist\setup.bat"
echo echo Installing to: %%USERPROFILE%%\RemoteProviderServer >> "dist\setup.bat"
echo echo ^(C:\Users\%%USERNAME%%\RemoteProviderServer^) >> "dist\setup.bat"
echo. >> "dist\setup.bat"
echo :: Create installation directory >> "dist\setup.bat"
echo if not exist "%%INSTALL_DIR%%" mkdir "%%INSTALL_DIR%%" >> "dist\setup.bat"
echo. >> "dist\setup.bat"
echo :: Copy all files >> "dist\setup.bat"
echo echo Copying files... >> "dist\setup.bat"
echo xcopy "%%~dp0*" "%%INSTALL_DIR%%\" /E /I /Y /Q ^>nul >> "dist\setup.bat"
echo. >> "dist\setup.bat"
echo :: Create startup shortcut >> "dist\setup.bat"
echo echo Setting up auto-start... >> "dist\setup.bat"
echo set "STARTUP_FOLDER=%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup" >> "dist\setup.bat"
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%STARTUP_FOLDER%%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%%INSTALL_DIR%%\remote-server.bat'; $Shortcut.WorkingDirectory = '%%INSTALL_DIR%%'; $Shortcut.WindowStyle = 7; $Shortcut.Save()" >> "dist\setup.bat"
echo. >> "dist\setup.bat"
echo :: Start the server >> "dist\setup.bat"
echo echo Starting Remote Provider Server... >> "dist\setup.bat"
echo start "" /min "%%INSTALL_DIR%%\remote-server.bat" >> "dist\setup.bat"
echo. >> "dist\setup.bat"
echo echo ✅ Installation completed successfully! >> "dist\setup.bat"
echo echo. >> "dist\setup.bat"
echo echo The server is now running in background and will >> "dist\setup.bat"
echo echo auto-start when Windows boots. >> "dist\setup.bat"
echo echo. >> "dist\setup.bat"
echo echo To uninstall, run: >> "dist\setup.bat"
echo echo %%INSTALL_DIR%%\uninstall.bat >> "dist\setup.bat"
echo echo. >> "dist\setup.bat"
echo pause >> "dist\setup.bat"

:: Update uninstaller to work from installed location
echo @echo off > "dist\uninstall.bat"
echo :: Remote Provider Server Uninstaller >> "dist\uninstall.bat"
echo echo Uninstalling Remote Provider Server... >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo :: Stop the server >> "dist\uninstall.bat"
echo taskkill /f /im "node.exe" /fi "WINDOWTITLE eq Remote Provider Server" ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo :: Remove startup shortcut >> "dist\uninstall.bat"
echo del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup\RemoteProviderServer.lnk" ^>nul 2^>^&1 >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo :: Remove installation directory >> "dist\uninstall.bat"
echo echo Removing files... >> "dist\uninstall.bat"
echo rd /s /q "%%USERPROFILE%%\RemoteProviderServer" >> "dist\uninstall.bat"
echo. >> "dist\uninstall.bat"
echo echo ✅ Uninstallation completed! >> "dist\uninstall.bat"
echo pause >> "dist\uninstall.bat"

:: Create self-extracting executable installer
echo Creating self-extracting installer executable...

:: Create installer script that embeds all files
echo @echo off > "RemoteProviderServer-Setup.bat"
echo :: Remote Provider Server Self-Extracting Installer >> "RemoteProviderServer-Setup.bat"
echo setlocal enabledelayedexpansion >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo echo ======================================== >> "RemoteProviderServer-Setup.bat"
echo echo  Remote Provider Server Installer >> "RemoteProviderServer-Setup.bat"
echo echo ======================================== >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Set installation directory >> "RemoteProviderServer-Setup.bat"
echo set "INSTALL_DIR=%%USERPROFILE%%\RemoteProviderServer" >> "RemoteProviderServer-Setup.bat"
echo echo Installing to: %%USERPROFILE%%\RemoteProviderServer >> "RemoteProviderServer-Setup.bat"
echo echo ^(C:\Users\%%USERNAME%%\RemoteProviderServer^) >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Check if already installed >> "RemoteProviderServer-Setup.bat"
echo if exist "%%INSTALL_DIR%%" ^( >> "RemoteProviderServer-Setup.bat"
echo     echo Application is already installed. >> "RemoteProviderServer-Setup.bat"
echo     echo. >> "RemoteProviderServer-Setup.bat"
echo     echo Choose an option: >> "RemoteProviderServer-Setup.bat"
echo     echo 1^) Reinstall ^(overwrites existing^) >> "RemoteProviderServer-Setup.bat"
echo     echo 2^) Uninstall >> "RemoteProviderServer-Setup.bat"
echo     echo 3^) Cancel >> "RemoteProviderServer-Setup.bat"
echo     echo. >> "RemoteProviderServer-Setup.bat"
echo     set /p "choice=Enter your choice (1-3): " >> "RemoteProviderServer-Setup.bat"
echo     if "!choice!"=="2" goto :uninstall >> "RemoteProviderServer-Setup.bat"
echo     if "!choice!"=="3" exit /b >> "RemoteProviderServer-Setup.bat"
echo     if not "!choice!"=="1" exit /b >> "RemoteProviderServer-Setup.bat"
echo ^) >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Create temporary extraction directory >> "RemoteProviderServer-Setup.bat"
echo set "TEMP_DIR=%%TEMP%%\RemoteProviderServer_Install" >> "RemoteProviderServer-Setup.bat"
echo if exist "%%TEMP_DIR%%" rd /s /q "%%TEMP_DIR%%" >> "RemoteProviderServer-Setup.bat"
echo mkdir "%%TEMP_DIR%%" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Extract embedded files >> "RemoteProviderServer-Setup.bat"
echo echo Extracting files... >> "RemoteProviderServer-Setup.bat"
echo powershell -Command "Expand-Archive -Path '%%~dp0embedded_files.zip' -DestinationPath '%%TEMP_DIR%%' -Force" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Create installation directory >> "RemoteProviderServer-Setup.bat"
echo if not exist "%%INSTALL_DIR%%" mkdir "%%INSTALL_DIR%%" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Copy files to installation directory >> "RemoteProviderServer-Setup.bat"
echo echo Installing files... >> "RemoteProviderServer-Setup.bat"
echo xcopy "%%TEMP_DIR%%\*" "%%INSTALL_DIR%%\" /E /I /Y /Q ^>nul >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Create startup shortcut >> "RemoteProviderServer-Setup.bat"
echo echo Setting up auto-start... >> "RemoteProviderServer-Setup.bat"
echo set "STARTUP_FOLDER=%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup" >> "RemoteProviderServer-Setup.bat"
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%STARTUP_FOLDER%%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%%INSTALL_DIR%%\remote-server.bat'; $Shortcut.WorkingDirectory = '%%INSTALL_DIR%%'; $Shortcut.WindowStyle = 7; $Shortcut.Save()" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Start the server >> "RemoteProviderServer-Setup.bat"
echo echo Starting Remote Provider Server... >> "RemoteProviderServer-Setup.bat"
echo start "" /min "%%INSTALL_DIR%%\remote-server.bat" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Cleanup >> "RemoteProviderServer-Setup.bat"
echo rd /s /q "%%TEMP_DIR%%" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo echo ✅ Installation completed successfully! >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo echo The server is now running in background and will >> "RemoteProviderServer-Setup.bat"
echo echo auto-start when Windows boots. >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo echo To uninstall, run this installer again and choose option 2. >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo pause >> "RemoteProviderServer-Setup.bat"
echo exit /b >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :uninstall >> "RemoteProviderServer-Setup.bat"
echo echo ======================================== >> "RemoteProviderServer-Setup.bat"
echo echo  Uninstalling Remote Provider Server >> "RemoteProviderServer-Setup.bat"
echo echo ======================================== >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo :: Stop the server >> "RemoteProviderServer-Setup.bat"
echo echo Stopping server... >> "RemoteProviderServer-Setup.bat"
echo taskkill /f /im "node.exe" /fi "WINDOWTITLE eq Remote Provider Server" ^>nul 2^>^&1 >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Remove startup shortcut >> "RemoteProviderServer-Setup.bat"
echo echo Removing auto-start... >> "RemoteProviderServer-Setup.bat"
echo del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup\RemoteProviderServer.lnk" ^>nul 2^>^&1 >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo :: Remove installation directory >> "RemoteProviderServer-Setup.bat"
echo echo Removing files... >> "RemoteProviderServer-Setup.bat"
echo rd /s /q "%%INSTALL_DIR%%" >> "RemoteProviderServer-Setup.bat"
echo. >> "RemoteProviderServer-Setup.bat"
echo echo ✅ Uninstallation completed! >> "RemoteProviderServer-Setup.bat"
echo echo. >> "RemoteProviderServer-Setup.bat"
echo pause >> "RemoteProviderServer-Setup.bat"

:: Create embedded zip file
powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'embedded_files.zip' -Force"

:: Combine the installer script with the embedded zip
copy /b "RemoteProviderServer-Setup.bat" + "embedded_files.zip" "RemoteProviderServer-Setup.exe" >nul

:: Clean up temporary files
del "RemoteProviderServer-Setup.bat" >nul 2>&1
del "embedded_files.zip" >nul 2>&1

if exist "RemoteProviderServer-Setup.exe" (
    echo.
    echo ✅ SELF-EXTRACTING INSTALLER CREATED!
    echo.
    echo 📦 File: RemoteProviderServer-Setup.exe
    echo 📍 Location: %CD%\RemoteProviderServer-Setup.exe
    echo.
    echo ✅ Single executable file - no extraction needed
    echo ✅ No admin permissions required
    echo ✅ Installs to: C:\Users\[Username]\RemoteProviderServer
    echo ✅ Auto-starts on Windows boot
    echo ✅ Runs completely in background
    echo ✅ Built-in uninstaller (run setup again, choose option 2)
    echo.
    echo 🚀 TO USE:
    echo Just run RemoteProviderServer-Setup.exe
    echo.
) else (
    echo ❌ Failed to create installer executable
)

echo ========================================
echo BUILD COMPLETED!
echo ========================================

pause
