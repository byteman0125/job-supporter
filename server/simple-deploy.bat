@echo off
echo ========================================
echo Simple Deployment (No Build Tools)
echo ========================================

:: Create deployment folder
if not exist "deploy" mkdir deploy
if exist "deploy\*" del /q "deploy\*"

echo Copying files...
copy "*.js" "deploy\" >nul
copy "package.json" "deploy\" >nul

if exist "assets" (
    xcopy "assets" "deploy\assets\" /E /I /Y >nul
)

:: Create simple launcher
echo @echo off > "deploy\start.bat"
echo title Remote Provider Server >> "deploy\start.bat"
echo cd /d "%%~dp0" >> "deploy\start.bat"
echo if not exist "node_modules" npm install >> "deploy\start.bat"
echo node main-cli.js --background --silent >> "deploy\start.bat"

:: Create installer
echo @echo off > "deploy\install.bat"
echo echo Installing Remote Provider Server... >> "deploy\install.bat"
echo. >> "deploy\install.bat"
echo :: Install dependencies >> "deploy\install.bat"
echo if not exist "node_modules" ( >> "deploy\install.bat"
echo     echo Installing dependencies... >> "deploy\install.bat"
echo     npm install >> "deploy\install.bat"
echo ^) >> "deploy\install.bat"
echo. >> "deploy\install.bat"
echo :: Add to startup >> "deploy\install.bat"
echo echo Adding to startup... >> "deploy\install.bat"
echo reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RemoteProviderServer" /t REG_SZ /d "\"%%~dp0start.bat\"" /f >nul >> "deploy\install.bat"
echo. >> "deploy\install.bat"
echo :: Start the server >> "deploy\install.bat"
echo echo Starting server... >> "deploy\install.bat"
echo start "" /min "%%~dp0start.bat" >> "deploy\install.bat"
echo. >> "deploy\install.bat"
echo echo ✅ Installation completed! >> "deploy\install.bat"
echo echo The server will start automatically when you log in. >> "deploy\install.bat"
echo pause >> "deploy\install.bat"

:: Create README
echo Remote Provider Server - Simple Deployment > "deploy\README.txt"
echo ============================================== >> "deploy\README.txt"
echo. >> "deploy\README.txt"
echo This is a Node.js application that runs without building. >> "deploy\README.txt"
echo. >> "deploy\README.txt"
echo REQUIREMENTS: >> "deploy\README.txt"
echo - Node.js installed on the target system >> "deploy\README.txt"
echo. >> "deploy\README.txt"
echo INSTALLATION: >> "deploy\README.txt"
echo 1. Copy this entire folder to the target system >> "deploy\README.txt"
echo 2. Run install.bat >> "deploy\README.txt"
echo. >> "deploy\README.txt"
echo MANUAL START: >> "deploy\README.txt"
echo - Run start.bat >> "deploy\README.txt"
echo. >> "deploy\README.txt"
echo The application runs silently in the background. >> "deploy\README.txt"

echo.
echo ✅ Simple deployment created in 'deploy' folder!
echo.
echo Contents:
echo   - start.bat (Manual start)
echo   - install.bat (Auto-install and start)  
echo   - All source files
echo   - README.txt (Instructions)
echo.
echo Just copy the 'deploy' folder to any Windows system with Node.js!
echo.

pause
