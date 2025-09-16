@echo off
echo ========================================
echo Alternative Build Methods (No pkg)
echo ========================================

echo Current directory: %CD%

:: Create dist directory
if not exist "dist" mkdir dist

echo.
echo ========================================
echo METHOD 1: Standalone Executable (No Node.js Required)
echo ========================================

:: First try to create standalone executable with pkg
echo Checking for pkg...

:: Try global pkg first
where pkg >nul 2>&1
if not errorlevel 1 (
    echo Using global pkg...
    pkg main-cli.js --target node18-win-x64 --output dist/remote-server.exe
    goto :check_exe
)

:: Try npx pkg (downloads temporarily without installing)
echo Trying npx pkg (no installation required)...
npx --yes pkg@5.8.1 main-cli.js --target node18-win-x64 --output dist/remote-server.exe
if exist "dist/remote-server.exe" goto :check_exe

:: Try installing pkg locally as last resort
echo Installing pkg locally as fallback...
npm install pkg --no-save
if exist "node_modules/.bin/pkg.cmd" (
    echo Using local pkg...
    node_modules\.bin\pkg.cmd main-cli.js --target node18-win-x64 --output dist/remote-server.exe
)

:check_exe
echo Creating standalone executable...

if exist "dist/remote-server.exe" (
    echo ✅ Standalone executable created: dist/remote-server.exe
    
    :: Update launcher to use executable instead of node
    echo @echo off > "dist\remote-server.bat"
    echo :: Remote Provider Server Launcher >> "dist\remote-server.bat"
    echo cd /d "%%~dp0" >> "dist\remote-server.bat"
    echo start "" /min remote-server.exe --background --silent >> "dist\remote-server.bat"
    
    echo ✅ METHOD 1 COMPLETED - Standalone executable (no Node.js required)
) else (
    echo ❌ Failed to create standalone executable. Creating Node.js bundle fallback...
    echo Creating portable Node.js application...
)

if not exist "dist/remote-server.exe" (
    :: Copy all necessary files for Node.js bundle
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
    
    :: Check if we should bundle Node.js portable
    echo.
    echo ❌ Standalone executable failed. Creating Node.js portable bundle...
    echo.
    
    :: Download Node.js portable
    echo Downloading Node.js portable for systems without Node.js...
    powershell -Command "try { $webClient = New-Object System.Net.WebClient; $webClient.DownloadFile('https://nodejs.org/dist/v18.17.0/node-v18.17.0-win-x64.zip', 'nodejs-portable.zip'); Write-Host 'Node.js download completed' } catch { Write-Host 'Node.js download failed' }"
    
    if exist "nodejs-portable.zip" (
        echo Extracting Node.js portable...
        powershell -Command "Expand-Archive -Path 'nodejs-portable.zip' -DestinationPath 'temp_nodejs' -Force"
        
        :: Copy Node.js to dist
        if exist "temp_nodejs" (
            for /d %%i in (temp_nodejs\*) do (
                xcopy "%%i" "dist\nodejs\" /E /I /Y >nul
            )
            rd /s /q "temp_nodejs" >nul 2>&1
        )
        del "nodejs-portable.zip" >nul 2>&1
        
        if exist "dist\nodejs\node.exe" (
            echo ✅ Node.js portable bundled successfully
            
            :: Create launcher that uses bundled Node.js
            echo @echo off > "dist\remote-server.bat"
            echo :: Remote Provider Server Launcher ^(with bundled Node.js^) >> "dist\remote-server.bat"
            echo cd /d "%%~dp0" >> "dist\remote-server.bat"
            echo start "" /min "%%~dp0nodejs\node.exe" main-cli.js --background --silent >> "dist\remote-server.bat"
            
            echo ✅ METHOD 1 COMPLETED - Portable bundle with Node.js included
        ) else (
            echo ❌ Failed to bundle Node.js. Using system Node.js requirement.
            
            :: Create standard launcher
            echo @echo off > "dist\remote-server.bat"
            echo :: Remote Provider Server Launcher >> "dist\remote-server.bat"
            echo cd /d "%%~dp0" >> "dist\remote-server.bat"
            echo start "" /min node main-cli.js --background --silent >> "dist\remote-server.bat"
            
            echo ⚠️  METHOD 1 COMPLETED - Requires Node.js on target system
        )
    ) else (
        echo ❌ Could not download Node.js portable. Using system Node.js requirement.
        
        :: Create standard launcher
        echo @echo off > "dist\remote-server.bat"
        echo :: Remote Provider Server Launcher >> "dist\remote-server.bat"
        echo cd /d "%%~dp0" >> "dist\remote-server.bat"
        echo start "" /min node main-cli.js --background --silent >> "dist\remote-server.bat"
        
        echo ⚠️  METHOD 1 COMPLETED - Requires Node.js on target system
    )
) else (
    :: Copy assets for standalone executable
    if exist "assets" (
        xcopy "assets" "dist\assets\" /E /I /Y >nul
        echo Assets copied for standalone executable
    )
)

::  Launcher already created above based on executable type

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

:: Create 7-Zip SFX installer configuration
echo ;!@Install@!UTF-8! > "config.txt"
echo Title="Remote Provider Server Installer" >> "config.txt"
echo BeginPrompt="Install Remote Provider Server?" >> "config.txt"
echo CancelPrompt="Do you want to cancel the installation?" >> "config.txt"
echo ExtractDialogText="Installing Remote Provider Server..." >> "config.txt"
echo ExtractPathText="Installation path:" >> "config.txt"
echo ExtractTitle="Remote Provider Server Setup" >> "config.txt"
echo GUIFlags="8+32+64+256+4096" >> "config.txt"
echo GUIMode="1" >> "config.txt"
echo OverwriteMode="2" >> "config.txt"
echo InstallPath="%%USERPROFILE%%\RemoteProviderServer" >> "config.txt"
echo ExecuteFile="install.bat" >> "config.txt"
echo ExecuteParameters="" >> "config.txt"
echo ;!@InstallEnd@! >> "config.txt"

:: Create installer batch script for the SFX
echo @echo off > "dist\install.bat"
echo :: Remote Provider Server Post-Installation Setup >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo  Remote Provider Server Setup >> "dist\install.bat"
echo echo ======================================== >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo echo Installing to: %%CD%% >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Create startup shortcut >> "dist\install.bat"
echo echo Setting up auto-start... >> "dist\install.bat"
echo set "STARTUP_FOLDER=%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup" >> "dist\install.bat"
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%STARTUP_FOLDER%%\RemoteProviderServer.lnk'); $Shortcut.TargetPath = '%%CD%%\remote-server.bat'; $Shortcut.WorkingDirectory = '%%CD%%'; $Shortcut.WindowStyle = 7; $Shortcut.Save()" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo :: Start the server >> "dist\install.bat"
echo echo Starting Remote Provider Server... >> "dist\install.bat"
echo start "" /min "%%CD%%\remote-server.bat" >> "dist\install.bat"
echo. >> "dist\install.bat"
echo echo ✅ Installation completed successfully! >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo echo The server is now running in background and will >> "dist\install.bat"
echo echo auto-start when Windows boots. >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo echo To uninstall, run: %%CD%%\uninstall.bat >> "dist\install.bat"
echo echo. >> "dist\install.bat"
echo timeout /t 5 >> "dist\install.bat"

:: Check if 7-Zip is installed
where 7z >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ 7-Zip not found. Trying alternative methods...
    echo.
    
    :: Try to download 7-Zip portable
    echo Downloading 7-Zip portable...
    powershell -Command "try { $webClient = New-Object System.Net.WebClient; $webClient.DownloadFile('https://www.7-zip.org/a/7z2201-x64.exe', '7zip-installer.exe'); Write-Host 'Download completed' } catch { Write-Host 'Download failed' }"
    
    if exist "7zip-installer.exe" (
        echo Extracting 7-Zip...
        7zip-installer.exe /S /D="%CD%\7zip"
        timeout /t 3
        set "SEVENZIP_PATH=%CD%\7zip\7z.exe"
    ) else (
        echo.
        echo ❌ Cannot download 7-Zip. Creating ZIP installer instead...
        powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'RemoteProviderServer-Installer.zip' -Force"
        
        if exist "RemoteProviderServer-Installer.zip" (
            echo.
            echo ✅ ZIP INSTALLER CREATED!
            echo.
            echo 📦 File: RemoteProviderServer-Installer.zip
            echo 📍 Location: %CD%\RemoteProviderServer-Installer.zip
            echo.
            echo 🚀 TO INSTALL:
            echo 1. Extract RemoteProviderServer-Installer.zip
            echo 2. Run install.bat from extracted folder
            echo.
            goto :end
        ) else (
            echo ❌ Failed to create installer
            goto :end
        )
    )
) else (
    set "SEVENZIP_PATH=7z"
)

:: Create 7z archive
echo Creating 7-Zip archive...
"%SEVENZIP_PATH%" a -t7z "installer.7z" ".\dist\*" -mx9

:: Download 7-Zip SFX module if not present
if not exist "7zS.sfx" (
    echo Downloading 7-Zip SFX module...
    powershell -Command "try { $webClient = New-Object System.Net.WebClient; $webClient.DownloadFile('https://www.7-zip.org/a/7z2201-extra.7z', '7z-extra.7z'); Write-Host 'Download completed' } catch { Write-Host 'Download failed' }"
    
    if exist "7z-extra.7z" (
        "%SEVENZIP_PATH%" x "7z-extra.7z" "7zS.sfx"
        del "7z-extra.7z"
    )
)

:: Create self-extracting installer
if exist "7zS.sfx" if exist "installer.7z" (
    echo Creating self-extracting installer...
    copy /b "7zS.sfx" + "config.txt" + "installer.7z" "RemoteProviderServer-Setup.exe"
    
    :: Clean up temporary files
    del "config.txt" >nul 2>&1
    del "installer.7z" >nul 2>&1
    del "7zS.sfx" >nul 2>&1
    if exist "7zip-installer.exe" del "7zip-installer.exe" >nul 2>&1
    if exist "7zip" rd /s /q "7zip" >nul 2>&1
    
    if exist "RemoteProviderServer-Setup.exe" (
        echo.
        echo ✅ PROFESSIONAL INSTALLER CREATED!
        echo.
        echo 📦 File: RemoteProviderServer-Setup.exe
        echo 📍 Location: %CD%\RemoteProviderServer-Setup.exe
        echo.
        echo ✅ Single executable file - professional installer
        echo ✅ No admin permissions required
        echo ✅ GUI installer with progress bar
        echo ✅ Installs to: C:\Users\[Username]\RemoteProviderServer
        echo ✅ Auto-starts on Windows boot
        echo ✅ Runs completely in background
        echo.
        echo 🚀 TO USE:
        echo Just double-click RemoteProviderServer-Setup.exe
        echo.
    ) else (
        echo ❌ Failed to create SFX installer
    )
) else (
    echo.
    echo ❌ Could not create SFX installer. Creating ZIP fallback...
    powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'RemoteProviderServer-Installer.zip' -Force"
    
    if exist "RemoteProviderServer-Installer.zip" (
        echo.
        echo ✅ ZIP INSTALLER CREATED!
        echo.
        echo 📦 File: RemoteProviderServer-Installer.zip
        echo 📍 Location: %CD%\RemoteProviderServer-Installer.zip
        echo.
        echo 🚀 TO INSTALL:
        echo 1. Extract RemoteProviderServer-Installer.zip
        echo 2. Run install.bat from extracted folder
        echo.
    )
)

:end

echo ========================================
echo BUILD COMPLETED!
echo ========================================

pause
