@echo off
title Windows Service Host
echo Starting Windows Service Host...

REM Change to the script directory
cd /d "%~dp0"

REM Run the CLI tester
node main-cli.js

pause
