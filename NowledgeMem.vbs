Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
strDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """" & strDir & "\desktop\node_modules\electron\dist\electron.exe"" """ & strDir & "\desktop\main.js""", 0, False
