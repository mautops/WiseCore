.DEFAULT_GOAL := build

# ──────────────────────────────────────────────────────────────────────────────
# 配置
# ──────────────────────────────────────────────────────────────────────────────

# Docker 平台 (跨平台构建)
DOCKER_PLATFORM ?= linux/amd64

# 镜像仓库 (可选，留空则使用本地)
DOCKER_REGISTRY ?=
_IMAGE_PREFIX = $(if $(DOCKER_REGISTRY),$(DOCKER_REGISTRY)/,)

# 镜像标签 (支持 make api v0.0.3 格式)
API_VER := $(if $(filter api,$(firstword $(MAKECMDGOALS))),$(word 2,$(MAKECMDGOALS)),)
CONSOLE_VER := $(if $(filter console,$(firstword $(MAKECMDGOALS))),$(word 2,$(MAKECMDGOALS)),)

# 镜像名称
IMAGE_NAME ?= wisecore
IMAGE_TAG ?= $(_IMAGE_PREFIX)$(IMAGE_NAME):$(if $(API_VER),$(API_VER),local)

NEXT_IMAGE_NAME ?= wisecore-console
NEXT_IMAGE_TAG ?= $(_IMAGE_PREFIX)$(NEXT_IMAGE_NAME):$(if $(CONSOLE_VER),$(CONSOLE_VER),local)

# 端口配置
PORT ?= 8088
NEXT_PORT ?= 3000
POSTGRES_PORT ?= 5432

# ──────────────────────────────────────────────────────────────────────────────
# 构建目标
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: build api console dev-db dev stop clean help

# 默认: 构建所有镜像
build: api console

# 构建 API 镜像
api:
	@echo "构建 API 镜像: $(IMAGE_TAG)"
	docker build --platform $(DOCKER_PLATFORM) -f src/Dockerfile -t $(IMAGE_TAG) .

# 构建前端镜像
console:
	@echo "构建前端镜像: $(NEXT_IMAGE_TAG)"
	docker build --platform $(DOCKER_PLATFORM) -f next-console/Dockerfile -t $(NEXT_IMAGE_TAG) next-console

# ──────────────────────────────────────────────────────────────────────────────
# 开发环境
# ──────────────────────────────────────────────────────────────────────────────

# 启动开发数据库
dev-db:
	@echo "启动 PostgreSQL 数据库..."
	docker compose -f docker/dev/docker-compose.yaml up -d postgres
	@echo "数据库已启动: localhost:$(POSTGRES_PORT)"

# 停止开发数据库
dev-db-stop:
	docker compose -f docker/dev/docker-compose.yaml down

# 一键启动开发环境 (使用脚本)
dev:
	@chmod +x docker/dev.sh
	@./docker/dev.sh start

# 停止开发环境
stop:
	@chmod +x docker/dev.sh
	@./docker/dev.sh stop

# 查看开发环境状态
status:
	@chmod +x docker/dev.sh
	@./docker/dev.sh status

# ──────────────────────────────────────────────────────────────────────────────
# Docker Compose 部署
# ──────────────────────────────────────────────────────────────────────────────

# 启动所有服务 (生产环境)
up:
	docker compose -f docker/docker-compose.yaml --profile full up -d

# 停止所有服务
down:
	docker compose -f docker/docker-compose.yaml down

# 查看日志
logs:
	docker compose -f docker/docker-compose.yaml logs -f

# 仅启动 API
up-api:
	docker compose -f docker/docker-compose.yaml --profile api-only up -d

# 仅启动前端
up-console:
	docker compose -f docker/docker-compose.yaml --profile console-only up -d

# ──────────────────────────────────────────────────────────────────────────────
# 清理
# ──────────────────────────────────────────────────────────────────────────────

# 清理构建缓存和无用镜像
clean:
	@echo "清理 Docker 资源..."
	docker compose -f docker/docker-compose.yaml down -v 2>/dev/null || true
	docker compose -f docker/dev/docker-compose.yaml down -v 2>/dev/null || true
	docker image prune -f
	@echo "清理完成"

# 深度清理 (包含镜像)
clean-all: clean
	docker image rm $(IMAGE_TAG) 2>/dev/null || true
	docker image rm $(NEXT_IMAGE_TAG) 2>/dev/null || true

# ──────────────────────────────────────────────────────────────────────────────
# 推送镜像
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: push push-api push-console

push: push-api push-console

push-api:
	docker push $(IMAGE_TAG)

push-console:
	docker push $(NEXT_IMAGE_TAG)

# ──────────────────────────────────────────────────────────────────────────────
# 帮助
# ──────────────────────────────────────────────────────────────────────────────

help:
	@echo "Wisecore 构建命令:"
	@echo ""
	@echo "  构建:"
	@echo "    make build         构建所有镜像 (API + Console)"
	@echo "    make api           构建 API 镜像"
	@echo "    make console       构建前端镜像"
	@echo "    make api v0.1.0    构建指定版本的 API 镜像"
	@echo ""
	@echo "  开发环境:"
	@echo "    make dev           一键启动开发环境"
	@echo "    make stop          停止开发环境"
	@echo "    make status        查看服务状态"
	@echo "    make dev-db        启动开发数据库"
	@echo ""
	@echo "  部署:"
	@echo "    make up            启动所有服务 (Docker Compose)"
	@echo "    make down          停止所有服务"
	@echo "    make logs          查看日志"
	@echo ""
	@echo "  清理:"
	@echo "    make clean         清理 Docker 资源"
	@echo "    make clean-all     深度清理 (包含镜像)"
	@echo ""
	@echo "  推送:"
	@echo "    make push          推送所有镜像到仓库"
	@echo "    make push-api      推送 API 镜像"
	@echo "    make push-console  推送前端镜像"
	@echo ""
	@echo "  环境变量:"
	@echo "    DOCKER_REGISTRY    镜像仓库地址"
	@echo "    DOCKER_PLATFORM    构建平台 (默认: linux/amd64)"
	@echo "    PORT         API 端口 (默认: 8088)"
	@echo "    NEXT_PORT          前端端口 (默认: 3000)"

# 吸收版本参数，避免 make console v0.0.3 报错
%:
	@: