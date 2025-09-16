@echo off
echo Testing direct pkg command...
echo.

echo Current directory: %CD%
echo.

echo Files in current directory:
dir *.js /b
echo.

echo Running pkg with verbose output:
pkg main-cli.js --targets node18-win-x64 --output test-build.exe --debug

echo.
echo Checking if executable was created:
if exist "test-build.exe" (
    echo ✅ SUCCESS: test-build.exe created
    dir test-build.exe
) else (
    echo ❌ FAILED: test-build.exe not created
)

pause
