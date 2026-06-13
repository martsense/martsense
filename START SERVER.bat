@echo off
title MARTSENSE Server
echo ========================================
echo       MARTSENSE SERVER STARTING...
echo ========================================
echo.
cd /d "%~dp0backend"
node server.js
pause
