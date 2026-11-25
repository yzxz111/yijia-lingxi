@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $root=(Get-Location).Path; $name=(Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).productName; $exe=Join-Path $root ('release\'+$name+'-win32-x64\'+$name+'.exe'); if(Test-Path -LiteralPath $exe){Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe); exit 0}; $exe=Join-Path $root 'node_modules\electron\dist\electron.exe'; if(Test-Path -LiteralPath $exe){if(-not(Test-Path -LiteralPath (Join-Path $root 'dist\index.html'))){Write-Error 'Build the frontend first: npm run build'; exit 1}; Start-Process -FilePath $exe -WorkingDirectory $root -ArgumentList '.'; exit 0}; Write-Error 'Install dependencies first: npm ci'; exit 1"
if errorlevel 1 (
  pause
  exit /b 1
)
exit /b 0
