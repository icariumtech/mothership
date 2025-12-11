#!/bin/bash

# Batch convert planet textures to amber gradient
# Auto-selects gamma based on planet type for optimal results

# Source directories (with _source suffix)
SOURCE_DIRS=(
    "textures/gas_source"
    "textures/rock_source"
    "textures/terrestrial_source"
    "textures/volcanic_source"
)

# Gradient steps (consistent across all types)
GRADIENT_STEPS=128

# Activate virtual environment
source .venv/bin/activate

echo "========================================"
echo "Batch Converting All Planet Textures"
echo "Settings: $GRADIENT_STEPS gradient steps"
echo "Gamma: Auto-selected per planet type"
echo "========================================"
echo ""

# Process each source directory
for SOURCE_DIR in "${SOURCE_DIRS[@]}"; do
    # Create target directory name (remove _source suffix)
    TARGET_DIR="${SOURCE_DIR%_source}"

    # Determine gamma value based on planet type
    case "$SOURCE_DIR" in
        *gas_source*)
            GAMMA=2.0
            ;;
        *rock_source*)
            GAMMA=1.8
            ;;
        *terrestrial_source*)
            GAMMA=1.4
            ;;
        *volcanic_source*)
            GAMMA=1.4
            ;;
        *)
            GAMMA=1.8  # Default fallback
            ;;
    esac

    echo "========================================"
    echo "Processing: $SOURCE_DIR"
    echo "Output to: $TARGET_DIR"
    echo "Settings: $GRADIENT_STEPS steps, gamma $GAMMA"
    echo "========================================"

    # Create target directory if it doesn't exist
    if [ ! -d "$TARGET_DIR" ]; then
        echo "Creating directory: $TARGET_DIR"
        mkdir -p "$TARGET_DIR"
    fi

    # Check if source directory exists
    if [ ! -d "$SOURCE_DIR" ]; then
        echo "WARNING: Source directory $SOURCE_DIR does not exist, skipping..."
        continue
    fi

    # Count PNG files
    PNG_COUNT=$(find "$SOURCE_DIR" -maxdepth 1 -name "*.png" | wc -l)
    echo "Found $PNG_COUNT PNG files"

    if [ $PNG_COUNT -eq 0 ]; then
        echo "No PNG files found in $SOURCE_DIR, skipping..."
        continue
    fi

    # Process each PNG file in source directory
    PROCESSED=0
    for SOURCE_FILE in "$SOURCE_DIR"/*.png; do
        # Skip if no files match (in case of empty directory)
        [ -e "$SOURCE_FILE" ] || continue

        # Get filename without path
        FILENAME=$(basename "$SOURCE_FILE")

        # Create target file path
        TARGET_FILE="$TARGET_DIR/$FILENAME"

        echo "Converting: $FILENAME"

        # Run conversion script with appropriate gamma
        python scripts/convert_to_amber_gradient.py "$SOURCE_FILE" "$TARGET_FILE" "$GRADIENT_STEPS" "$GAMMA"

        if [ $? -eq 0 ]; then
            ((PROCESSED++))
            echo "✓ Completed: $FILENAME"
        else
            echo "✗ Failed: $FILENAME"
        fi

        echo ""
    done

    echo "Processed $PROCESSED of $PNG_COUNT files from $SOURCE_DIR"
    echo ""
done

echo "========================================"
echo "All conversions complete!"
echo "Gas: gamma 2.0 | Rock: gamma 1.8"
echo "Terrestrial: gamma 1.4 | Volcanic: gamma 1.4"
echo "========================================"
