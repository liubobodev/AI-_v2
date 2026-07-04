#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/webapp"

lsof -ti:3000 | xargs kill -9 2>/dev/null

echo ""
echo "========================================"
echo "  AI 上岗实战总教练 · 开发模式"
echo "  （修改知识库文件后自动生效）"
echo "========================================"
echo ""

if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，安装依赖中..."
  npm install
  echo ""
fi

(sleep 2 && open http://localhost:3000) &

echo "🚀 启动开发服务器..."
echo "💡 提示：修改 12_高阶知识讲解 等文件后，刷新浏览器即可生效"
echo ""

npm run dev
