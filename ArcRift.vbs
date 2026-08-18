Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

electronExe = currentDir & "\desktop\node_modules\electron\dist\electron.exe"

If fso.FileExists(electronExe) Then
    ' 启动原生 Electron 独立桌面应用窗口 (模式 1 = 正常可见窗口，前台聚焦展示)
    WshShell.Run """" & electronExe & """ """ & currentDir & "\desktop""", 1, False
Else
    ' 备用方案：启动后台 Node 服务并通过 Edge 独立 App 模式打开原生单窗口
    nodeExe = currentDir & "\backend\bin\node.exe"
    If Not fso.FileExists(nodeExe) Then
        If fso.FileExists("D:\DevelopeTools\Node\node.exe") Then
            nodeExe = "D:\DevelopeTools\Node\node.exe"
        Else
            nodeExe = "node"
        End If
    End If
    
    WshShell.Environment("PROCESS")("NODE_ENV") = "production"
    WshShell.Environment("PROCESS")("PORT") = "3001"
    WshShell.Environment("PROCESS")("ARCRIFT_STORAGE_MODE") = "sqlite"
    
    WshShell.Run """" & nodeExe & """ """ & currentDir & "\backend\dist\index.js""", 0, False
    WScript.Sleep 1200
    WshShell.Run "msedge.exe --app=http://localhost:3001 --app-id=ArcRift --user-data-dir=""" & currentDir & "\data\app-profile""", 1, False
End If
