@echo off
cd /d "%~dp0"
start "NUBYRA Server" /min cmd /k "node start-3d.mjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:4173/configurador-3d/"
