#!/usr/bin/env bash
# -*- coding: utf-8 -*-
#
# Wisecore 开发环境一键启动脚本
#
# 使用方法:
#   ./dev.sh [命令]
#
# 命令:
#   start       启动所有服务 (默认)
#   stop        停止所有服务
#   restart     重启所有服务
#   logs        查看日志
#   status      查看服务状态
#   db          仅启动数据库
#   backend     仅启动后端
#   frontend    仅启动前端
#   build       构建镜像
#   clean       清理所有容器和卷

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 默认配置
WISECORE_PORT="${WISECORE_PORT:-8088}"
NEXT_PORT="${NEXT_PORT:-3000}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# 日志函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查依赖
check_deps() {
    local missing=()

    command -v docker &>/dev/null || missing+=("docker")
    command -v uv &>/dev/null || missing+=("uv (pip install uv)")
    command -v pnpm &>/dev/null || missing+=("pnpm (npm install -g pnpm)")

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "缺少依赖: ${missing[*]}"
        exit 1
    fi
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # 端口被占用
    fi
    return 1  # 端口可用
}

wait_for_port() {
    local port=$1
    local service=$2
    local timeout=30
    local count=0

    log_info "等待 $service 启动 (端口 $port)..."
    while ! check_port $port; do
        sleep 1
        ((count++))
        if [ $count -ge $timeout ]; then
            log_error "$service 启动超时"
            return 1
        fi
    done
    log_info "$service 已就绪"
}

# 启动数据库
start_db() {
    log_info "启动 PostgreSQL 数据库..."
    docker compose -f "$PROJECT_ROOT/docker/dev/docker-compose.yaml" up -d postgres
    wait_for_port $POSTGRES_PORT "PostgreSQL"
}

# 启动后端
start_backend() {
    log_info "启动后端服务..."
    cd "$PROJECT_ROOT"

    # 检查虚拟环境
    if [ ! -d ".venv" ]; then
        log_info "创建虚拟环境..."
        uv venv
    fi

    # 安装依赖
    log_info "安装依赖..."
    uv pip install -e ".[dev]" 2>/dev/null || uv pip install -e .

    # 启动后端 (后台运行)
    uv run wisecore app --reload --port $WISECORE_PORT &
    echo $! > /tmp/wisecore-backend.pid

    wait_for_port $WISECORE_PORT "后端 API"
    log_info "后端 API: http://localhost:$WISECORE_PORT"
}

# 启动前端
start_frontend() {
    log_info "启动前端服务..."
    cd "$PROJECT_ROOT/next-console"

    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        log_info "安装前端依赖..."
        pnpm install
    fi

    # 启动前端 (后台运行)
    pnpm dev &
    echo $! > /tmp/wisecore-frontend.pid

    wait_for_port $NEXT_PORT "前端"
    log_info "前端 Console: http://localhost:$NEXT_PORT"
}

# 停止所有服务
stop_all() {
    log_info "停止所有服务..."

    # 停止前端
    if [ -f /tmp/wisecore-frontend.pid ]; then
        kill $(cat /tmp/wisecore-frontend.pid) 2>/dev/null || true
        rm -f /tmp/wisecore-frontend.pid
    fi

    # 停止后端
    if [ -f /tmp/wisecore-backend.pid ]; then
        kill $(cat /tmp/wisecore-backend.pid) 2>/dev/null || true
        rm -f /tmp/wisecore-backend.pid
    fi

    # 停止数据库
    docker compose -f "$PROJECT_ROOT/docker/dev/docker-compose.yaml" down 2>/dev/null || true

    log_info "所有服务已停止"
}

# 查看日志
show_logs() {
    echo "=== 后端日志 ==="
    if [ -f /tmp/wisecore-backend.pid ]; then
        # 简单提示，实际日志在终端
        log_info "后端正在运行 (PID: $(cat /tmp/wisecore-backend.pid))"
    fi

    echo ""
    echo "=== 前端日志 ==="
    if [ -f /tmp/wisecore-frontend.pid ]; then
        log_info "前端正在运行 (PID: $(cat /tmp/wisecore-frontend.pid))"
    fi

    echo ""
    echo "=== 数据库日志 ==="
    docker compose -f "$PROJECT_ROOT/docker/dev/docker-compose.yaml" logs postgres --tail=20
}

# 查看状态
show_status() {
    echo "=== 服务状态 ==="

    # 后端状态
    if check_port $WISECORE_PORT; then
        echo -e "后端 API: ${GREEN}运行中${NC} (http://localhost:$WISECORE_PORT)"
    else
        echo -e "后端 API: ${RED}未运行${NC}"
    fi

    # 前端状态
    if check_port $NEXT_PORT; then
        echo -e "前端 Console: ${GREEN}运行中${NC} (http://localhost:$NEXT_PORT)"
    else
        echo -e "前端 Console: ${RED}未运行${NC}"
    fi

    # 数据库状态
    if docker compose -f "$PROJECT_ROOT/docker/dev/docker-compose.yaml" ps postgres 2>/dev/null | grep -q "running"; then
        echo -e "PostgreSQL: ${GREEN}运行中${NC} (localhost:$POSTGRES_PORT)"
    else
        echo -e "PostgreSQL: ${RED}未运行${NC}"
    fi
}

# 构建镜像
build_images() {
    log_info "构建 Docker 镜像..."
    cd "$PROJECT_ROOT"
    make build
    log_info "镜像构建完成"
}

# 清理
clean_all() {
    log_warn "这将删除所有容器、卷和临时文件"
    read -p "确定要继续吗? [y/N] " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "已取消"
        exit 0
    fi

    stop_all

    log_info "清理 Docker 资源..."
    docker compose -f "$PROJECT_ROOT/docker/dev/docker-compose.yaml" down -v 2>/dev/null || true
    docker compose -f "$PROJECT_ROOT/docker/docker-compose.yaml" down -v 2>/dev/null || true

    rm -f /tmp/wisecore-*.pid

    log_info "清理完成"
}

# 主入口
main() {
    local cmd="${1:-start}"

    case "$cmd" in
        start)
            check_deps
            start_db
            start_backend
            start_frontend
            echo ""
            log_info "=========================================="
            log_info "  开发环境已启动!"
            log_info "  后端 API:  http://localhost:$WISECORE_PORT"
            log_info "  前端:      http://localhost:$NEXT_PORT"
            log_info "  数据库:    localhost:$POSTGRES_PORT"
            log_info "=========================================="
            ;;
        stop)
            stop_all
            ;;
        restart)
            stop_all
            sleep 2
            $0 start
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        db)
            check_deps
            start_db
            ;;
        backend)
            check_deps
            start_backend
            ;;
        frontend)
            check_deps
            start_frontend
            ;;
        build)
            build_images
            ;;
        clean)
            clean_all
            ;;
        *)
            echo "使用方法: $0 {start|stop|restart|logs|status|db|backend|frontend|build|clean}"
            exit 1
            ;;
    esac
}

main "$@"