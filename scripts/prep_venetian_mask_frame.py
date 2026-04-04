#!/usr/bin/env python3
"""
Prepara venetian-mask.png:
- Quita fondo oscuro exterior (solo si los bordes son opacos y color uniforme tipo navy).
- Vacía el hueco facial (transparente + negro/blanco opaco en el interior) sin fugarse al exterior.
- Recorta al bbox del contenido; mantiene la relación de aspecto (p. ej. ligeramente horizontal).
"""

from __future__ import annotations

import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def _remove_edge_navy_if_any(a: np.ndarray) -> None:
    """Flood-fill desde bordes si hay un marco antiguo con esquinas opacas oscuras."""
    h, w = a.shape[:2]
    corners = np.vstack([a[0, 0], a[0, w - 1], a[h - 1, 0], a[h - 1, w - 1]])
    if np.median(corners[:, 3]) < 25:
        return
    ref = np.median(corners[:, :3], axis=0)
    if np.max(ref) > 95:
        return
    tol = 42

    def close_bg(px: np.ndarray) -> bool:
        r, g, b = px[:3]
        return max(abs(r - ref[0]), abs(g - ref[1]), abs(b - ref[2])) <= tol

    visited = np.zeros((h, w), dtype=np.uint8)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if visited[y, x]:
            continue
        visited[y, x] = 1
        if a[y, x, 3] == 0:
            continue
        if not close_bg(a[y, x]):
            continue
        a[y, x, 3] = 0
        a[y, x, :3] = 0
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                q.append((ny, nx))


def _punch_face_hole(a: np.ndarray) -> None:
    """BFS desde el centro, radio máximo; engloba transparente, negro y blanco del óvalo facial."""
    h, w = a.shape[:2]
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    r_max = 0.48 * min(w, h)

    def is_hole_like(px: np.ndarray) -> bool:
        r, g, b, al = int(px[0]), int(px[1]), int(px[2]), int(px[3])
        if al < 40:
            return True
        L = 0.299 * r + 0.587 * g + 0.114 * b
        sat = max(r, g, b) - min(r, g, b)
        if L < 56 and sat < 55:
            return True
        if L > 248 and sat < 22:
            return True
        return False

    vis = np.zeros((h, w), dtype=np.uint8)
    q: deque[tuple[int, int]] = deque()
    seed_r = 6
    for dy in range(-seed_r, seed_r + 1):
        for dx in range(-seed_r, seed_r + 1):
            y, x = int(cy + dy), int(cx + dx)
            if 0 <= y < h and 0 <= x < w and is_hole_like(a[y, x]):
                if math.hypot(x - cx, y - cy) <= r_max:
                    vis[y, x] = 1
                    q.append((y, x))
    if not q:
        y, x = int(cy), int(cx)
        if is_hole_like(a[y, x]):
            vis[y, x] = 1
            q.append((y, x))

    while q:
        y, x = q.popleft()
        a[y, x] = (0, 0, 0, 0)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if not (0 <= ny < h and 0 <= nx < w) or vis[ny, nx]:
                continue
            if math.hypot(nx - cx, ny - cy) > r_max:
                continue
            if is_hole_like(a[ny, nx]):
                vis[ny, nx] = 1
                q.append((ny, nx))


def _punch_dark_residual_ring(a: np.ndarray) -> None:
    """Elimina restos de negro opaco cerca del centro (anti-alias del hueco)."""
    h, w = a.shape[:2]
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    Y, X = np.mgrid[0:h, 0:w]
    inner = (X - cx) ** 2 + (Y - cy) ** 2 < (0.37 * min(w, h)) ** 2
    rf = a[:, :, 0].astype(np.float32)
    gf = a[:, :, 1].astype(np.float32)
    bf = a[:, :, 2].astype(np.float32)
    L = 0.299 * rf + 0.587 * gf + 0.114 * bf
    alpha = a[:, :, 3]
    dark = inner & (alpha > 190) & (L < 36)
    a[dark] = (0, 0, 0, 0)


def _tight_crop(a: np.ndarray, pad: int = 2) -> np.ndarray:
    alpha = a[:, :, 3]
    ys = np.where(np.any(alpha > 8, axis=1))[0]
    xs = np.where(np.any(alpha > 8, axis=0))[0]
    if len(ys) == 0 or len(xs) == 0:
        return a
    h, w = a.shape[:2]
    ymin, ymax = ys[0], ys[-1]
    xmin, xmax = xs[0], xs[-1]
    ymin = max(0, ymin - pad)
    ymax = min(h - 1, ymax + pad)
    xmin = max(0, xmin - pad)
    xmax = min(w - 1, xmax + pad)
    return a[ymin : ymax + 1, xmin : xmax + 1]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    dest = root / "src" / "assets" / "shop" / "venetian-mask.png"
    src = dest
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])

    im = Image.open(str(src)).convert("RGBA")
    a = np.array(im, copy=True)

    _remove_edge_navy_if_any(a)
    _punch_face_hole(a)
    _punch_dark_residual_ring(a)
    a = _tight_crop(a)

    dest = Path(dest)
    Image.fromarray(a, "RGBA").save(dest, "PNG", optimize=True)
    pub_path = root / "public" / "shop" / "venetian-mask.png"
    try:
        Image.fromarray(a, "RGBA").save(pub_path, "PNG", optimize=True)
    except OSError:
        pass
    ch, cw = a.shape[:2]
    print(dest, "->", f"{cw}x{ch}", f"w/h={cw / ch:.4f}")


if __name__ == "__main__":
    main()
