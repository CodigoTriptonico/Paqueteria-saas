@echo off
echo Cerrando instancias previas de Chrome en modo depuracion para evitar conflictos...
taskkill /IM chrome.exe /FI "WINDOWTITLE eq Google Chrome (Debug)" /F >nul 2>&1

echo Iniciando Chrome en modo depuracion en el puerto 9222...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\ChromeDebugProfile"

echo Listo. Chrome se ha iniciado. Mantén esta ventana abierta o regresa al chat.
pause
