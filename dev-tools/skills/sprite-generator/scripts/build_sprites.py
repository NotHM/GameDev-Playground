#!/usr/bin/env python3
"""
Local-First Programmable SVG Sprite Sheet Generator for Phaser & Wasm Runtime.
Usage:
  python3 ./dev-tools/skills/sprite-generator/scripts/build_sprites.py \
    --config ./dev-tools/skills/sprite-generator/config.json \
    --output ./web/assets/sprites/
"""
import argparse
import json
import os
from datetime import datetime, timezone

def generate_svg_frame(sprite_id: str, width: int, height: int, palette: list[str], frame_idx: int) -> str:
    accent = palette[(frame_idx % (len(palette) - 1)) + 1]
    bg = palette[0]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">'
        f'<rect width="{width}" height="{height}" rx="4" fill="{bg}" stroke="{accent}" stroke-width="2"/>'
        f'<circle cx="{width // 2}" cy="{height // 2}" r="{min(width, height) // 4}" fill="{accent}"/>'
        f'</svg>'
    )

def main() -> None:
    parser = argparse.ArgumentParser(description="Build Phaser SVG sprite sheets from config.")
    parser.add_argument("--config", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Output directory for generated atlas")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    os.makedirs(args.output, exist_ok=True)
    atlas = {
        "meta": {
            "generator": cfg.get("skillName", "sprite-sheet-generator"),
            "version": cfg.get("version", "1.0.0"),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        },
        "frames": {},
    }

    default_palette = cfg["palettes"]["emerald_casino"]
    for sp in cfg.get("sprites", []):
        sid = sp["id"]
        w, h = sp["width"], sp["height"]
        for frame in range(sp.get("frames", 1)):
            frame_name = f"{sid}_{frame}.svg"
            svg_code = generate_svg_frame(sid, w, h, default_palette, frame)
            with open(os.path.join(args.output, frame_name), "w", encoding="utf-8") as out_f:
                out_f.write(svg_code)
            atlas["frames"][frame_name] = {
                "frame": {"x": frame * w, "y": 0, "w": w, "h": h},
                "sourceSize": {"w": w, "h": h},
            }

    atlas_path = os.path.join(args.output, "atlas.json")
    with open(atlas_path, "w", encoding="utf-8") as af:
        json.dump(atlas, af, indent=2)
    print(f"[sprite-sheet-generator] Built {len(atlas['frames'])} frames -> {atlas_path}")

if __name__ == "__main__":
    main()
