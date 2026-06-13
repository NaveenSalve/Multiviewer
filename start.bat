@echo off
title PhantomView OS — Web + Proxy + Desktop Farm
cd /d "%~dp0phantomview-website"

echo [INFO] Starting proxy server (port 3456)...
start "" /min cmd /c "node server/proxy-server.mjs"

echo [INFO] Starting desktop farm engine (port 3457)...
start "" /min cmd /c "node desktop/main.mjs"

echo [INFO] Starting dev server (port 5173)...
start "" /min cmd /c "npm run dev"

echo [INFO] Waiting for servers to be ready...
timeout /t 6 /nobreak >nul

echo [INFO] Opening http://localhost:5173 in your browser...
start http://localhost:5173

echo.
echo [INFO] ========================================
echo [INFO]  Web:    http://localhost:5173
echo [INFO]  Proxy:  http://localhost:3456/health
echo [INFO]  Farm:   http://localhost:3457/status
echo [INFO] ========================================
echo [INFO] Close this window to stop all servers.
echo.
pause
