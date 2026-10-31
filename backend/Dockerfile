# Oqtekal OCR backend - FastAPI + OpenCV + EasyOCR (CPU)
FROM python:3.11-slim

WORKDIR /app

# OpenCV/EasyOCR runtime deps (headless - no X11/GL needed beyond these shared libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Each package is its own RUN layer (rather than one `pip install -r requirements.txt`)
# so that on a slow/flaky connection, a timed-out layer only needs that one package
# retried on rebuild - Docker caches every package that already installed successfully.
# Generous timeout since some wheels (opencv, pymupdf, torch) are tens of MB each.
ENV PIP_DEFAULT_TIMEOUT=300 PIP_RETRIES=15 PIP_NO_CACHE_DIR=1

# torch's own .whl (174MB) is the single biggest point of failure on a slow link, so it's
# pre-fetched (see README: scripts/fetch_torch_wheels.sh) and copied in locally rather than
# re-downloaded on every build attempt. --find-links checks here first, falls back to PyPI
# for torch's smaller sub-dependencies (sympy, networkx, etc).
COPY wheels/ /tmp/wheels/
# --no-index --no-deps forces pip to use ONLY the local wheel for the package itself
# (no network at all for this step); a second pass then resolves just the handful of
# small pure-Python deps (sympy, networkx, jinja2, etc) from the index - torch/torchvision
# themselves are already satisfied locally so they are not re-downloaded.
RUN if [ -f /tmp/wheels/torch-2.5.1+cpu-cp311-cp311-linux_x86_64.whl ]; then \
        pip install --no-index --no-deps /tmp/wheels/torch-2.5.1+cpu-cp311-cp311-linux_x86_64.whl; \
    fi
RUN if [ -f /tmp/wheels/torchvision-0.20.1+cpu-cp311-cp311-linux_x86_64.whl ]; then \
        pip install --no-index --no-deps /tmp/wheels/torchvision-0.20.1+cpu-cp311-cp311-linux_x86_64.whl; \
    fi
RUN pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
RUN rm -rf /tmp/wheels

RUN pip install fastapi==0.115.6
RUN pip install "uvicorn[standard]"==0.34.0
RUN pip install python-multipart==0.0.20
RUN pip install pydantic==2.10.4
RUN pip install pydantic-settings==2.7.1
RUN pip install numpy==1.26.4
RUN pip install opencv-python-headless==4.10.0.84
RUN pip install Pillow==11.0.0
RUN pip install pymupdf==1.25.1
RUN pip install easyocr==1.7.2
RUN pip install pytest==8.3.4
RUN pip install httpx==0.28.1
RUN pip install sqlalchemy==2.0.36
RUN pip install alembic==1.14.0
RUN pip install bcrypt==4.0.1
RUN pip install "passlib[bcrypt]"==1.7.4
RUN pip install "python-jose[cryptography]"==3.3.0

COPY . .

RUN mkdir -p /app/storage /data

ENV DATABASE_URL=sqlite:////data/oqtekal.db \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# EasyOCR downloads its model weights to ~/.EasyOCR on first use and caches them there;
# mount that path as a volume (see docker-compose.yml) so it survives container restarts.
# Single worker: SQLite is a single-writer file lock, so extra uvicorn workers would only
# race each other (e.g. on CREATE TABLE at startup) rather than add real concurrency.
# Swap DATABASE_URL to Postgres and raise --workers if/when this needs to scale beyond one process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
