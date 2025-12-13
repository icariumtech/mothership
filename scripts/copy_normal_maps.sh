#!/bin/bash

# Copy normal map files (Bump-*) from source directories to output directories
# These files are already in the correct format and don't need conversion

# Source directories (with _source suffix)
SOURCE_DIRS=(
    "textures/gas_source"
    "textures/rock_source"
    "textures/terrestrial_source"
    "textures/volcanic_source"
)

echo "========================================"
echo "Copying Normal Maps to Output Directories"
echo "========================================"
echo ""

TOTAL_COPIED=0

# Process each source directory
for SOURCE_DIR in "${SOURCE_DIRS[@]}"; do
    # Create target directory name (remove _source suffix)
    TARGET_DIR="${SOURCE_DIR%_source}"

    echo "========================================"
    echo "Processing: $SOURCE_DIR"
    echo "Output to: $TARGET_DIR"
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

    # Count Bump-* files
    BUMP_COUNT=$(find "$SOURCE_DIR" -maxdepth 1 -name "Bump-*.png" | wc -l)
    echo "Found $BUMP_COUNT normal map files (Bump-*)"

    if [ $BUMP_COUNT -eq 0 ]; then
        echo "No normal map files found in $SOURCE_DIR, skipping..."
        continue
    fi

    # Copy each Bump-* file
    COPIED=0
    for SOURCE_FILE in "$SOURCE_DIR"/Bump-*.png; do
        # Skip if no files match
        [ -e "$SOURCE_FILE" ] || continue

        # Get filename without path
        FILENAME=$(basename "$SOURCE_FILE")

        # Create target file path
        TARGET_FILE="$TARGET_DIR/$FILENAME"

        echo "Copying: $FILENAME"
        cp "$SOURCE_FILE" "$TARGET_FILE"

        if [ $? -eq 0 ]; then
            ((COPIED++))
            echo "✓ Copied: $FILENAME"
        else
            echo "✗ Failed: $FILENAME"
        fi
    done

    echo "Copied $COPIED of $BUMP_COUNT files from $SOURCE_DIR"
    echo ""
    TOTAL_COPIED=$((TOTAL_COPIED + COPIED))
done

echo "========================================"
echo "All normal maps copied!"
echo "Total files copied: $TOTAL_COPIED"
echo "========================================"
