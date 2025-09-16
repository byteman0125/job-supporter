@echo off
echo ========================================
echo Compiling Invisible Launcher EXE
echo ========================================

echo Checking for C++ compiler...

:: Try MinGW first
where g++ >nul 2>&1
if not errorlevel 1 (
    echo Found MinGW g++
    echo Compiling with MinGW...
    g++ -o dist\remote-server.exe invisible-launcher.cpp -mwindows -static
    if exist "dist\remote-server.exe" (
        echo ✅ SUCCESS: remote-server.exe created with MinGW
        echo This EXE will run Node.js completely invisibly!
        goto :success
    ) else (
        echo ❌ MinGW compilation failed
    )
)

:: Try Visual Studio cl
where cl >nul 2>&1
if not errorlevel 1 (
    echo Found Visual Studio cl
    echo Compiling with Visual Studio...
    cl invisible-launcher.cpp /Fe:dist\remote-server.exe /link /SUBSYSTEM:WINDOWS
    if exist "dist\remote-server.exe" (
        echo ✅ SUCCESS: remote-server.exe created with Visual Studio
        echo This EXE will run Node.js completely invisibly!
        goto :success
    ) else (
        echo ❌ Visual Studio compilation failed
    )
)

:: No compiler found
echo ❌ No C++ compiler found
echo.
echo To compile the invisible EXE, you need either:
echo 1. MinGW-w64 (recommended): https://www.mingw-w64.org/
echo 2. Visual Studio with C++ tools
echo.
echo Alternative: Use the VBS launcher (already created):
echo   - dist\remote-server-invisible.vbs
echo   - This also runs completely invisible!
goto :end

:success
echo.
echo ========================================
echo INVISIBLE EXE CREATED SUCCESSFULLY!
echo ========================================
echo.
echo File: dist\remote-server.exe
echo Type: Windows executable (no console)
echo Function: Launches Node.js completely invisibly
echo.
echo Usage: Just double-click dist\remote-server.exe
echo Result: Node.js runs with NO VISIBLE WINDOW
echo.

:end
pause
