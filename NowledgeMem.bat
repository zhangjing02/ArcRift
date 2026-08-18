@echo off
chcp 65001 >nul
title ArcRift - 本地优先 AI 长期记忆与知识图谱系统
color 0B

echo =======================================================================
echo          ArcRift (Nowledge Mem Pure SQLite) 启动程序
echo =======================================================================
echo.

cd /d "%~dp0"

:: 1. 智能寻找 Node.js 路径
set "NODE_EXE=node"
where node >nul 2>nul
if %errorlevel% equ 0 goto node_found

if exist "D:\DevelopeTools\Node\node.exe" (
    set "NODE_EXE=D:\DevelopeTools\Node\node.exe"
    set "PATH=D:\DevelopeTools\Node;%PATH%"
    goto node_found
)

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    set "PATH=C:\Program Files\nodejs;%PATH%"
    goto node_found
)

if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
    set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
    goto node_found
)

echo [错误] 未能在系统 PATH 或常见路径中检测到 Node.js。
echo 请确保已安装 Node.js 并将 node.exe 加入环境变量。
echo.
pause
exit /b 1

:node_found
echo [✓] Node.js 环境已就绪: %NODE_EXE%

:: 2. 设置生产环境配置
set "NODE_ENV=production"
set "PORT=3001"
set "ARCRIFT_STORAGE_MODE=sqlite"

echo [✓] 数据存储目录: %~dp0data\NowledgeMem.db
echo [✓] 正在启动本地服务与 3D 知识图谱引擎...
echo.
echo =======================================================================
echo   * Web 控制台:  http://localhost:3001
echo   * MCP 服务端:  %~dp0backend\dist\mcp\server.js
echo   * 操作说明:    保持此窗口开启即可持续提供服务，按 Ctrl+C 可停止
echo =======================================================================
echo.

:: 3. 异步 1.5 秒后在默认浏览器自动打开控制台
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://localhost:3001'"

:: 4. 前台运行后端，保持窗口常驻并输出实时日志
"%NODE_EXE%" "%~dp0backend\dist\index.js"

if %errorlevel% neq 0 (
    echo.
    echo [提示] 服务已退出或发生异常。
    pause
)
