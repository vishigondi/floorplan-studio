#!/usr/bin/env python3
"""Tile the visual-sweep captures into contact sheets so a whole matrix can be
looked at in one view instead of one plan at a time.

Usage: python3 scripts/contact-sheet.py <kind> [cols] [out]
       kind = plan | elevations | 3d
"""
import sys, glob, os
from PIL import Image, ImageDraw

kind = sys.argv[1] if len(sys.argv) > 1 else "plan"
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, ".qa-shots", "sweep")
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(src, f"contact-{kind}.png")

files = sorted(glob.glob(os.path.join(src, f"*--{kind}.png")))
if not files:
    sys.exit(f"no {kind} captures in {src}")

CELL_W, CELL_H, LABEL = 460, 460, 22
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * CELL_W, rows * (CELL_H + LABEL)), "white")
draw = ImageDraw.Draw(sheet)

for i, path in enumerate(files):
    img = Image.open(path).convert("RGB")
    img.thumbnail((CELL_W - 8, CELL_H - 8))
    cx = (i % cols) * CELL_W
    cy = (i // cols) * (CELL_H + LABEL)
    sheet.paste(img, (cx + (CELL_W - img.width) // 2, cy + LABEL + (CELL_H - img.height) // 2))
    name = os.path.basename(path).replace(f"--{kind}.png", "")
    draw.text((cx + 6, cy + 5), name, fill="black")
    draw.rectangle([cx, cy, cx + CELL_W - 1, cy + CELL_H + LABEL - 1], outline="#cccccc")

sheet.save(out)
print(f"{len(files)} {kind} captures -> {out} ({sheet.width}x{sheet.height})")
