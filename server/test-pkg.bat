@echo off
echo ========================================
echo Testing pkg build process
echo ========================================

echo Current directory: %CD%

echo.
echo Checking pkg version:
pkg --version

echo.
echo Checking Node.js version:
node --version

echo.
echo Checking if main-cli.js exists:
if exist "main-cli.js" (
    echo ✅ main-cli.js found
) else (
    echo ❌ main-cli.js not found
    pause
    exit /b 1
)

echo.
echo Creating dist directory:
if not exist "dist" mkdir dist

echo.
echo Testing simple pkg build:
echo Running: pkg main-cli.js --targets node18-win-x64 --output dist/test-remote-server.exe
pkg main-cli.js --targets node18-win-x64 --output dist/test-remote-server.exe

echo.
echo Checking if executable was created:
if exist "dist\test-remote-server.exe" (
    echo ✅ test-remote-server.exe created successfully
    
    echo.
    echo File size:
    for %%A in ("dist\test-remote-server.exe") do echo %%~zA bytes
    
    echo.
    echo Testing executable:
    "dist\test-remote-server.exe" --help 2>nul
    if errorlevel 1 (
        echo ⚠️ Executable created but may have issues
    ) else (
        echo ✅ Executable appears to work
    )
) else (
    echo ❌ test-remote-server.exe was not created
    echo.
    echo This indicates a problem with pkg or the source files
)

echo.
echo ========================================
pause
