---
name: sprite-sheet-generator
description: Generate optimized 2D sprite sheets and animations for Phaser using programmable SVG templates and local image processing scripts.
---

# Sprite Sheet Generator Skill

Every agent in Dev Tools operates locally using structured skill configs.

## Usage
```bash
python3 ./dev-tools/skills/sprite-generator/scripts/build_sprites.py \
  --config ./dev-tools/skills/sprite-generator/config.json \
  --output ./web/assets/sprites/
```

## Capabilities
1. **Programmable SVG Palettes:** Parameterizes fill colors, stroke weights, and keyframe transforms across retro arcade sprites, card suit emblems, and board game pieces.
2. **Phaser Atlas Output:** Generates both the packed SVG/PNG sprite strip and a Phaser 3/4 compatible JSON hash atlas (`sprites.json`).
3. **Deterministic Seeded Variants:** Produces consistent faction colors and damage-flash frames without external cloud dependencies.
