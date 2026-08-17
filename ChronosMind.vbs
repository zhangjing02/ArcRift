Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\Devs\ArcRift"
WshShell.Run """d:\Devs\ArcRift\desktop\node_modules\electron\dist\electron.exe"" ""d:\Devs\ArcRift\desktop\main.js""", 1, False
