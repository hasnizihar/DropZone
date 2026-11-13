import os
import math
from PIL import Image, ImageDraw

def create_dropzone_icon(size: int = 256) -> Image.Image:
    # RGBA image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 256.0

    # Colors
    bg_color = (18, 20, 23, 255)        # Near Black #121417
    border_color = (40, 44, 53, 255)    # Graphite Dark Border #282C35
    accent_lime = (212, 255, 92, 255)   # Acid Lime #D4FF5C
    off_white = (245, 243, 239, 255)    # Warm Off-White #F5F3EF

    # 1. Outer rounded container
    margin = int(12 * scale)
    corner_radius = int(48 * scale)
    rect = [margin, margin, size - margin, size - margin]

    # Draw rounded rectangle background
    draw.rounded_rectangle(rect, radius=corner_radius, fill=bg_color, outline=border_color, width=max(1, int(4 * scale)))

    # 2. Draw Target "DropZone" Base Brackets: |_|
    base_y = int(185 * scale)
    bracket_h = int(32 * scale)
    bracket_left = int(60 * scale)
    bracket_right = int(196 * scale)
    bracket_thick = max(2, int(10 * scale))

    # Bottom horizontal bar
    draw.line([(bracket_left, base_y), (bracket_right, base_y)], fill=off_white, width=bracket_thick)
    # Left vertical leg
    draw.line([(bracket_left, base_y - bracket_h), (bracket_left, base_y)], fill=off_white, width=bracket_thick)
    # Right vertical leg
    draw.line([(bracket_right, base_y - bracket_h), (bracket_right, base_y)], fill=off_white, width=bracket_thick)

    # 3. Draw Descending Arrow (Acid Lime)
    center_x = size // 2
    arrow_top_y = int(58 * scale)
    arrow_bottom_y = int(148 * scale)
    shaft_thick = max(2, int(14 * scale))

    # Vertical shaft
    draw.line([(center_x, arrow_top_y), (center_x, arrow_bottom_y)], fill=accent_lime, width=shaft_thick)

    # Arrow head (triangle)
    head_size = int(32 * scale)
    point1 = (center_x, arrow_bottom_y + int(14 * scale))
    point2 = (center_x - head_size, arrow_bottom_y - int(8 * scale))
    point3 = (center_x + head_size, arrow_bottom_y - int(8 * scale))
    draw.polygon([point1, point2, point3], fill=accent_lime)

    return img

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    assets_dir = os.path.join(repo_root, "apps", "desktop", "resources")
    os.makedirs(assets_dir, exist_ok=True)

    official_candidates = [
        os.path.join(repo_root, "resources", "icons", "DropZone Icon.png"),
        os.path.join(repo_root, "resources", "icons", "4x", "DropZone Icon.png"),
    ]
    official_icon = next((c for c in official_candidates if os.path.exists(c)), None)

    if official_icon:
        print(f"Loading official brand artwork from {official_icon}")
        src = Image.open(official_icon).convert("RGBA")
        icon_256 = src.resize((256, 256), Image.Resampling.LANCZOS)
    else:
        print("Rendering icon programmatically using brand design tokens...")
        icon_256 = create_dropzone_icon(256)

    # Generate master 256x256 PNG
    png_path = os.path.join(assets_dir, "icon.png")
    icon_256.save(png_path, "PNG")
    print(f"Saved {png_path}")

    # Generate multi-resolution .ico
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_path = os.path.join(assets_dir, "icon.ico")
    icon_256.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"Saved {ico_path} with sizes: {ico_sizes}")

if __name__ == "__main__":
    main()

