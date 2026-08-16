@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js before using the local publisher.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo Git was not found.
  echo Install Git for Windows before using one-click publish.
  pause
  exit /b 1
)

if not exist ".git" (
  echo This folder is not a Git clone.
  echo One-click publish requires the real Closer to Korea Git repository cloned to this PC.
  echo Manual Export in admin.html can still be used without Git.
  pause
  exit /b 1
)

set CTK_OPEN_BROWSER=1
node scripts\local-admin-server.mjs
if errorlevel 1 pause
