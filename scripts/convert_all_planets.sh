#!/bin/bash
# Batch convert planet textures from Fantasy Map Generator to retro style
# Usage: ./scripts/convert_all_planets.sh

cd "$(dirname "$0")/.."
source .venv/bin/activate

echo "Converting planet textures..."
echo "================================"

# Convert all maps in planets_source directory
for file in textures/planets_source/map_*.png; do
    if [ -f "$file" ]; then
        # Extract number from filename (e.g., map_01.png -> 01)
        basename=$(basename "$file")
        num="${basename#map_}"
        num="${num%.png}"

        output="textures/planets/${num}.png"

        echo "Converting $basename -> ${num}.png"
        python scripts/convert_planet_texture.py "$file" "$output"
        echo ""
    fi
done

echo "================================"
echo "Conversion complete!"
echo "Converted textures are in: textures/planets/"
