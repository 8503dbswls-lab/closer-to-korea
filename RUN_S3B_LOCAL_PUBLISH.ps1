$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path

Add-Type -AssemblyName System.Windows.Forms

$dialog=New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title="Select Closer to Korea publish JSON"
$dialog.Filter="JSON files (*.json)|*.json|All files (*.*)|*.*"
$dialog.Multiselect=$false

$result=$dialog.ShowDialog()
if($result -ne [System.Windows.Forms.DialogResult]::OK){
  Write-Host "No file selected."
  Read-Host "Press Enter"
  exit 0
}

$file=$dialog.FileName

Write-Host ""
Write-Host "Selected:"
Write-Host $file
Write-Host ""
Write-Host "This tool only updates local site files and generates the static HTML page." -ForegroundColor Cyan
Write-Host "It does not publish anything automatically."
Write-Host ""

node "$Root\scripts\s3b-import-publish.mjs" "$file"

if($LASTEXITCODE -ne 0){
  Write-Host ""
  Write-Host "HTML generation failed." -ForegroundColor Red
  Read-Host "Press Enter"
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "HTML generation completed successfully." -ForegroundColor Green
Write-Host "You can now review the changed files and upload them yourself."
Read-Host "Press Enter to close"
