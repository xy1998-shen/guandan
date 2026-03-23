#!/bin/bash
set -e

# ============================================
# 掼蛋竞技场 - 一键部署脚本
# 适用于 Ubuntu / Alibaba Cloud Linux / CentOS
# ============================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/xy1998-shen/guandan.git"
APP_DIR="guandan-arena"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  掼蛋竞技场 - 一键部署${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 检查是否以 root 或 sudo 权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户或 sudo 运行此脚本${NC}"
    echo "用法: sudo bash deploy.sh"
    exit 1
fi

# 检测包管理器
install_pkg() {
    if command -v apt-get &>/dev/null; then
        apt-get update -qq && apt-get install -y "$@"
    elif command -v yum &>/dev/null; then
        yum install -y "$@"
    else
        echo -e "${RED}不支持的包管理器，请手动安装: $@${NC}"
        exit 1
    fi
}

# 1. 检查并安装 Docker
echo -e "${BLUE}[1/5] 检查 Docker...${NC}"
if ! command -v docker &>/dev/null; then
    echo -e "${YELLOW}Docker 未安装，正在安装...${NC}"
    if command -v apt-get &>/dev/null; then
        apt-get update && apt-get install -y docker.io docker-compose-plugin
    elif command -v yum &>/dev/null; then
        yum install -y docker docker-compose-plugin
    fi
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker 安装完成${NC}"
else
    echo -e "${GREEN}Docker 已安装: $(docker --version)${NC}"
fi

# 确保 Docker 服务正在运行
if ! systemctl is-active --quiet docker; then
    echo -e "${YELLOW}启动 Docker 服务...${NC}"
    systemctl start docker
fi

# 2. 检查 Docker Compose
echo -e "${BLUE}[2/5] 检查 Docker Compose...${NC}"
if docker compose version &>/dev/null; then
    echo -e "${GREEN}Docker Compose 已安装: $(docker compose version --short)${NC}"
elif command -v docker-compose &>/dev/null; then
    echo -e "${GREEN}Docker Compose (V1) 已安装: $(docker-compose --version)${NC}"
    # 创建别名函数
    docker() {
        if [ "$1" = "compose" ]; then
            shift
            command docker-compose "$@"
        else
            command docker "$@"
        fi
    }
else
    echo -e "${YELLOW}Docker Compose 未安装，正在安装...${NC}"
    install_pkg docker-compose-plugin
    echo -e "${GREEN}Docker Compose 安装完成${NC}"
fi

# 3. 检查 Git
echo -e "${BLUE}[3/5] 检查 Git...${NC}"
if ! command -v git &>/dev/null; then
    echo -e "${YELLOW}Git 未安装，正在安装...${NC}"
    install_pkg git
fi
echo -e "${GREEN}Git 已安装: $(git --version)${NC}"

# 4. 获取/更新代码
echo -e "${BLUE}[4/5] 获取代码...${NC}"
if [ -d "$APP_DIR" ]; then
    echo "更新已有代码..."
    cd "$APP_DIR"
    git pull
else
    echo "克隆代码..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
echo -e "${GREEN}代码已就绪${NC}"

# 5. 构建并启动容器
echo -e "${BLUE}[5/5] 构建并启动容器...${NC}"
docker compose up -d --build
echo -e "${GREEN}容器已启动${NC}"

# 6. 健康检查
echo -e "${BLUE}等待服务就绪...${NC}"
MAX_WAIT=60
WAITED=0
echo -n "检查中"
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost/health > /dev/null 2>&1; then
        echo ""
        echo ""
        echo -e "${GREEN}======================================${NC}"
        echo -e "${GREEN}  部署成功！${NC}"
        echo -e "${GREEN}======================================${NC}"
        echo ""
        # 获取服务器 IP
        SERVER_IP=$(hostname -I | awk '{print $1}')
        echo -e "访问地址: ${BLUE}http://${SERVER_IP}${NC}"
        echo ""
        echo -e "${YELLOW}常用命令:${NC}"
        echo "  查看日志:   docker compose logs -f"
        echo "  重启服务:   docker compose restart"
        echo "  停止服务:   docker compose down"
        echo "  更新部署:   git pull && docker compose up -d --build"
        echo ""
        echo -e "${YELLOW}数据存储:${NC}"
        echo "  SQLite 数据库存储在 Docker volume: guandan-data"
        echo "  查看数据:   docker volume inspect guandan-data"
        echo ""
        exit 0
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo -n "."
done

echo ""
echo -e "${RED}======================================${NC}"
echo -e "${RED}  服务启动超时！${NC}"
echo -e "${RED}======================================${NC}"
echo ""
echo -e "${YELLOW}排查步骤:${NC}"
echo "  1. 查看容器状态:   docker compose ps"
echo "  2. 查看容器日志:   docker compose logs"
echo "  3. 检查端口占用:   ss -tlnp | grep 80"
echo ""
exit 1
