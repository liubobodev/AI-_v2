#!/bin/bash
# Minimal deploy script
export HOME="/Users/mini_m4"
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
unset $(env | cut -d= -f1 | grep -v -E '^(HOME|PATH)$')
cd /Users/mini_m4/Desktop/AI上岗实战训练营智能体_v2/webapp
vercel --prod --yes 2>&1
