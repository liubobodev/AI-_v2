#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/webapp"

lsof -ti:3000 | xargs kill -9 2>/dev/null

echo ""
echo "========================================"
echo "  AI 上岗实战总教练 · 外网模式"
echo "========================================"
echo ""

if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，安装依赖中（约 2 分钟）..."
  npm install
  echo ""
fi

if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
  echo "🔨 首次运行，构建中..."
  npm run build
  echo ""
fi

# 检查 ngrok
if ! command -v ngrok &> /dev/null; then
  echo "❌ 未安装 ngrok"
  echo "   安装：brew install ngrok"
  echo "   注册：https://ngrok.com → 获取 authtoken"
  echo "   配置：ngrok config add-authtoken <你的token>"
  echo ""
  echo "💡 推荐：部署到 Vercel（免费永久外网），见 启动指南.md"
  read -p "按回车退出..."
  exit 1
fi

# 启动生产服务器（背景）
echo "🚀 启动本地服务器..."
nohup npm run start -- -p 3000 > /tmp/ai-coach-server.log 2>&1 &
SERVER_PID=$!

sleep 2

# 启动 ngrok
echo "🌐 启动 ngrok 隧道..."
ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# 等 ngrok 获取公网地址
sleep 4
PUBLIC_URL=$(/usr/bin/curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | /opt/homebrew/bin/python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null)

echo ""
echo "========================================"
echo "  🌐 公网地址（电脑/手机均可访问）："
echo "  $PUBLIC_URL"
echo ""
echo "  教师面板：$PUBLIC_URL/teacher"
echo "  管理后台：$PUBLIC_URL/admin"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "kill $SERVER_PID $NGROK_PID 2>/dev/null; echo '已停止'; exit 0" INT
while true; do sleep 1; done
