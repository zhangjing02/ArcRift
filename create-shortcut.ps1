$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Nowledge Mem.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """d:\Devs\ArcRift\NowledgeMem.vbs"""
$Shortcut.WorkingDirectory = "d:\Devs\ArcRift"
$Shortcut.Description = "Nowledge Mem - AI Working Memory Desktop App"
$Shortcut.Save()
Write-Host "Desktop shortcut created successfully at: $DesktopPath\Nowledge Mem.lnk"
