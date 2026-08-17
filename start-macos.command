#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================="
echo "   ArcRift / Nowledge Mem for macOS"
echo "========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js (https://nodejs.org/ 或 brew install node)"
    read -p "按回车键退出..."
    exit 1
fi

echo "🚀 正在启动 ArcRift Pure SQLite 本地引擎..."
export NODE_ENV=production
export PORT=3001

# Start backend in background and open browser
node backend/dist/index.js &
SERVER_PID=$!

sleep 2
echo "🌐 正在打开控制台: http://localhost:3001"
open "http://localhost:3001"

echo ""
echo "✅ ArcRift 已成功运行！"
echo "👉 MCP 连接路径: $DIR/backend/dist/mcp/server.js"
echo "按 Ctrl+C 可停止服务。"
echo ""

wait $SERVER_PID
