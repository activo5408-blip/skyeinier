@echo off
setlocal enabledelayedexpansion
title Reproductor YouTube - Variados - Setup
cd /d "%~dp0"

echo ============================================
echo   Reproductor YouTube - Variados
echo ============================================
echo.

echo [1/3] Instalando dependencias (npm install)...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: fallo npm install. Revisa que tengas Node.js instalado.
    pause
    exit /b 1
)
echo Listo.
echo.

echo [2/3] Icono de la app...
if exist "icon.png" (
    echo Se encontro icon.png, generando iconos...
    call npm run tauri icon icon.png
    if errorlevel 1 (
        echo.
        echo ERROR al generar los iconos.
        pause
        exit /b 1
    )
    echo Iconos generados en src-tauri\icons\
) else (
    echo AVISO: no se encontro icon.png en esta carpeta.
    echo Poné una imagen cuadrada llamada icon.png aca y volve a correr
    echo este script si queres icono personalizado. Por ahora se sigue
    echo sin regenerar iconos.
)
echo.

echo [3/3] Que queres hacer?
echo   1 = Probar la app (modo desarrollo)
echo   2 = Compilar instalador de Windows (.msi / .exe)
echo   3 = Salir
set /p opcion="Elegi una opcion (1/2/3): "

if "%opcion%"=="1" (
    call npm run tauri dev
) else if "%opcion%"=="2" (
    call npm run tauri build
    echo.
    echo Instalador generado en:
    echo src-tauri\target\release\bundle\
    echo.
    pause
) else (
    echo Saliendo...
)

endlocal
