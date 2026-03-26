# Scripts

Run from **repo root**.

## Build wheel

```bash
bash scripts/wheel_build.sh
```

- Builds the Python wheel (API only; web UI is `next-console/` separately). Output: `dist/*.whl`.

## Build Docker image

```bash
bash scripts/docker_build.sh [IMAGE_TAG] [EXTRA_ARGS...]
```

- Default tag: `wisecore:latest`. Uses `src/Dockerfile` (API image only; web UI is `next-console/` separately).
- Example: `bash scripts/docker_build.sh myreg/wisecore:v1 --no-cache`.

## Run Test

```bash
# Run all tests
python scripts/run_tests.py

# Run all unit tests
python scripts/run_tests.py -u

# Run unit tests for a specific module
python scripts/run_tests.py -u providers

# Run integration tests
python scripts/run_tests.py -i

# Run all tests and generate a coverage report
python scripts/run_tests.py -a -c

# Run tests in parallel (requires pytest-xdist)
python scripts/run_tests.py -p

# Show help
python scripts/run_tests.py -h
```
