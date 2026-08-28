import os
from PIL import Image, ImageDraw

def render_logo(bg_type="dark", size=(512, 512)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[0] / 200.0

    # Draw squircle background if not transparent
    if bg_type == "dark":
        draw.rounded_rectangle(
            [0, 0, size[0], size[1]],
            radius=int(46 * scale),
            fill=(9, 13, 22, 255)
        )
    elif bg_type == "light":
        draw.rounded_rectangle(
            [0, 0, size[0], size[1]],
            radius=int(46 * scale),
            fill=(241, 245, 249, 255),
            outline=(226, 232, 240, 255),
            width=int(2 * scale)
        )

    if bg_type == "light":
        colors = {
            "stem": "#f59e0b",
            "bar1": "#16a34a",
            "bar2": "#2563eb",
            "bar3": "#9333ea"
        }
    else:
        colors = {
            "stem": "#f59e0b",
            "bar1": "#4ade80",
            "bar2": "#60a5fa",
            "bar3": "#c084fc"
        }

    def hex_to_rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

    # 1. Stem: x=24, y=24, w=28, h=152, rx=14
    x1, y1, w1, h1 = (24 * scale), (24 * scale), (28 * scale), (152 * scale)
    draw.rounded_rectangle([x1, y1, x1 + w1, y1 + h1], radius=int(14 * scale), fill=hex_to_rgb(colors["stem"]))

    # 2. Bar 1: x=64, y=24, w=86, h=28, rx=14
    x2, y2, w2, h2 = (64 * scale), (24 * scale), (86 * scale), (28 * scale)
    draw.rounded_rectangle([x2, y2, x2 + w2, y2 + h2], radius=int(14 * scale), fill=hex_to_rgb(colors["bar1"]))

    # 3. Bar 2: x=64, y=66, w=112, h=28, rx=14
    x3, y3, w3, h3 = (64 * scale), (66 * scale), (112 * scale), (28 * scale)
    draw.rounded_rectangle([x3, y3, x3 + w3, y3 + h3], radius=int(14 * scale), fill=hex_to_rgb(colors["bar2"]))

    # 4. Bar 3: x=64, y=108, w=72, h=28, rx=14
    x4, y4, w4, h4 = (64 * scale), (108 * scale), (72 * scale), (28 * scale)
    draw.rounded_rectangle([x4, y4, x4 + w4, y4 + h4], radius=int(14 * scale), fill=hex_to_rgb(colors["bar3"]))

    return img

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "frontend", "public")
    
    dark_img = render_logo("dark", (512, 512))
    dark_img.save(os.path.join(target_dir, "logo-dark.png"), "PNG")
    print("Saved logo-dark.png")

    light_img = render_logo("light", (512, 512))
    light_img.save(os.path.join(target_dir, "logo-light.png"), "PNG")
    print("Saved logo-light.png")

    trans_img = render_logo("transparent", (512, 512))
    trans_img.save(os.path.join(target_dir, "logo-transparent.png"), "PNG")
    print("Saved logo-transparent.png")

if __name__ == "__main__":
    main()
