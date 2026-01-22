#!/usr/bin/env python3
"""
Convert NPC portrait images to retro sci-fi amber gradient style.

Scans images_source directory and converts any images that don't already
exist in the images output directory.

Features:
- Resizes to 512x512 pixels (square crop from center)
- Applies amber gradient based on brightness
- Uses gamma 1.4 for dramatic portrait lighting

Usage:
    python convert_npc_portraits.py [source_dir] [output_dir]

Defaults:
    source_dir: data/campaign/NPCs/images_source
    output_dir: data/campaign/NPCs/images
"""

from PIL import Image
import sys
import os

# Default directories
DEFAULT_SOURCE = "data/campaign/NPCs/images_source"
DEFAULT_OUTPUT = "data/campaign/NPCs/images"

# Portrait settings
TARGET_SIZE = 512
GRADIENT_STEPS = 128
GAMMA = 1.0
AMBER = (0xD4, 0xA8, 0x55)
BACKGROUND_THRESHOLD = 15  # Ignore pixels darker than this for range calculation


def calculate_brightness(rgb):
    """Calculate perceived brightness using ITU-R BT.709 luminance formula."""
    r, g, b = rgb[:3]
    return int(0.2126 * r + 0.7152 * g + 0.0722 * b)


def create_gradient(steps=256):
    """Create gradient from black to bright amber."""
    gradient = []
    for i in range(steps):
        t = i / (steps - 1)
        r = int(AMBER[0] * t)
        g = int(AMBER[1] * t)
        b = int(AMBER[2] * t)
        gradient.append((r, g, b))
    return gradient


def crop_to_square(img):
    """Crop image to square from center."""
    width, height = img.size

    if width == height:
        return img

    # Determine crop box (center crop)
    if width > height:
        left = (width - height) // 2
        top = 0
        right = left + height
        bottom = height
    else:
        left = 0
        top = (height - width) // 2
        right = width
        bottom = top + width

    return img.crop((left, top, right, bottom))


def convert_to_amber(img, gradient_steps=GRADIENT_STEPS, gamma=GAMMA):
    """Convert image to amber gradient based on brightness."""
    pixels = img.load()
    width, height = img.size

    # Scan unique colors and calculate brightness
    unique_colors = {}
    for y in range(height):
        for x in range(width):
            rgb = pixels[x, y][:3]
            if rgb not in unique_colors:
                unique_colors[rgb] = calculate_brightness(rgb)

    # Get brightness range, ignoring near-black background pixels
    brightnesses = list(unique_colors.values())
    foreground_brightnesses = [b for b in brightnesses if b > BACKGROUND_THRESHOLD]

    # If no foreground pixels found, fall back to all pixels
    if foreground_brightnesses:
        min_b = min(foreground_brightnesses)
        max_b = max(foreground_brightnesses)
    else:
        min_b = min(brightnesses)
        max_b = max(brightnesses)

    range_b = max_b - min_b if max_b > min_b else 1

    # Create gradient
    gradient = create_gradient(gradient_steps)

    # Map colors to gradient
    color_map = {}
    for rgb, brightness in unique_colors.items():
        # Map background pixels to black
        if brightness <= BACKGROUND_THRESHOLD:
            color_map[rgb] = (0, 0, 0)
        else:
            normalized = (brightness - min_b) / range_b
            normalized = max(0, min(1, normalized))  # Clamp to 0-1
            normalized = pow(normalized, gamma)
            idx = int(normalized * (len(gradient) - 1))
            color_map[rgb] = gradient[idx]

    # Apply mapping
    output = Image.new('RGB', (width, height))
    output_pixels = output.load()

    for y in range(height):
        for x in range(width):
            original = pixels[x, y][:3]
            output_pixels[x, y] = color_map[original]

    return output


def convert_portrait(input_path, output_path):
    """Load, resize, convert, and save a portrait image."""
    print(f"  Converting: {os.path.basename(input_path)}")

    # Load image
    img = Image.open(input_path)
    original_size = img.size

    # Handle transparency by compositing onto black background
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        # Create black background
        background = Image.new('RGB', img.size, (0, 0, 0))
        # Convert to RGBA if needed
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        # Composite image onto black background
        background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
        img = background
    else:
        img = img.convert('RGB')

    # Crop to square
    img = crop_to_square(img)

    # Resize to target size
    img = img.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.LANCZOS)

    # Apply amber gradient
    img = convert_to_amber(img)

    # Save
    img.save(output_path, 'PNG', optimize=True)

    output_size = os.path.getsize(output_path) / 1024
    print(f"    {original_size[0]}x{original_size[1]} -> {TARGET_SIZE}x{TARGET_SIZE} ({output_size:.1f} KB)")


def main():
    source_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    output_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT

    print(f"NPC Portrait Converter")
    print(f"  Source: {source_dir}")
    print(f"  Output: {output_dir}")
    print(f"  Size: {TARGET_SIZE}x{TARGET_SIZE}")
    print(f"  Gamma: {GAMMA}")
    print()

    if not os.path.exists(source_dir):
        print(f"Error: Source directory not found: {source_dir}")
        sys.exit(1)

    # Create output directory if needed
    os.makedirs(output_dir, exist_ok=True)

    # Supported image extensions
    extensions = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

    # Find all source images
    source_files = []
    for f in os.listdir(source_dir):
        ext = os.path.splitext(f)[1].lower()
        if ext in extensions:
            source_files.append(f)

    if not source_files:
        print("No source images found.")
        return

    print(f"Found {len(source_files)} source image(s)")
    print()

    converted = 0
    skipped = 0

    for filename in sorted(source_files):
        # Output is always PNG
        base_name = os.path.splitext(filename)[0]
        output_name = f"{base_name}.png"

        input_path = os.path.join(source_dir, filename)
        output_path = os.path.join(output_dir, output_name)

        # Skip if output already exists
        if os.path.exists(output_path):
            print(f"  Skipping (exists): {output_name}")
            skipped += 1
            continue

        try:
            convert_portrait(input_path, output_path)
            converted += 1
        except Exception as e:
            print(f"  Error converting {filename}: {e}")

    print()
    print(f"Done! Converted: {converted}, Skipped: {skipped}")


if __name__ == '__main__':
    main()
