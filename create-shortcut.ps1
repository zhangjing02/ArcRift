$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Nowledge Mem.lnk")

$Shortcut.TargetPath = "d:\Devs\ArcRift\desktop\node_modules\electron\dist\electron.exe"
$Shortcut.Arguments = """d:\Devs\ArcRift\desktop\main.js"""
$Shortcut.WorkingDirectory = "d:\Devs\ArcRift\desktop"
$Shortcut.Description = "Nowledge Mem - AI Working Memory Desktop App"

$Shortcut.Save()
Write-Host "Direct native desktop shortcut updated at: $DesktopPath\Nowledge Mem.lnk"
