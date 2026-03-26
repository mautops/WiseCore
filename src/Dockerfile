# ──────────────────────────────────────────────────────────────────────────────
# Wisecore API Dockerfile (多阶段构建)
#
# 构建命令: docker build -f src/Dockerfile -t wisecore:local .
# 推荐: make api
# ──────────────────────────────────────────────────────────────────────────────

# ── 阶段1: 基础镜像 (系统依赖) ───────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS base

# 安装 uv (快速 Python 包管理器)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 环境变量
ENV WORKSPACE_DIR=/app \
    WORKING_DIR=/app/working \
    SECRET_DIR=/app/working.secret \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    RUNNING_IN_CONTAINER=1 \
    UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple \
    PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple \
    PORT=8088 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 构建参数
ARG DISABLED_CHANNELS="imessage"
ARG ENABLED_CHANNELS=""
ARG DEBIAN_FRONTEND=noninteractive

# 设置环境变量
ENV DISABLED_CHANNELS=${DISABLED_CHANNELS} \
    ENABLED_CHANNELS=${ENABLED_CHANNELS}

# 配置国内镜像源 (加速下载)
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
        sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
        sed -i '|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi

# 安装系统依赖 (单层，利用缓存)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    curl \
    ca-certificates \
    # 编译依赖
    build-essential \
    libssl-dev \
    # Git (某些包需要)
    git \
    # 中文字体
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    # Chromium 依赖 (Playwright)
    chromium \
    chromium-sandbox \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libglib2.0-0 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    libu2f-udev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 配置 Chromium 无沙箱模式 (容器内必需)
RUN sed -i 's/^CHROMIUM_FLAGS=""/CHROMIUM_FLAGS="--no-sandbox"/' /usr/bin/chromium

WORKDIR ${WORKSPACE_DIR}

# ── 阶段2: 依赖安装 (缓存层) ──────────────────────────────────────────────────
FROM base AS deps

# 创建虚拟环境
RUN uv venv "${WORKSPACE_DIR}/venv" --python /usr/local/bin/python
ENV PATH="/app/venv/bin:$PATH"

# 仅复制依赖文件 (利用 Docker 缓存)
COPY pyproject.toml setup.py README.md ./

# 安装依赖 (这一层会被缓存，除非 pyproject.toml 变化)
RUN uv pip install --no-cache -e ".[ollama]" && \
    wisecore init --defaults --accept-security

# ── 阶段3: 生产镜像 ───────────────────────────────────────────────────────────
FROM deps AS production

# 复制源代码
COPY src ./src

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8088/api/health || exit 1

# 创建非 root 用户 (安全最佳实践)
RUN useradd --create-home --shell /bin/bash wisecore && \
    chown -R wisecore:wisecore /app
USER wisecore

EXPOSE 8088

# 启动命令
CMD ["sh", "-c", "exec wisecore app --host 0.0.0.0 --port ${PORT}"]