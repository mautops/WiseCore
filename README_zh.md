# Wisecore

个人 AI 助理. 本文仅说明 **如何构建与运行 API 容器镜像**.

[English README](README.md)

**架构** — API 默认监听 **8088** (`WISECORE_PORT`). Web 控制台在 **`next-console/`** (端口 **3000**), 单独部署; 通过 `WISECORE_API_URL` 指向 API 根地址.

---

## 环境要求

- Docker

---

## 构建

在仓库根目录执行 `make` 或 `make build` 会依次构建后端 API 镜像与前端 `next-console` 容器镜像. 仅构建其一可用 `make api` 或 `make console`.

仅构建 API 镜像:

```bash
docker build -f src/Dockerfile -t wisecore:local .
```

---

## 使用 `docker run` 运行

将镜像名换成你本地构建或从仓库拉取的名称:

```bash
docker run -d --name wisecore \
  -p 8088:8088 \
  -v wisecore-working:/app/working \
  -v wisecore-secrets:/app/working.secret \
  wisecore:local
```

修改容器内监听端口时, 同时设置 `WISECORE_PORT` 并映射对应主机端口, 例如:

```bash
docker run -d --name wisecore \
  -e WISECORE_PORT=3000 \
  -p 3000:3000 \
  -v wisecore-working:/app/working \
  -v wisecore-secrets:/app/working.secret \
  wisecore:local
```

**不要**把主机目录绑定挂载到 next-console 镜像的应用目录 (镜像内为 `/srv/next`, 旧镜像为 `/app`), 否则会盖住 `server.js`.

---

## 可选环境变量

| 变量                      | 说明                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `WISECORE_PORT`              | 容器内监听端口 (默认 `8088`).                                      |
| `WISECORE_DISABLED_CHANNELS` | 禁用的频道类型列表, 逗号分隔 (镜像默认包含对 `imessage` 等的处理). |
| `WISECORE_ENABLED_CHANNELS`  | 若设置, 仅启用列表中的频道 (白名单).                               |

---

## 许可证

[Apache License 2.0](LICENSE).
