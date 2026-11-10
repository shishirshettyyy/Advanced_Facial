@echo off
title Smart Attendance System - Stop All Services

echo Stopping Smart Attendance System services...

REM Kill Node.js processes on our ports
echo Stopping Backend (port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo Stopping Frontend (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo Stopping Python CV Service (port 8001)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8001" ^| find "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo.
echo All services stopped.
pause

