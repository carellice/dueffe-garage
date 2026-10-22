@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
set "EMULATOR=%ANDROID_HOME%\emulator\emulator.exe"
if not exist "%ADB%" call :fail "SDK Android non trovato in %ANDROID_HOME%" & exit /b 1
if not exist "%EMULATOR%" call :fail "SDK Android non trovato in %ANDROID_HOME%" & exit /b 1

echo Compilo Garage...
call "%~dp0gradlew.bat" :app:assembleDebug || (call :fail "Compilazione non riuscita" & exit /b 1)

set "AVD=%GARAGE_AVD%"
if not defined AVD set "AVD=%DUEFFE_AVD%"
if not defined AVD (
  "%EMULATOR%" -list-avds > "%TEMP%\garage-avds.txt" 2>nul
  for /f "usebackq delims=" %%a in (`findstr /i /b "Pixel" "%TEMP%\garage-avds.txt"`) do if not defined AVD set "AVD=%%a"
)
if not defined AVD call :fail "Nessun emulatore Pixel configurato in Android Studio" & exit /b 1

call :find_pixel
if not defined SERIAL (
  echo Avvio l'emulatore %AVD%...
  start "" /b "%EMULATOR%" -avd "%AVD%" >"%TEMP%\garage-emulator.log" 2>&1
)
for /l %%i in (1,1,180) do (
  call :find_pixel
  if defined SERIAL (
    "%ADB%" -s !SERIAL! shell getprop sys.boot_completed 2>nul | findstr /b "1" >nul && goto booted
  )
  ping -n 3 127.0.0.1 >nul
)
call :fail "L'emulatore Pixel non ha completato l'avvio" & exit /b 1

:booted
echo Installo e apro Garage su %AVD%...
"%ADB%" -s %SERIAL% install -r "app\build\outputs\apk\debug\app-debug.apk" || (call :fail "Installazione fallita" & exit /b 1)
"%ADB%" -s %SERIAL% shell am start -n it.dueffe.garage/.MainActivity || (call :fail "Avvio dell'app fallito" & exit /b 1)
echo App avviata. Puoi chiudere questa finestra.
pause
exit /b 0

:find_pixel
set "SERIAL="
"%ADB%" devices > "%TEMP%\garage-devices.txt" 2>nul
for /f "usebackq tokens=1" %%s in (`findstr /r /c:"^emulator-[0-9]*[^a-z]*device" "%TEMP%\garage-devices.txt"`) do (
  rem findstr ignora i ritorni a capo doppi di "emu avd name".
  "%ADB%" -s %%s emu avd name 2>nul | findstr /b /c:"%AVD%" >nul && set "SERIAL=%%s"
)
exit /b 0

:fail
echo Errore: %~1 1>&2
pause
exit /b 1
