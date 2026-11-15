# Builds the Atomic Android app and puts the signed file at public/Atomic.apk (published with the site).
#
#   powershell -File android\build-apk.ps1
#
# It needs the tools in C:\Users\yoav2\atomic-android-tools (Java 17 + Android SDK) and the signing key in
# C:\Users\yoav2\atomic-android-signing (see its README.txt). The app is a shell around the live site, so
# you only need to rebuild it when the native part (android\ folder) changes; web changes show up by themselves.
$ErrorActionPreference = 'Stop'
$tools = 'C:\Users\yoav2\atomic-android-tools'
$sign  = 'C:\Users\yoav2\atomic-android-signing'
$repo  = Split-Path -Parent $PSScriptRoot
$bt    = "$tools\sdk\build-tools\34.0.0"
$env:JAVA_HOME = "$tools\jdk\jdk-17.0.21+9"
$env:ANDROID_HOME = "$tools\sdk"; $env:ANDROID_SDK_ROOT = "$tools\sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location $repo
npm run build
npx cap sync android

Set-Location "$repo\android"
.\gradlew.bat --no-daemon assembleRelease
if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }

$out = "$repo\android\app\build\outputs\apk\release"
$unsigned = "$out\app-release-unsigned.apk"
$aligned = "$out\atomic-aligned.apk"
$final = "$repo\public\Atomic.apk"
$pw = ((Get-Content "$sign\README.txt") | Where-Object { $_ -like 'Password:*' }) -replace 'Password:\s*', ''
Remove-Item $aligned, $final -ErrorAction SilentlyContinue
& "$bt\zipalign.exe" -p -f 4 $unsigned $aligned
& "$bt\apksigner.bat" sign --ks "$sign\atomic-release.jks" --ks-key-alias atomic --ks-pass "pass:$pw" --key-pass "pass:$pw" --out $final $aligned
& "$bt\apksigner.bat" verify --print-certs $final
Remove-Item "$final.idsig" -ErrorAction SilentlyContinue
"Done: $final"
