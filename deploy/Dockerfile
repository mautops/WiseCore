# -----------------------------------------------------------------------------
# CoPaw API runtime only. Web UI is next-console (separate image / compose service).
#
# Mirrors (mainland China):
#   - apt: Debian -> mirrors.aliyun.com (see RUN sed below).
#   - PyPI: UV_INDEX_URL -> Aliyun simple index (uv pip / wheel download).
# -----------------------------------------------------------------------------
FROM python:3.11-slim-bookworm

# uv static binary (pin digest/tag in CI if ghcr is slow; binary is tiny).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV WORKSPACE_DIR=/app
ENV COPAW_WORKING_DIR=/app/working
ENV COPAW_SECRET_DIR=/app/working.secret

# Channel filtering: use COPAW_DISABLED_CHANNELS (exclusion, recommended)
# or COPAW_ENABLED_CHANNELS (whitelist). Override at runtime with -e.
ARG COPAW_DISABLED_CHANNELS="imessage"
ENV COPAW_DISABLED_CHANNELS=${COPAW_DISABLED_CHANNELS}
ARG COPAW_ENABLED_CHANNELS=""
ENV COPAW_ENABLED_CHANNELS=${COPAW_ENABLED_CHANNELS}

ARG DEBIAN_FRONTEND=noninteractive

# Debian mirror: Aliyun (faster in mainland China). Covers bookworm .sources and legacy .list.
RUN set -eux; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
  sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
  sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
  fi; \
  if [ -f /etc/apt/sources.list ]; then \
  sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
  sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
  fi

RUN apt-get update && apt-get install -y --fix-missing \
  curl \
  build-essential \
  libssl-dev \
  git \
  supervisor \
  vim \
  gettext-base \
  xfce4 \
  xfce4-terminal \
  xvfb \
  dbus-x11 \
  fonts-wqy-zenhei \
  fonts-wqy-microhei \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

RUN apt-get update && apt-get install -y --fix-missing \
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

RUN sed -i 's/^CHROMIUM_FLAGS=""/CHROMIUM_FLAGS="--no-sandbox"/' /usr/bin/chromium

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV COPAW_RUNNING_IN_CONTAINER=1

# PyPI mirror for uv (wheel/source download). Also respected by pip-compatible tooling.
ENV UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple

WORKDIR ${WORKSPACE_DIR}

# Base image provides Python 3.11 at /usr/local/bin/python; no pip in runtime path.
RUN uv venv "${WORKSPACE_DIR}/venv" --python /usr/local/bin/python
ENV PATH="/app/venv/bin:$PATH"

COPY pyproject.toml setup.py README.md ./
COPY src ./src
RUN uv pip install --no-cache -e ".[ollama]"

RUN copaw init --defaults --accept-security

ENV COPAW_PORT=8088

COPY deploy/config/supervisord.conf.template /etc/supervisor/conf.d/supervisord.conf.template
COPY --chmod=755 deploy/entrypoint.sh /entrypoint.sh

EXPOSE 8088

CMD ["/entrypoint.sh"]
