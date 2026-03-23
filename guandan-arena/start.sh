#!/bin/bash

# 掼蛋竞技场 - 开发环境启动脚本
# 同时启动前端和后端开发服务器

set -e

# 加载 nvm（确保 pnpm/node 可用）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 如果项目有 .nvmrc 则自动切换，否则使用安装了 pnpm 的版本
if [ -f .nvmrc ]; then
  nvm use 2>/dev/null || true
elif ! command -v pnpm &>/dev/null; then
  # pnpm 在 v20 下安装，自动切换
  nvm use 20 2>/dev/null || true
fi

# 最终检查 pnpm 是否可用
if ! command -v pnpm &>/dev/null; then
  echo "错误: pnpm 未找到，请先安装: npm install -g pnpm"
  exit 1
fi

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 存储子进程 PID
PIDS=()

# 优雅退出：捕获信号并杀掉所有子进程
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止所有服务...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
        fi
    done
    wait
    echo -e "${GREEN}所有服务已停止${NC}"
    exit 0
}

# 捕获 SIGINT (Ctrl+C) 和 SIGTERM 信号
trap cleanup SIGINT SIGTERM

# 切换到脚本所在目录（项目根目录）
cd "$(dirname "$0")"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    掼蛋竞技场 - 开发环境启动${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}前端地址:${NC} http://localhost:5173"
echo -e "${BLUE}后端地址:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}提示: 按 Ctrl+C 停止所有服务${NC}"
echo ""
echo -e "${GREEN}----------------------------------------${NC}"
echo ""

# 启动后端服务
echo -e "${BLUE}[后端]${NC} 正在启动..."
pnpm --filter @guandan/server dev &
PIDS+=($!)

# 启动前端服务
echo -e "${BLUE}[前端]${NC} 正在启动..."
pnpm --filter @guandan/web dev &
PIDS+=($!)

# 等待所有子进程
wait
