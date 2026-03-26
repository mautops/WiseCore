# ──────────────────────────────────────────────────────────────────────────────
# Wisecore Console (Next.js) Dockerfile
#
# 构建命令: docker build -f next-console/Dockerfile -t wisecore-console:local next-console
# 推荐: make console
# ──────────────────────────────────────────────────────────────────────────────

# ── 阶段1: 基础镜像 ────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

# 启用 pnpm
RUN corepack enable pnpm

# ── 阶段2: 依赖安装 ────────────────────────────────────────────────────────────
FROM base AS deps

# 安装编译依赖 (某些原生模块需要)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 仅复制依赖文件 (利用 Docker 缓存)
COPY package.json pnpm-lock.yaml* ./

# 安装依赖 (包含 devDependencies，构建需要)
RUN pnpm install --frozen-lockfile

# ── 阶段3: 构建 ────────────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# 复制源代码
COPY . .

# 构建配置
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建 Next.js 应用
RUN pnpm build

# ── 阶段4: 生产镜像 (最小化) ──────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /srv/next

# 生产环境配置
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建非 root 用户 (安全最佳实践)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制静态资源
COPY --from=builder /app/public ./public

# 复制 standalone 输出 (Next.js 自动包含所需依赖)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 验证必需文件存在
RUN test -f server.js && test -f package.json

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

USER nextjs

EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]