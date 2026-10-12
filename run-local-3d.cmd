@echo off
cd /d "%~dp0"
start "" "http://localhost:4173/configurador-3d/"
node start-3d.mjs
pause
