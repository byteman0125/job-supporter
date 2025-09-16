@echo off
echo Testing pkg detection...

echo Method 1: Using 'where' command
where pkg >nul 2>&1
if errorlevel 1 (
    echo pkg NOT found with 'where' command
) else (
    echo pkg FOUND with 'where' command
)

echo.
echo Method 2: Using 'npm list -g' command
npm list -g pkg --depth=0 >nul 2>&1
if errorlevel 1 (
    echo pkg NOT found with 'npm list -g'
) else (
    echo pkg FOUND with 'npm list -g'
)

echo.
echo Method 3: Direct command test (this might hang if pkg doesn't exist)
echo Testing direct pkg command...
timeout /t 3 >nul 2>&1
pkg --version >nul 2>&1
if errorlevel 1 (
    echo pkg command FAILED or timed out
) else (
    echo pkg command SUCCESS
)

echo.
echo Test complete!
pause
