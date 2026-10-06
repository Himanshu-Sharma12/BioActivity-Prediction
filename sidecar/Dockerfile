# Optional RDKit sidecar for BioPredictSafety.
# The Node app runs fine without this image; it only unlocks the full FilterCatalog,
# QED and Murcko scaffolds, which RDKit's WASM MinimalLib build cannot provide.
FROM python:3.12-slim

# RDKit's manylinux wheels need libXrender/libXext for the drawing code paths.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libxrender1 libxext6 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copied first so dependency layers are cached independently of the source.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Do not run as root.
RUN useradd --create-home --uid 10001 sidecar
USER sidecar

EXPOSE 8000

# Single worker by default: the FilterCatalog is ~960 compiled SMARTS patterns held
# in memory per process. Scale with replicas, or set WEB_CONCURRENCY deliberately.
ENV PYTHONUNBUFFERED=1
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status==200 else 1)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
