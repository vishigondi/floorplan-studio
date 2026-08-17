#!/usr/bin/env python3
"""Measure Skylark 150's roof pitches from the real WikiHouse geometry.

The pitch angles are NOT in the nested DXF cut sheets (those are flat parts) and
they are not stated in the repo's text. They ARE in the detailed 3DM assemblies,
so this script downloads the six roof blocks from a PINNED commit and measures
them, rather than anyone guessing from the "-42" in a filename.

Method: read every Brep edge, keep the straight ones longer than 150 mm that run
in the building's XZ section plane, and bin them by angle weighted by length. A
roof block's dominant non-vertical angle IS its pitch — for R-L-42, 85.6% of all
in-plane edge length lies at exactly 42.0 deg.

The measurements are committed in lib/kit/skylark.ts. This script exists so the
claim is reproducible and so a future Skylark release can be re-measured; it is
not part of the gate ladder (it needs network and ~70 MB of downloads), and the
WikiHouse files are NOT vendored into this repo (1.2 GB, CC BY-SA 4.0).

Usage: pip install rhino3dm && python3 scripts/measure-skylark-pitch.py
"""
import json
import math
import os
import subprocess
import sys
import tempfile
from collections import defaultdict

# Pinned so a re-run measures the same geometry this repo's constants came from.
COMMIT = "6581cc1de0f4daef81a6b5c5a2eaed3c537d1d8f"
BLOCKS = ["R-L", "R-L-42", "R-S", "R-S-42", "R-XXS", "R-XXS-42"]
URL = ("https://raw.githubusercontent.com/wikihouseproject/Skylark/"
       f"{COMMIT}/SKYLARK150/Roofs/{{b}}/{{b}}_detailed/{{b}}.3dm")

MIN_EDGE_MM = 150.0      # ignore joinery detail; we want structural members
STRAIGHTNESS_MM = 1.0    # midpoint-to-chord tolerance


def straight_edges(brep):
    for edge in brep.Edges:
        curve = edge.ToNurbsCurve()
        if curve is None:
            continue
        a, b = curve.PointAtStart, curve.PointAtEnd
        mid = curve.PointAt((curve.Domain.T0 + curve.Domain.T1) / 2)
        chord = ((a.X + b.X) / 2, (a.Y + b.Y) / 2, (a.Z + b.Z) / 2)
        if math.dist((mid.X, mid.Y, mid.Z), chord) > STRAIGHTNESS_MM:
            continue
        yield (a.X, a.Y, a.Z), (b.X, b.Y, b.Z)


def measure(path, rhino3dm):
    model = rhino3dm.File3dm.Read(path)
    if model is None:
        raise SystemExit(f"could not read {path}")
    hist, total = defaultdict(float), 0.0
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for obj in model.Objects:
        geom = obj.Geometry
        box = geom.GetBoundingBox()
        if box is not None:
            lo = [min(lo[0], box.Min.X), min(lo[1], box.Min.Y), min(lo[2], box.Min.Z)]
            hi = [max(hi[0], box.Max.X), max(hi[1], box.Max.Y), max(hi[2], box.Max.Z)]
        if geom.ObjectType != rhino3dm.ObjectType.Brep:
            continue
        for (p, q) in straight_edges(geom):
            dx, dy, dz = q[0] - p[0], q[1] - p[1], q[2] - p[2]
            length = math.sqrt(dx * dx + dy * dy + dz * dz)
            if length < MIN_EDGE_MM:
                continue
            if abs(dy) > max(abs(dx), abs(dz)):
                continue  # runs across the building, not in the section plane
            hist[round(math.degrees(math.atan2(abs(dz), abs(dx))), 1)] += length
            total += length
    ranked = sorted(hist.items(), key=lambda kv: -kv[1])
    sloped = [(ang, l) for ang, l in ranked if 2.0 < ang < 88.0]
    return {
        "span_mm": round(hi[0] - lo[0], 1),
        "depth_mm": round(hi[1] - lo[1], 1),
        "rise_mm": round(hi[2] - lo[2], 1),
        "pitch_deg": sloped[0][0] if sloped else 0.0,
        "pitch_share_pct": round(100 * sloped[0][1] / total, 1) if sloped else 0.0,
        "top_angles": [(ang, round(100 * l / total, 1)) for ang, l in ranked[:4]],
    }


def main():
    try:
        import rhino3dm
    except ImportError:
        raise SystemExit("pip install rhino3dm")
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for block in BLOCKS:
            path = os.path.join(tmp, f"{block}.3dm")
            subprocess.run(["curl", "-sL", "--max-time", "300", URL.format(b=block), "-o", path], check=True)
            if os.path.getsize(path) < 1_000_000:
                raise SystemExit(f"{block}: download looks wrong ({os.path.getsize(path)} bytes)")
            out[block] = measure(path, rhino3dm)
            r = out[block]
            print(f"{block:9} span {r['span_mm']:7.0f}mm  rise {r['rise_mm']:7.0f}mm  "
                  f"pitch {r['pitch_deg']:5.1f}deg ({r['pitch_share_pct']:4.1f}% of in-plane edge)")
    pitches = sorted({r["pitch_deg"] for r in out.values()})
    print(f"\nSkylark 150 roof pitches: {pitches}")
    json.dump(out, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
