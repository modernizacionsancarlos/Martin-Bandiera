# Compila y firma la app de Android (Trusted Web Activity) y verifica el resultado.
#
# Uso (desde la raíz del proyecto):
#   powershell -ExecutionPolicy Bypass -File scripts\android\build-android.ps1
#
# Requisitos (se instalan una sola vez, a nivel de usuario; ver docs\APP_PLAY_STORE.md):
#   - JDK 17 en %LOCALAPPDATA%\Programs\jdk17   (Bubblewrap exige exactamente Java 17)
#   - Android SDK en %LOCALAPPDATA%\Android\Sdk con platforms;android-36 y build-tools;36.1.0
#   - ~\.bubblewrap\config.json con jdkPath y androidSdkPath
#   - Una clave de firma en android\ y su clave en la variable BUBBLEWRAP_KEYSTORE_PASSWORD
#     (o, solo para la clave DESCARTABLE de prueba, en android\.test-keystore-password)
#
# Trabas conocidas que este script ya resuelve:
#   1. Bubblewrap rechaza el SDK moderno si no existe la carpeta "tools": se crea vacía.
#   2. Windows con NoDefaultCurrentDirectoryInExePath=1 no encuentra gradlew.bat: se desactiva solo en este proceso.
#   3. Falta manifest-checksum.txt y Bubblewrap pregunta si regenerar: se calcula acá.
#   4. La librería androidbrowserhelper exige Android 7.0 (minSdkVersion 24): se verifica.
#   5. PowerShell 5.1 agrega un BOM al guardar con -Encoding utf8 y Gradle no lee el archivo: nunca editar así.
param(
  [string]$ProjectDir = (Join-Path $PSScriptRoot '..\..\android'),
  [switch]$SkipPwaValidation = $true
)
# Los comandos nativos (npm, gradle) escriben avisos por stderr: con 'Stop' PowerShell 5.1 los trataría como errores.
$ErrorActionPreference = 'Continue'
$ProjectDir = (Resolve-Path $ProjectDir).Path

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

$jdk17 = Get-ChildItem "$env:LOCALAPPDATA\Programs\jdk17" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jdk17) { Fail 'Falta el JDK 17 en %LOCALAPPDATA%\Programs\jdk17.' }
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
foreach ($need in "$sdk\platforms\android-36", "$sdk\build-tools\36.1.0", "$sdk\platform-tools") {
  if (-not (Test-Path $need)) { Fail "Falta $need (instalar con sdkmanager)." }
}
New-Item -ItemType Directory -Force "$sdk\tools" | Out-Null                       # traba 1
Remove-Item Env:NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue   # traba 2
$env:JAVA_HOME = $jdk17.FullName
$env:ANDROID_HOME = $sdk

# Traba 5: ningún archivo del proyecto debe empezar con BOM.
foreach ($f in 'twa-manifest.json', 'app\build.gradle') {
  $bytes = [IO.File]::ReadAllBytes("$ProjectDir\$f")
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { Fail "$f tiene BOM (guardarlo como UTF-8 sin BOM)." }
}
# Traba 4
if ((Get-Content "$ProjectDir\app\build.gradle" -Raw) -notmatch 'minSdkVersion 2[4-9]|minSdkVersion [3-9]\d') { Fail 'minSdkVersion debe ser 24 o más (androidbrowserhelper).' }

# Traba 3
$sha = [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash([IO.File]::ReadAllBytes("$ProjectDir\twa-manifest.json"))).Replace('-', '').ToLower()
[IO.File]::WriteAllText("$ProjectDir\manifest-checksum.txt", $sha)

# Clave de firma
if (-not $env:BUBBLEWRAP_KEYSTORE_PASSWORD) {
  $testFile = "$ProjectDir\.test-keystore-password"
  if (Test-Path $testFile) { $env:BUBBLEWRAP_KEYSTORE_PASSWORD = (Get-Content $testFile).Trim() }
  else { Fail 'Definí BUBBLEWRAP_KEYSTORE_PASSWORD con la clave del archivo de firma.' }
}
if (-not $env:BUBBLEWRAP_KEY_PASSWORD) { $env:BUBBLEWRAP_KEY_PASSWORD = $env:BUBBLEWRAP_KEYSTORE_PASSWORD }
$secret = $env:BUBBLEWRAP_KEYSTORE_PASSWORD
$mask = { param($line) ($line -replace [regex]::Escape($secret), '[CLAVE]') -replace '\x1b\[[0-9;]*m', '' }

Push-Location $ProjectDir
try {
  Write-Host '== Compilando y firmando (Bubblewrap + Gradle)'
  $bwArgs = @('--yes', '@bubblewrap/cli@1.27.0', 'build')
  if ($SkipPwaValidation) { $bwArgs += '--skipPwaValidation' }
  & npx.cmd @bwArgs 2>&1 | ForEach-Object { & $mask $_ } | Where-Object { $_ -notmatch 'RemoteException|punycode|trace-deprecation|^\s*$|^[,|`]' }
  if ($LASTEXITCODE -ne 0) { Fail 'La compilación falló (ver mensajes arriba).' }

  $apk = Join-Path $ProjectDir 'app-release-signed.apk'
  $aab = Join-Path $ProjectDir 'app-release-bundle.aab'
  foreach ($f in $apk, $aab) { if (-not (Test-Path $f)) { Fail "No se generó $f" } }

  Write-Host '== Verificación'
  $bt = "$sdk\build-tools\36.1.0"
  $verify = & "$bt\apksigner.bat" verify --verbose $apk 2>&1
  if (($verify -join "`n") -notmatch 'Verifies') { Fail 'La firma del APK no es válida.' }
  Write-Host 'Firma del APK: válida'
  & "$bt\aapt2.exe" dump badging $apk 2>&1 | Select-String '^package|sdkVersion|targetSdk|application-label:' | ForEach-Object { $_.Line }
  Get-ChildItem $ProjectDir -Filter 'app-release-*' | Where-Object { $_.Extension -in '.apk', '.aab' } | Select-Object Name, @{n = 'KB'; e = { [math]::Round($_.Length / 1KB) } }
}
finally { Pop-Location }
