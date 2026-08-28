import os
from PIL import Image, ImageDraw

def render_logo(bg_type="dark", size=(512, 512)):
    # Create image with RGBA
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size[0] / 200.0

    # Draw squircle background if not transparent
    if bg_type == "dark":
        # Draw rounded rect #090d16
        draw.rounded_rectangle(
            [0, 0, size[0], size[1]],
            radius=int(44 * scale),
            fill=(9, 13, 22, 255)
        )
    elif bg_type == "light":
        # Draw rounded rect #f1f5f9
        draw.rounded_rectangle(
            [0, 0, size[0], size[1]],
            radius=int(44 * scale),
            fill=(241, 245, 249, 255),
            outline=(226, 232, 240, 255),
            width=int(2 * scale)
        )

    # Offset transform
    tx = 6 * scale

    # Color palette
    if bg_type == "light":
        colors = {
            "stem1": "#f59e0b",
            "stem2": "#9333ea",
            "bar1": "#16a34a",
            "bar2": "#ca8a04",
            "bar3": "#ea580c",
            "bar4": "#dc2626",
            "bar5": "#2563eb",
        }
    else:
        colors = {
            "stem1": "#f59e0b",
            "stem2": "#c084fc",
            "bar1": "#4ade80",
            "bar2": "#fde047",
            "bar3": "#fb923c",
            "bar4": "#f87171",
            "bar5": "#60a5fa",
        }

    def hex_to_rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

    # Stems
    # Stem 1: x=36, y=36, w=11, h=128
    x1, y1, w, h = (36 * scale + tx), (36 * scale), (11 * scale), (128 * scale)
    draw.rounded_rectangle([x1, y1, x1 + w, y1 + h], radius=int(5.5 * scale), fill=hex_to_rgb(colors["stem1"]))

    # Stem 2: x=52, y=36, w=11, h=128
    x2, y2 = (52 * scale + tx), (36 * scale)
    draw.rounded_rectangle([x2, y2, x2 + w, y2 + h], radius=int(5.5 * scale), fill=hex_to_rgb(colors["stem2"]))

    # 5 Bars
    bars = [
        (36, 56, colors["bar1"]),
        (52, 78, colors["bar2"]),
        (68, 88, colors["bar3"]),
        (84, 78, colors["bar4"]),
        (100, 52, colors["bar5"])
    ]

    for y_val, w_val, col in bars:
        bx, by = (68 * scale + tx), (y_val * scale)
        bw, bh = (w_val * scale), (11 * scale)
        draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=int(5.5 * scale), fill=hex_to_rgb(col))

    return img

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "frontend", "public")
    
    # 1. Dark PNG
    dark_img = render_logo("dark", (512, 512))
    dark_img.save(os.path.join(target_dir, "logo-dark.png"), "PNG")
    print("Saved logo-dark.png")

    # 2. Light PNG
    light_img = render_logo("light", (512, 512))
    light_img.save(os.path.join(target_dir, "logo-light.png"), "PNG")
    print("Saved logo-light.png")

    # 3. Transparent PNG
    trans_img = render_logo("transparent", (512, 512))
    trans_img.save(os.path.join(target_dir, "logo-transparent.png"), "PNG")
    print("Saved logo-transparent.png")

if __name__ == "__main__":
    main()
