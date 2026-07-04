#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/webapp"

lsof -ti:3000 | xargs kill -9 2>/dev/null

echo ""
echo "========================================"
echo "  AI 上岗实战总教练"
echo "  正在启动（生产模式 · 稳定版）..."
echo "========================================"
echo ""

if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，安装依赖中（约 2 分钟）..."
  npm install
  echo ""
fi

if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
  echo "🔨 首次运行，构建中（约 1 分钟）..."
  npm run build
  echo ""
fi

LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | grep -v 198.18 | awk '{print $2}' | head -1)

echo "🚀 启动生产服务器..."
echo ""
echo "  💻 本机访问:  http://localhost:3000"
echo "  📱 手机访问:  http://${LOCAL_IP}:3000  (同一WiFi)"
echo "  👩‍🏫 教师面板:  /teacher"
echo "  ⚙️ 管理后台:  /admin"
echo ""

(sleep 2 && open http://localhost:3000) &

while true; do
  npm run start -- -p 3000
  echo ""
  echo "⚠️ 服务器意外退出，3秒后自动重启..."
  sleep 3
done
