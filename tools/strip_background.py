#!/usr/bin/env python3
"""
Remove white background from a logo PNG, outputting RGBA with transparency.

Pixels near white become transparent; dark pixels stay opaque.
Anti-aliased edges get partial transparency for smooth results.

Usage:
    python tools/strip_background.py input.png output.png
"""

import sys
import os
from PIL import Image


def brightness(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def convert(input_path: str, output_path: str):
    img = Image.open(input_path).convert('RGB')
    w, h = img.size
    src = img.load()

    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dst = out.load()

    CUTOFF = 200  # brightness above this → fully transparent
    AMBER_LIGHT = (0xD4, 0xA8, 0x55)  # bright amber for lighter logo elements
    AMBER_DARK  = (0x6B, 0x4A, 0x12)  # deep amber for darkest lines

    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            lum = brightness(r, g, b)
            if lum >= CUTOFF:
                dst[x, y] = (0, 0, 0, 0)
            else:
                presence = (CUTOFF - lum) / CUTOFF
                alpha = int(255 * (presence ** 0.6))
                # t=0 → darkest logo pixel → AMBER_DARK
                # t=1 → lightest logo pixel (near cutoff) → AMBER_LIGHT
                t = 1.0 - presence
                nr = int(AMBER_DARK[0] + (AMBER_LIGHT[0] - AMBER_DARK[0]) * t)
                ng = int(AMBER_DARK[1] + (AMBER_LIGHT[1] - AMBER_DARK[1]) * t)
                nb = int(AMBER_DARK[2] + (AMBER_LIGHT[2] - AMBER_DARK[2]) * t)
                dst[x, y] = (nr, ng, nb, alpha)

    out.save(output_path, 'PNG', optimize=True)
    print(f"Saved {output_path}  ({w}x{h}, RGBA)")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python tools/strip_background.py input.png output.png")
        sys.exit(1)

    inp, outp = sys.argv[1], sys.argv[2]
    if not os.path.exists(inp):
        print(f"Error: {inp} not found")
        sys.exit(1)

    convert(inp, outp)
