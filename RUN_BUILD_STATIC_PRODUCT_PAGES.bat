@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==============================================
echo   Closer to Korea - Build Static Products
echo ==============================================
echo.
echo Generates one static HTML page per published product.
echo Product Guides will link only to these static HTML pages.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  pause
  exit /b 1
)

node scripts\build-static-product-pages.mjs
if errorlevel 1 (
  echo.
  echo Static product build failed.
  pause
  exit /b 1
)

echo.
echo GREEN SUCCESS: static product HTML pages generated.
echo.
pause
