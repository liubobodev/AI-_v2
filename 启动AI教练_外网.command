#!/bin/bash

export PATH="$HOME/.local/bin:$PATH"

echo ""
echo "========================================"
echo "  AI 上岗实战总教练 · 外网模式"
echo "  电脑/手机均可访问"
echo "========================================"
echo ""

cd "/Users/mini_m4/Desktop/AI上岗实战训练营智能体_v2/webapp"

# ---- 检查 ngrok ----
NGROK=$(which ngrok 2>/dev/null || echo "$HOME/.local/bin/ngrok")
if [ ! -x "$NGROK" ]; then
  echo "正在安装 ngrok..."
  curl -sL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip -o /tmp/ngrok.zip
  mkdir -p "$HOME/.local/bin"
  unzip -o /tmp/ngrok.zip -d "$HOME/.local/bin/"
  chmod +x "$HOME/.local/bin/ngrok"
  NGROK="$HOME/.local/bin/ngrok"
fi

# ---- 依赖检查 ----
if [ ! -d "node_modules" ]; then
  echo "安装依赖中..."
  npm install
fi

# ---- 关闭旧进程 ----
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:4040 | xargs kill -9 2>/dev/null

echo "启动本地服务..."
npm run dev &
DEV_PID=$!
sleep 4

echo ""
echo "启动外网隧道..."
"$NGROK" http 3000 --log=stdout &
NGROK_PID=$!

sleep 3
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys,json
try:
  tunnels = json.load(sys.stdin).get('tunnels',[])
  for t in tunnels:
    if t.get('proto') == 'https':
      print(t['public_url'])
      break
except: pass
" 2>/dev/null)

echo ""
echo "========================================"
echo "  ✅ 服务已启动"
echo "========================================"
echo ""
if [ -n "$PUBLIC_URL" ]; then
  echo "  外网地址（电脑/手机均可打开）："
  echo ""
  echo "  👉 $PUBLIC_URL"
  echo ""
  open "$PUBLIC_URL"
else
  echo "  查看 ngrok 状态：http://localhost:4040"
  echo "  （首次使用需配置 authtoken，见下方说明）"
  open http://localhost:4040
fi

echo "  按 Ctrl+C 停止服务"
echo "========================================"

wait $DEV_PID $NGROK_PID 2>/dev/null
