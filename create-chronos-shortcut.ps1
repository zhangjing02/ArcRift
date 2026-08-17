$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('C:\Users\user002\Desktop\ChronosMind.lnk')
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = 'd:\Devs\ArcRift\ChronosMind.vbs'
$Shortcut.WorkingDirectory = 'd:\Devs\ArcRift'
$Shortcut.Description = 'ChronosMind - Local AI Memory & Knowledge Graph'
$Shortcut.Save()

if (Test-Path 'C:\Users\user002\Desktop\Nowledge Mem.lnk') {
    Remove-Item 'C:\Users\user002\Desktop\Nowledge Mem.lnk' -Force
}
Write-Output "ChronosMind shortcut created successfully!"
