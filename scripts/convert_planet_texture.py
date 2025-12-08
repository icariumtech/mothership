#!/usr/bin/env python3
"""
Convert planet textures from Fantasy Map Generator to retro wireframe style.

Input: PNG with black water (#000000) and gray land (#404040)
Output: PNG with:
  - Black background (ocean)
  - 2px amber continent outlines
  - Amber grid pattern on land masses
  - (Lat/lon lines generated on-the-fly in Three.js)

Usage:
    python convert_planet_texture.py input.png output.png [edge_thickness] [grid_spacing]
"""

from PIL import Image
import sys
import os


def draw_edges_horizontal_vertical(img, output_pixels, width, height, edge_thickness=3):
    """
    Draw edges by scanning horizontally and vertically for color transitions.
    Uses threshold-based detection to handle anti-aliased edges.
    """
    input_pixels = img.load()
    edge_color = (0x8b, 0x73, 0x55)  # Amber

    # Threshold: pixels darker than this are ocean, brighter are land
    threshold = 32  # Midpoint between 0 (ocean) and 64 (land)

    half_thickness = edge_thickness // 2
    edge_count = 0

    def is_ocean(pixel):
        return pixel[0] < threshold  # Use red channel (all RGB are same for grayscale)

    def is_land(pixel):
        return pixel[0] >= threshold

    # Horizontal pass - scan each row left to right
    for y in range(height):
        for x in range(width - 1):
            current = input_pixels[x, y][:3]
            next_pixel = input_pixels[x + 1, y][:3]

            # Check for transition between ocean and land
            if (is_ocean(current) and is_land(next_pixel)) or \
               (is_land(current) and is_ocean(next_pixel)):
                # Draw vertical edge line at this transition
                for dx in range(-half_thickness, half_thickness + 1):
                    if 0 <= x + dx < width:
                        output_pixels[x + dx, y] = edge_color
                        edge_count += 1

    # Vertical pass - scan each column top to bottom
    for x in range(width):
        for y in range(height - 1):
            current = input_pixels[x, y][:3]
            next_pixel = input_pixels[x, y + 1][:3]

            # Check for transition between ocean and land
            if (is_ocean(current) and is_land(next_pixel)) or \
               (is_land(current) and is_ocean(next_pixel)):
                # Draw horizontal edge line at this transition
                for dy in range(-half_thickness, half_thickness + 1):
                    if 0 <= y + dy < height:
                        output_pixels[x, y + dy] = edge_color
                        edge_count += 1

    print(f"Drew {edge_count} edge pixels")


def draw_continent_grid(img, output_pixels, width, height, grid_spacing=20):
    """
    Draw grid lines on land masses.

    grid_spacing: pixels between grid lines
    """
    input_pixels = img.load()
    land_color = (0x40, 0x40, 0x40)
    grid_color = (0x8b, 0x73, 0x55)  # Amber

    for y in range(height):
        for x in range(width):
            # Check if this is a land pixel
            if input_pixels[x, y][:3] == land_color:
                # Check if on grid line
                if x % grid_spacing == 0 or y % grid_spacing == 0:
                    output_pixels[x, y] = grid_color


def convert_texture(input_path, output_path, edge_thickness=2, grid_spacing=20):
    """
    Convert planet texture to retro wireframe style.
    """
    print(f"Loading {input_path}...")
    img = Image.open(input_path).convert('RGB')
    width, height = img.size

    print(f"Image size: {width}x{height}")

    # Start with a copy of the input image (preserves land color)
    output = img.copy()
    pixels = output.load()

    # Step 1: Draw amber grid on continents
    print(f"Drawing amber grid on continents (every {grid_spacing}px)...")
    draw_continent_grid(img, pixels, width, height, grid_spacing=grid_spacing)

    # Step 2: Draw edges with horizontal and vertical passes
    print(f"Drawing continent edges ({edge_thickness}px thick)...")
    draw_edges_horizontal_vertical(img, pixels, width, height, edge_thickness=edge_thickness)

    # Step 3: Replace remaining gray land with black
    print("Replacing gray land with black...")
    amber = (0x8b, 0x73, 0x55)
    for y in range(height):
        for x in range(width):
            # If pixel is not amber (grid or edge), make it black
            if pixels[x, y][:3] != amber:
                pixels[x, y] = (0, 0, 0)

    # Save output
    print(f"Saving to {output_path}...")
    output.save(output_path, 'PNG', optimize=True)

    # Report file sizes
    input_size = os.path.getsize(input_path) / (1024 * 1024)
    output_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nInput size: {input_size:.2f} MB")
    print(f"Output size: {output_size:.2f} MB")
    print(f"Done!")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python convert_planet_texture.py input.png output.png [edge_thickness] [grid_spacing]")
        print("  edge_thickness: width of continent outlines in pixels (default: 2)")
        print("  grid_spacing: pixels between grid lines on continents (default: 20)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    edge_thickness = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    grid_spacing = int(sys.argv[4]) if len(sys.argv) > 4 else 20

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        sys.exit(1)

    convert_texture(input_path, output_path, edge_thickness, grid_spacing)
