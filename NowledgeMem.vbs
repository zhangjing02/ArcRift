Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
strDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c cd /d """ & strDir & "\desktop"" && npx electron .", 0, False
