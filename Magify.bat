@echo off
cd /d "C:\Users\tagiy\OneDrive\Desktop\MagifyForR"

start cmd /k "npm run dev"

timeout /t 5 >nul

start chrome --app=http://localhost:3000 --start-maximized