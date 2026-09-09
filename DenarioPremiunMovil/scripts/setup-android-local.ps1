# Post-clone Android setup (Windows). Run from DenarioPremiunMovil/
param(
  [string]$SdkDir = "$env:LOCALAPPDATA\Android\Sdk"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'package.json')) {
  throw 'Run from DenarioPremiunMovil folder'
}

if (-not (Test-Path $SdkDir)) {
  throw "Android SDK not found at $SdkDir. Install Android Studio or pass -SdkDir."
}

$localProps = Join-Path 'android' 'local.properties'
$escaped = ($SdkDir -replace '\\', '/').Replace(':', '\:')
Set-Content -Path $localProps -Value "sdk.dir=$escaped" -Encoding ascii

npm install
npm run build -- --configuration=development
npx cap sync android

Push-Location android
./gradlew.bat clean assembleDebug
Pop-Location

Write-Host 'Android setup OK. Run live reload with:'
Write-Host '  npx cap run android --target=<device-id> --live-reload --port=8100 --host=<your-lan-ip>'
