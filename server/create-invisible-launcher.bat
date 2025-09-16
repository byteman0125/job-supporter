@echo off
echo ========================================
echo Creating Invisible Launcher
echo ========================================

:: Create invisible VBS launcher
echo Set WshShell = CreateObject("WScript.Shell") > "dist\remote-server-invisible.vbs"
echo WshShell.Run "node main-cli.js --background --silent", 0, False >> "dist\remote-server-invisible.vbs"

:: Create PowerShell invisible launcher
echo # Invisible PowerShell Launcher > "dist\remote-server-invisible.ps1"
echo $processInfo = New-Object System.Diagnostics.ProcessStartInfo >> "dist\remote-server-invisible.ps1"
echo $processInfo.FileName = "node" >> "dist\remote-server-invisible.ps1"
echo $processInfo.Arguments = "main-cli.js --background --silent" >> "dist\remote-server-invisible.ps1"
echo $processInfo.WorkingDirectory = $PSScriptRoot >> "dist\remote-server-invisible.ps1"
echo $processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden >> "dist\remote-server-invisible.ps1"
echo $processInfo.CreateNoWindow = $true >> "dist\remote-server-invisible.ps1"
echo $processInfo.UseShellExecute = $false >> "dist\remote-server-invisible.ps1"
echo [System.Diagnostics.Process]::Start($processInfo) ^| Out-Null >> "dist\remote-server-invisible.ps1"

:: Create batch launcher that calls VBS (completely invisible)
echo @echo off > "dist\start-invisible.bat"
echo cd /d "%%~dp0" >> "dist\start-invisible.bat"
echo "%%~dp0remote-server-invisible.vbs" >> "dist\start-invisible.bat"

:: Update the main remote-server.bat to use invisible method
echo @echo off > "dist\remote-server.bat"
echo :: Invisible Remote Provider Server Launcher >> "dist\remote-server.bat"
echo cd /d "%%~dp0" >> "dist\remote-server.bat"
echo "%%~dp0remote-server-invisible.vbs" >> "dist\remote-server.bat"

echo ✅ Invisible launchers created!
echo.
echo Files created:
echo   - remote-server-invisible.vbs (VBS invisible launcher)
echo   - remote-server-invisible.ps1 (PowerShell invisible launcher)  
echo   - start-invisible.bat (Batch to VBS launcher)
echo   - remote-server.bat (Updated to use invisible method)
echo.
echo Now the application will run with NO VISIBLE WINDOW!

pause
