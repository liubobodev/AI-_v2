#!/bin/bash
clear
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   AI 上岗实战总教练                  ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

cd "/Users/mini_m4/Desktop/AI上岗实战训练营智能体_v2/webapp"

# 清理旧进程
kill $(lsof -ti:3000) 2>/dev/null

# 依赖检查
if [ ! -d "node_modules" ]; then
  echo "  安装依赖..."
  npm install
fi

# 先打开 loading 页（本地文件，一定打得开）
open "file:///Users/mini_m4/Desktop/AI上岗实战训练营智能体_v2/webapp/public/loading.html"

# 启动服务（保持终端打开）
echo "  启动服务中..."
npm run dev
