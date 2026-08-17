$WshShell = New-Object -ComObject WScript.Shell
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'ChronosMind.lnk'

$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = 'd:\Devs\ArcRift\ChronosMind.vbs'
$Shortcut.WorkingDirectory = 'd:\Devs\ArcRift'
$Shortcut.IconLocation = 'd:\Devs\ArcRift\desktop\icon.ico,0'
$Shortcut.Description = 'ChronosMind - Local AI Memory & Knowledge Graph'
$Shortcut.Save()

Write-Output "Successfully updated ChronosMind desktop shortcut with custom monochrome icon!"
