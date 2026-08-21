Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\Devs\ArcRift\backend"
WshShell.Run "cmd /c set ""SQLITE_DB_PATH=d:\Devs\ArcRift\backend\ChronosMind.db"" && node dist/index.js", 0, False

WScript.Sleep 800

WshShell.CurrentDirectory = "d:\Devs\ArcRift"
WshShell.Run """d:\Devs\ArcRift\desktop\node_modules\electron\dist\electron.exe"" ""d:\Devs\ArcRift\desktop\main.js""", 1, False
