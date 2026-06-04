@echo off
REM ==============================================================
REM Install Visual Studio Build Tools 2022 (C++ workload)
REM Required by Rust MSVC toolchain for Tauri.
REM RIGHT-CLICK THIS FILE -> "Run as administrator"
REM ==============================================================

NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: This script must be run as Administrator.
    echo.
    echo  Right-click Install-BuildTools.bat and choose
    echo  "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo.
echo Downloading Visual Studio Build Tools bootstrapper...
echo.

set "BOOT=%TEMP%\vs_BuildTools.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile '%BOOT%' -UseBasicParsing"
IF %ERRORLEVEL% NEQ 0 (
    echo Download failed.
    pause
    exit /b 1
)

echo.
echo Installing Build Tools 2022 with C++ workload and Win11 SDK...
echo This will take 15-30 minutes. Do not close this window.
echo.

"%BOOT%" --quiet --wait --norestart --nocache ^
    --add Microsoft.VisualStudio.Workload.VCTools ^
    --add Microsoft.VisualStudio.Component.Windows11SDK.22621 ^
    --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 ^
    --includeRecommended

set "RC=%ERRORLEVEL%"
echo.
echo Installer exit code: %RC%
echo.
if %RC% EQU 0 (
    echo SUCCESS - Build Tools installed.
) else if %RC% EQU 3010 (
    echo SUCCESS - Build Tools installed. A reboot is recommended.
) else (
    echo Install returned non-zero exit code. Check log at:
    echo   %TEMP%\dd_bootstrapper_*.log
)
echo.
pause
