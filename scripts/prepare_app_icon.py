"""
Prepara public/pinguslove-icon.png:
1) Quita blanco conectado a los bordes (flood-fill).
2) Recorta al bbox del contenido (alpha).
3) Lienzo cuadrado centrado (aprovecha el máximo espacio sin deformar).
4) Redimensiona a OUT_SIZE (p. ej. 512) para manifest / favicons nítidos.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

OUT_SIZE = 512


def flood_remove_outer_white(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    def near_white(r: int, g: int, b: int) -> bool:
        return r >= 246 and g >= 246 and b >= 246

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        r, g, b, _a = px[x, y]
        if near_white(r, g, b) and not visited[y][x]:
            visited[y][x] = True
            q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r2, g2, b2, _a2 = px[nx, ny]
                if near_white(r2, g2, b2):
                    visited[ny][nx] = True
                    q.append((nx, ny))
    return img


def crop_to_alpha_bbox(img: Image.Image) -> Image.Image:
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox is None:
        return img
    return img.crop(bbox)


def pad_to_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = max(w, h)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x = (side - w) // 2
    y = (side - h) // 2
    out.paste(img, (x, y), img)
    return out


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    path = root / "public" / "pinguslove-icon.png"
    img = Image.open(path)
    img = flood_remove_outer_white(img)
    img = crop_to_alpha_bbox(img)
    img = pad_to_square(img)
    if OUT_SIZE > 0:
        img = img.resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)
    img.save(path, optimize=True)


if __name__ == "__main__":
    main()
