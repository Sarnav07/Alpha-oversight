#!/usr/bin/env bash
# Render every report/figures/*.drawio -> cropped vector PDF (for LaTeX), then
# compile the report. Fig 1 is also exported as PNG@3x + SVG into frontend/public
# for the landing-page hero.
#
# Needs: the drawio-desktop binary extracted at $DRAWIO_APPDIR (default
# /tmp/squashfs-root) + xvfb-run. To (re)obtain it:
#   cd /tmp && curl -L -o drawio.AppImage \
#     https://github.com/jgraph/drawio-desktop/releases/download/v30.0.4/drawio-x86_64-30.0.4.AppImage
#   chmod +x drawio.AppImage && ./drawio.AppImage --appimage-extract   # -> /tmp/squashfs-root
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APPDIR="${DRAWIO_APPDIR:-/tmp/squashfs-root}"
if [ ! -x "$APPDIR/drawio" ]; then
  echo "ERROR: drawio binary not found at $APPDIR/drawio (see header for how to extract it)." >&2
  exit 1
fi
export LD_LIBRARY_PATH="$APPDIR/usr/lib:${LD_LIBRARY_PATH:-}"
DRAWIO=(xvfb-run -a "$APPDIR/drawio")
COMMON=(-x --crop --no-sandbox --disable-gpu --disable-dev-shm-usage)

echo "== rendering figures =="
shopt -s nullglob
for f in "$HERE"/figures/*.drawio; do
  base="$(basename "${f%.drawio}")"
  "${DRAWIO[@]}" "${COMMON[@]}" -f pdf -o "$HERE/figures/$base.pdf" "$f" >/dev/null 2>&1
  echo "  rendered figures/$base.pdf"
done

# Fig 1 -> landing-page assets (PNG @3x + SVG)
PUB="$HERE/../frontend/public"
FIG1="$HERE/figures/01-architecture.drawio"
if [ -f "$FIG1" ] && [ -d "$PUB" ]; then
  "${DRAWIO[@]}" "${COMMON[@]}" -f png -s 3 -o "$PUB/architecture.png" "$FIG1" >/dev/null 2>&1
  "${DRAWIO[@]}" "${COMMON[@]}" -f svg       -o "$PUB/architecture.svg" "$FIG1" >/dev/null 2>&1
  echo "  exported $PUB/architecture.{png,svg}"
fi

echo "== compiling report =="
cd "$HERE"
pdflatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null 2>&1
pdflatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null 2>&1
echo "done: $HERE/main.pdf"
pdfinfo main.pdf 2>/dev/null | grep -E "Pages|Page size" || true
