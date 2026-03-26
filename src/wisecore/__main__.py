# -*- coding: utf-8 -*-
"""Allow running the module via ``python -m wisecore``."""

from .cli.main import cli

if __name__ == "__main__":
    cli()  # pylint: disable=no-value-for-parameter
