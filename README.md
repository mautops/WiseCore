# Wisecore

Personal AI assistant. This README only covers **building and running the API container image**.

[中文版说明](README_zh.md)

**Stack** — API listens on **8088** (`WISECORE_PORT`). Web UI is **`next-console/`** (port **3000**), deployed separately; set `WISECORE_API_URL` to the API base URL.

---

## Prerequisites

- Docker

---

## Build

From the repository root, `make` (or `make build`) builds both Docker images: API (`src/Dockerfile`) and `next-console`. Use `make api` or `make console` to build one side only.

API image only:

```bash
docker build -f src/Dockerfile -t wisecore:local .
```

---

## Run with `docker run`

Example (replace the image name with the one you built or pulled):

```bash
docker run -d --name wisecore \
  -p 8088:8088 \
  -v wisecore-working:/app/working \
  -v wisecore-secrets:/app/working.secret \
  wisecore:local
```

To change the in-container port, set `WISECORE_PORT` and publish the same host port, for example:

```bash
docker run -d --name wisecore \
  -e WISECORE_PORT=3000 \
  -p 3000:3000 \
  -v wisecore-working:/app/working \
  -v wisecore-secrets:/app/working.secret \
  wisecore:local
```

Do **not** bind-mount a host directory onto the next-console image app directory (`/srv/next`; older images used `/app`) — it hides `server.js`.

---

## Optional environment variables

| Variable                  | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `WISECORE_PORT`              | Listen port inside the container (default `8088`).                                   |
| `WISECORE_DISABLED_CHANNELS` | Comma-separated channel types to disable (default includes `imessage` in the image). |
| `WISECORE_ENABLED_CHANNELS`  | If set, only these channels are enabled (whitelist).                                 |


---

---

## License

[Apache License 2.0](LICENSE).
