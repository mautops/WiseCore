#!/usr/bin/env bash
# Wisecore Installer
# Usage: curl -fsSL <url>/install.sh | bash
#    or: bash install.sh [--version X.Y.Z] [--from-source]
#
# Installs Wisecore into ~/.wisecore with a uv-managed Python environment.
# Users do NOT need Python pre-installed — uv handles everything.
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    BOLD="\033[1m"
    GREEN="\033[0;32m"
    YELLOW="\033[0;33m"
    RED="\033[0;31m"
    RESET="\033[0m"
else
    BOLD="" GREEN="" YELLOW="" RED="" RESET=""
fi

info()  { printf "${GREEN}[wisecore]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[wisecore]${RESET} %s\n" "$*"; }
error() { printf "${RED}[wisecore]${RESET} %s\n" "$*" >&2; }
die()   { error "$@"; exit 1; }

# ── Defaults ──────────────────────────────────────────────────────────────────
WISECORE_HOME="${WISECORE_HOME:-$HOME/.wisecore}"
WISECORE_VENV="$WISECORE_HOME/venv"
WISECORE_BIN="$WISECORE_HOME/bin"
PYTHON_VERSION="3.12"
WISECORE_REPO="https://github.com/agentscope-ai/Wisecore.git"

# New: Intelligent selection of PyPI source (automatically using Alibaba Cloud mirror for domestic users, and official source for overseas users)
choose_pypi_mirror() {
    # Test the connectivity of the official PyPI source (timeout 3 seconds, no output)
    if curl -s --connect-timeout 3 https://pypi.org/simple/ > /dev/null 2>&1; then
        echo "https://pypi.org/simple/"
        info "Using official PyPI source (network is good)" >&2
    else
        echo "https://mirrors.aliyun.com/pypi/simple/"
        info "Using Aliyun PyPI mirror (official source is unreachable)" >&2
    fi
}
PYPI_MIRROR=$(choose_pypi_mirror)

# New: Automatically clear old virtual environments and skip interactive prompts
export UV_VENV_CLEAR=1




VERSION=""
FROM_SOURCE=false
SOURCE_DIR=""
EXTRAS=""

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            VERSION="$2"; shift 2 ;;
        --from-source)
            FROM_SOURCE=true
            # Accept optional path argument (next arg that doesn't start with --)
            if [[ $# -ge 2 && "$2" != --* ]]; then
                SOURCE_DIR="$(cd "$2" && pwd)" || die "Directory not found: $2"
                shift
            fi
            shift ;;
        --extras)
            EXTRAS="$2"; shift 2 ;;
        -h|--help)
            cat <<EOF
Wisecore Installer

Usage: bash install.sh [OPTIONS]

Options:
  --version <VER>       Install a specific version (e.g. 0.0.2)
  --from-source [DIR]   Install from source. If DIR is given, use that local
                        directory; otherwise clone from GitHub.
  --extras <EXTRAS>     Comma-separated optional extras to install
                        (e.g. llamacpp, mlx, llamacpp,mlx)
  -h, --help            Show this help

Environment:
  WISECORE_HOME        Installation directory (default: ~/.wisecore)
EOF
            exit 0 ;;
        *)
            die "Unknown option: $1 (try --help)" ;;
    esac
done

# ── OS check ──────────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
    Linux|Darwin) ;;
    *) die "Unsupported OS: $OS. This installer supports Linux and macOS only." ;;
esac

printf "${GREEN}[wisecore]${RESET} Installing Wisecore into ${BOLD}%s${RESET}\n" "$WISECORE_HOME"

# ── Step 1: Ensure uv is available ───────────────────────────────────────────
ensure_uv() {
    if command -v uv &>/dev/null; then
        info "uv found: $(command -v uv)"
        return
    fi

    # Check common install locations not yet on PATH
    for candidate in "$HOME/.local/bin/uv" "$HOME/.cargo/bin/uv"; do
        if [ -x "$candidate" ]; then
            export PATH="$(dirname "$candidate"):$PATH"
            info "uv found: $candidate"
            return
        fi
    done

    info "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh

    # Source the env file uv's installer creates, or add common paths
    if [ -f "$HOME/.local/bin/env" ]; then
        # shellcheck disable=SC1091
        . "$HOME/.local/bin/env"
    fi
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

    command -v uv &>/dev/null || die "Failed to install uv. Please install it manually: https://docs.astral.sh/uv/"
    info "uv installed successfully"
}

ensure_uv

# ── Step 2: Create / update virtual environment ──────────────────────────────
if [ -d "$WISECORE_VENV" ]; then
    info "Existing environment found, upgrading..."
else
    info "Creating Python $PYTHON_VERSION environment..."
fi

uv venv "$WISECORE_VENV" --python "$PYTHON_VERSION" --quiet

# Verify the venv was created
[ -x "$WISECORE_VENV/bin/python" ] || die "Failed to create virtual environment"
info "Python environment ready ($("$WISECORE_VENV/bin/python" --version))"

# ── Step 3: Install Wisecore ────────────────────────────────────────────────────
# Build extras suffix: "" or "[llamacpp,mlx]"
EXTRAS_SUFFIX=""
if [ -n "$EXTRAS" ]; then
    EXTRAS_SUFFIX="[$EXTRAS]"
fi

if [ "$FROM_SOURCE" = true ]; then
    if [ -n "$SOURCE_DIR" ]; then
        info "Installing Wisecore from local source: $SOURCE_DIR"
        info "Installing package from source..."
        uv pip install "${SOURCE_DIR}${EXTRAS_SUFFIX}" --python "$WISECORE_VENV/bin/python" --prerelease=allow --index-url "$PYPI_MIRROR"
    else
        info "Installing Wisecore from source (GitHub)..."
        CLONE_DIR="$(mktemp -d)"
        trap 'rm -rf "$CLONE_DIR"' EXIT
        git clone --depth 1 "$WISECORE_REPO" "$CLONE_DIR"
        info "Installing package from source..."
        uv pip install "${CLONE_DIR}${EXTRAS_SUFFIX}" --python "$WISECORE_VENV/bin/python" --prerelease=allow --index-url "$PYPI_MIRROR"
    fi
else
    PACKAGE="wisecore"
    if [ -n "$VERSION" ]; then
        PACKAGE="wisecore==$VERSION"
    fi

    info "Installing ${PACKAGE}${EXTRAS_SUFFIX} from PyPI..."
    uv pip install "${PACKAGE}${EXTRAS_SUFFIX}" --python "$WISECORE_VENV/bin/python" --prerelease=allow --quiet --index-url "$PYPI_MIRROR" --refresh-package wisecore
fi

# Verify the CLI entry point exists
[ -x "$WISECORE_VENV/bin/wisecore" ] || die "Installation failed: wisecore CLI not found in venv"
info "Wisecore installed successfully"

# ── Step 4: Create wrapper script ────────────────────────────────────────────
mkdir -p "$WISECORE_BIN"

cat > "$WISECORE_BIN/wisecore" << 'WRAPPER'
#!/usr/bin/env bash
# Wisecore CLI wrapper — delegates to the uv-managed environment.
set -euo pipefail

WISECORE_HOME="${WISECORE_HOME:-$HOME/.wisecore}"
REAL_BIN="$WISECORE_HOME/venv/bin/wisecore"

if [ ! -x "$REAL_BIN" ]; then
    echo "Error: Wisecore environment not found at $WISECORE_HOME/venv" >&2
    echo "Please reinstall: curl -fsSL <install-url> | bash" >&2
    exit 1
fi

exec "$REAL_BIN" "$@"
WRAPPER

chmod +x "$WISECORE_BIN/wisecore"
info "Wrapper created at $WISECORE_BIN/wisecore"

# ── Step 5: Update PATH in shell profile ─────────────────────────────────────
PATH_ENTRY="export PATH=\"\$HOME/.wisecore/bin:\$PATH\""

add_to_profile() {
    local profile="$1"
    if [ -f "$profile" ] && grep -qF '.wisecore/bin' "$profile"; then
        return 0  # already present
    fi
    if [ -f "$profile" ] || [ "$2" = "create" ]; then
        printf '\n# Wisecore\n%s\n' "$PATH_ENTRY" >> "$profile"
        info "Updated $profile"
        return 0
    fi
    return 1
}

UPDATED_PROFILE=false

case "$OS" in
    Darwin)
        add_to_profile "$HOME/.zshrc" "create" && UPDATED_PROFILE=true
        # Also update bash profile if it exists
        add_to_profile "$HOME/.bash_profile" "no-create" || true
        ;;
    Linux)
        add_to_profile "$HOME/.bashrc" "create" && UPDATED_PROFILE=true
        # Also update zshrc if it exists
        add_to_profile "$HOME/.zshrc" "no-create" || true
        ;;
esac

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
printf "${GREEN}${BOLD}Wisecore installed successfully!${RESET}\n"
echo ""

# Install summary
printf "  Install location:  ${BOLD}%s${RESET}\n" "$WISECORE_HOME"
printf "  Python:            ${BOLD}%s${RESET}\n" "$("$WISECORE_VENV/bin/python" --version 2>&1)"
echo ""

if [ "$UPDATED_PROFILE" = true ]; then
    echo "To get started, open a new terminal or run:"
    echo ""
    printf "  ${BOLD}source ~/.zshrc${RESET}  # or ~/.bashrc\n"
    echo ""
fi

echo "Then run:"
echo ""
printf "  ${BOLD}wisecore init${RESET}       # first-time setup\n"
printf "  ${BOLD}wisecore app${RESET}        # start Wisecore\n"
echo ""
printf "To upgrade later, re-run this installer.\n"
printf "To uninstall, run: ${BOLD}wisecore uninstall${RESET}\n"
