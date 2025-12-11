#!/usr/bin/env python3
"""
Convert noisy textures to retro sci-fi amber gradient images.

Takes an existing texture and:
1. Scans all unique colors in the image
2. Creates a gradient from black to amber
3. Remaps each pixel to the gradient based on brightness

Usage:
    python convert_to_amber_gradient.py input.png output.png [gradient_steps]
"""

from PIL import Image
import sys
import os


def calculate_brightness(rgb):
    """
    Calculate perceived brightness of an RGB color using luminance formula.
    Returns value from 0 (black) to 255 (white).
    """
    # Use standard luminance formula (ITU-R BT.709)
    r, g, b = rgb
    return int(0.2126 * r + 0.7152 * g + 0.0722 * b)


def create_gradient(steps=256):
    """
    Create a gradient from black to bright gold/amber.

    steps: number of color steps in the gradient (default 256)
    Returns: list of RGB tuples
    """
    amber = (0xD4, 0xA8, 0x55)  # Bright gold/amber color
    black = (0, 0, 0)

    gradient = []
    for i in range(steps):
        # Linear interpolation from black to amber
        t = i / (steps - 1)  # 0.0 to 1.0
        r = int(black[0] + (amber[0] - black[0]) * t)
        g = int(black[1] + (amber[1] - black[1]) * t)
        b = int(black[2] + (amber[2] - black[2]) * t)
        gradient.append((r, g, b))

    return gradient


def scan_unique_colors(img):
    """
    Scan image and return all unique colors with their brightness values.

    Returns: dict mapping original RGB -> brightness value
    """
    print("Scanning unique colors...")
    pixels = img.load()
    width, height = img.size

    unique_colors = {}

    for y in range(height):
        for x in range(width):
            rgb = pixels[x, y][:3]  # Get RGB, ignore alpha if present
            if rgb not in unique_colors:
                brightness = calculate_brightness(rgb)
                unique_colors[rgb] = brightness

    print(f"Found {len(unique_colors)} unique colors")
    return unique_colors


def map_colors_to_gradient(unique_colors, gradient, gamma=2.2):
    """
    Map each unique color to the closest gradient color based on brightness.

    gamma: gamma correction value (< 1.0 brightens midtones, > 1.0 darkens)
    Returns: dict mapping original RGB -> gradient RGB
    """
    print(f"Mapping colors to gradient (gamma={gamma})...")
    color_map = {}

    # Get brightness range
    brightnesses = list(unique_colors.values())
    min_brightness = min(brightnesses)
    max_brightness = max(brightnesses)
    brightness_range = max_brightness - min_brightness

    print(f"Brightness range: {min_brightness} to {max_brightness}")

    for original_rgb, brightness in unique_colors.items():
        # Normalize brightness to 0.0-1.0 range
        if brightness_range > 0:
            normalized = (brightness - min_brightness) / brightness_range
        else:
            normalized = 0.5  # If all colors same brightness, use middle of gradient

        # Apply gamma correction to brighten midtones
        normalized = pow(normalized, gamma)

        # Find corresponding gradient color
        gradient_index = int(normalized * (len(gradient) - 1))
        gradient_rgb = gradient[gradient_index]

        color_map[original_rgb] = gradient_rgb

    return color_map


def apply_color_mapping(img, color_map):
    """
    Apply color mapping to create new image.

    Returns: new Image with remapped colors
    """
    print("Applying color mapping...")
    pixels = img.load()
    width, height = img.size

    # Create output image
    output = Image.new('RGB', (width, height))
    output_pixels = output.load()

    # Apply mapping
    for y in range(height):
        for x in range(width):
            original_rgb = pixels[x, y][:3]
            new_rgb = color_map[original_rgb]
            output_pixels[x, y] = new_rgb

    return output


def convert_to_amber(input_path, output_path, gradient_steps=128, gamma=2.2):
    """
    Convert texture to amber gradient.
    """
    print(f"Loading {input_path}...")
    img = Image.open(input_path).convert('RGB')
    width, height = img.size

    print(f"Image size: {width}x{height}")

    # Step 1: Scan unique colors
    unique_colors = scan_unique_colors(img)

    # Step 2: Create gradient
    print(f"Creating {gradient_steps}-step gradient from black to bright amber...")
    gradient = create_gradient(gradient_steps)

    # Step 3: Map colors to gradient
    color_map = map_colors_to_gradient(unique_colors, gradient, gamma=gamma)

    # Step 4: Apply mapping
    output = apply_color_mapping(img, color_map)

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
        print("Usage: python convert_to_amber_gradient.py input.png output.png [gradient_steps] [gamma]")
        print("  gradient_steps: number of color steps in gradient (default: 128)")
        print("  gamma: gamma correction value (default: 2.2, lower = brighter)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    gradient_steps = int(sys.argv[3]) if len(sys.argv) > 3 else 128
    gamma = float(sys.argv[4]) if len(sys.argv) > 4 else 2.2

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        sys.exit(1)

    convert_to_amber(input_path, output_path, gradient_steps, gamma)
