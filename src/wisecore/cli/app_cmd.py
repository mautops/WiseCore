# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import os

import click
import uvicorn

from ..constant import LOG_LEVEL_ENV
from ..config.utils import write_last_api
from ..utils.logging import setup_logger, SuppressPathAccessLogFilter


def _parse_listen_port(value: object) -> int:
    """Parse ``PORT``: int or Kubernetes-style ``tcp://ip:port``."""
    if isinstance(value, int):
        p = value
    else:
        s = str(value).strip()
        if s.startswith("tcp://"):
            s = s.rsplit(":", 1)[-1]
            s = s.split("/")[0]
        try:
            p = int(s)
        except ValueError as e:
            raise click.BadParameter(f"{value!r} is not a valid port") from e
    if not 1 <= p <= 65535:
        raise click.BadParameter(f"{p} is not in 1..65535")
    return p


class _ListenPortParamType(click.ParamType):
    name = "port"

    def convert(self, value, param, ctx):
        return _parse_listen_port(value)


def _default_listen_port() -> int:
    raw = os.environ.get("PORT", "").strip()
    if not raw:
        return 8088
    return _parse_listen_port(raw)


@click.command("app")
@click.option(
    "--host",
    default="127.0.0.1",
    show_default=True,
    help="Bind host",
)
@click.option(
    "--port",
    default=lambda: _default_listen_port(),
    type=_ListenPortParamType(),
    show_default=True,
    help=("Bind port; reads PORT env; tcp://host:port form ok (e.g. k8s)"),
)
@click.option("--reload", is_flag=True, help="Enable auto-reload (dev only)")
@click.option(
    "--workers",
    default=1,
    type=int,
    show_default=True,
    help="Worker processes",
)
@click.option(
    "--log-level",
    default="info",
    type=click.Choice(
        ["critical", "error", "warning", "info", "debug", "trace"],
        case_sensitive=False,
    ),
    show_default=True,
    help="Log level",
)
@click.option(
    "--hide-access-paths",
    multiple=True,
    default=("/console/push-messages",),
    show_default=True,
    help="Path substrings to hide from uvicorn access log (repeatable).",
)
def app_cmd(
    host: str,
    port: int,
    reload: bool,
    workers: int,
    log_level: str,
    hide_access_paths: tuple[str, ...],
) -> None:
    """Run Wisecore FastAPI app."""
    # Persist last used host/port for other terminals
    if host == "0.0.0.0":
        write_last_api("127.0.0.1", port)
    else:
        write_last_api(host, port)
    os.environ[LOG_LEVEL_ENV] = log_level

    # Signal reload mode to browser_control.py for Windows
    # compatibility: use sync Playwright + ThreadPool only when reload=True
    if reload:
        os.environ["RELOAD_MODE"] = "1"
    else:
        os.environ.pop("RELOAD_MODE", None)

    setup_logger(log_level)
    if log_level in ("debug", "trace"):
        from .main import log_init_timings

        log_init_timings()

    paths = [p for p in hide_access_paths if p]
    if paths:
        logging.getLogger("uvicorn.access").addFilter(
            SuppressPathAccessLogFilter(paths),
        )

    uvicorn.run(
        "wisecore.app._app:app",
        host=host,
        port=port,
        reload=reload,
        workers=workers,
        log_level=log_level,
    )
