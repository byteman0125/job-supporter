@echo off
echo Testing pkg with minimal JavaScript file...
echo.

echo Building minimal-test.js:
pkg minimal-test.js --targets node18-win-x64 --output minimal-test.exe

echo.
echo Checking result:
if exist "minimal-test.exe" (
    echo ✅ SUCCESS: minimal-test.exe created
    echo Testing execution:
    minimal-test.exe
) else (
    echo ❌ FAILED: minimal-test.exe not created
    echo This indicates a fundamental pkg issue
)

pause
