@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if not defined JAVA_HOME call :fail "JDK non trovato: installa Android Studio o imposta JAVA_HOME" & exit /b 1
set "PUBLISHED=1"

where gh >nul 2>&1 || (call :fail "Installa GitHub CLI (gh)" & exit /b 1)
if not exist "%ROOT%\gradlew.bat" call :fail "Gradle wrapper non trovato" & exit /b 1
gh auth status >nul 2>&1 || (call :fail "Accedi a GitHub con: gh auth login" & exit /b 1)
set "PYTHON=python"
where python >nul 2>&1 || set "PYTHON=py -3"

for /f "delims=" %%i in ('gh api user --jq .login') do set "OWNER=%%i"
if not defined OWNER call :fail "Impossibile leggere l'account GitHub" & exit /b 1
set "REPO=%GARAGE_RELEASE_REPO%"
if not defined REPO set "REPO=%DUEFFE_RELEASE_REPO%"
if not defined REPO set "REPO=%OWNER%/android-app-releases"
set "VISIBILITY="
for /f "delims=" %%i in ('gh repo view "%REPO%" --json visibility --jq .visibility') do set "VISIBILITY=%%i"
if /i not "%VISIBILITY%"=="PUBLIC" call :fail "La repo %REPO% non e' pubblica o non e' accessibile" & exit /b 1
gh release list --repo "%REPO%" --limit 1 >nul || (call :fail "Non posso leggere le release di %REPO%" & exit /b 1)

rem Chiave di firma: creata al primo uso, poi riusata per tutti gli aggiornamenti.
set "SECRETS=%ROOT%\.release-secrets"
if not exist "%SECRETS%" mkdir "%SECRETS%"
if not exist "%SECRETS%\signing.env" (
  echo Genero una chiave di firma privata per Garage...
  for /f "delims=" %%p in ('powershell -NoProfile -Command "$b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') })"') do set "PASSWORD=%%p"
  "%JAVA_HOME%\bin\keytool" -genkeypair -v -keystore "%SECRETS%\dueffe-garage.jks" -alias dueffe-garage -keyalg RSA -keysize 4096 -validity 10000 -storepass "!PASSWORD!" -keypass "!PASSWORD!" -dname "CN=Garage" >nul 2>&1 || (call :fail "Creazione chiave non riuscita" & exit /b 1)
  > "%SECRETS%\signing.env" echo DUEFFE_STORE_PASSWORD='!PASSWORD!'
  >> "%SECRETS%\signing.env" echo DUEFFE_KEY_PASSWORD='!PASSWORD!'
  echo Conserva una copia sicura di %SECRETS%: serve per gli aggiornamenti futuri.
)
if not exist "%SECRETS%\dueffe-garage.jks" call :fail "Chiave di firma mancante" & exit /b 1
rem signing.env e' condiviso con lo script macOS: KEY='valore'
for /f "usebackq tokens=1,* delims==" %%a in ("%SECRETS%\signing.env") do (
  set "VALUE=%%b"
  set "%%a=!VALUE:'=!"
)
set "DUEFFE_KEYSTORE=%SECRETS%\dueffe-garage.jks"
set "DUEFFE_KEY_ALIAS=dueffe-garage"

set "VERSION_FILE=%ROOT%\version.properties"
copy /y "%VERSION_FILE%" "%TEMP%\garage-version.bak" >nul
for /f "usebackq tokens=1,* delims==" %%a in ("%VERSION_FILE%") do (
  if "%%a"=="VERSION_CODE" set "CODE=%%b"
  if "%%a"=="VERSION_NAME" set "NAME=%%b"
)
echo %CODE%| findstr /r "^[0-9][0-9]*$" >nul || (call :fail "Versione non valida in version.properties" & exit /b 1)
echo %NAME%| findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul || (call :fail "Versione non valida in version.properties" & exit /b 1)
for /f "tokens=1-3 delims=." %%a in ("%NAME%") do (set "MAJOR=%%a" & set "MINOR=%%b" & set "PATCH=%%c")
set /a NEW_CODE=CODE+1, NEW_PATCH=PATCH+1
:next_version
set "NEW_NAME=%MAJOR%.%MINOR%.%NEW_PATCH%"
set "TAG=garage-v%NEW_NAME%"
gh release view "%TAG%" --repo "%REPO%" >nul 2>&1 && (set /a NEW_CODE+=1, NEW_PATCH+=1 & goto next_version)

> "%VERSION_FILE%" echo VERSION_CODE=%NEW_CODE%
>> "%VERSION_FILE%" echo VERSION_NAME=%NEW_NAME%
set "PUBLISHED=0"

echo Compilo la versione firmata %NEW_NAME%...
call "%ROOT%\gradlew.bat" :app:assembleRelease "-PupdateRepository=%REPO%" || (call :fail "Compilazione release non riuscita" & exit /b 1)
set "APK=%ROOT%\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK%" call :fail "APK release non trovato" & exit /b 1
set "BUILD_TOOLS="
for /f "delims=" %%d in ('dir /b /ad /o:n "%ANDROID_HOME%\build-tools"') do set "BUILD_TOOLS=%ANDROID_HOME%\build-tools\%%d"
call "%BUILD_TOOLS%\apksigner.bat" verify "%APK%" >nul || (call :fail "Firma APK non valida" & exit /b 1)
set "ASSET_DIR=%ROOT%\app\build\outputs\apk\release"
set "ASSET=%ASSET_DIR%\garage-v%NEW_NAME%.apk"
copy /y "%APK%" "%ASSET%" >nul

%PYTHON% write-update-metadata.py "%ASSET%" %NEW_CODE% %NEW_NAME% it.dueffe.garage || (call :fail "Metadati di aggiornamento non generati" & exit /b 1)
echo Pubblico %TAG% in %REPO%...
gh release create "%TAG%" "%ASSET%#Garage-%NEW_NAME%.apk" "%ASSET_DIR%\latest.json" --repo "%REPO%" --title "Garage %NEW_NAME%" --notes "APK Android nativo di Garage. Versione %NEW_NAME% (code %NEW_CODE%)." || (call :fail "Pubblicazione fallita" & exit /b 1)
set "PUBLISHED=1"

echo Rimuovo le vecchie release di Garage...
gh api --paginate "repos/%REPO%/releases?per_page=100" --jq ".[].tag_name" > "%TEMP%\garage-tags-lf.txt" || (call :fail "Release pubblicata, ma elenco delle vecchie versioni non disponibile" & exit /b 1)
rem gh scrive righe con solo LF: "more" le converte in CRLF, come si aspetta findstr.
more < "%TEMP%\garage-tags-lf.txt" > "%TEMP%\garage-tags.txt"
for /f "usebackq delims=" %%t in (`findstr /r /x "garage-v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]* dueffe-garage-v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*" "%TEMP%\garage-tags.txt"`) do (
  if not "%%t"=="%TAG%" (
    gh release delete "%%t" --repo "%REPO%" --cleanup-tag --yes || (call :fail "Release %TAG% pubblicata, ma eliminazione di %%t non riuscita" & exit /b 1)
  )
)
echo Pubblicata: https://github.com/%REPO%/releases/tag/%TAG%
if not defined GARAGE_NO_PAUSE pause
exit /b 0

:fail
echo Errore: %~1 1>&2
if "%PUBLISHED%"=="0" copy /y "%TEMP%\garage-version.bak" "%VERSION_FILE%" >nul
if not defined GARAGE_NO_PAUSE pause
exit /b 1
