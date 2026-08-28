import os
from PIL import Image, ImageDraw, ImageFont

def get_font(size):
    font_paths = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def get_regular_font(size):
    font_paths = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

# 1. Icon Only
def render_icon_only(bg_type="dark", size=(512, 512)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[0] / 200.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(46 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(46 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "stem": "#f59e0b",
        "bar1": "#16a34a" if bg_type == "light" else "#4ade80",
        "bar2": "#2563eb" if bg_type == "light" else "#60a5fa",
        "bar3": "#9333ea" if bg_type == "light" else "#c084fc"
    }

    # Stem
    draw.rounded_rectangle([6 * scale, 6 * scale, (6 + 38) * scale, (6 + 188) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["stem"]))
    # 3 Bars
    draw.rounded_rectangle([56 * scale, 6 * scale, (56 + 102) * scale, (6 + 38) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([56 * scale, 56 * scale, (56 + 138) * scale, (56 + 38) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([56 * scale, 106 * scale, (56 + 88) * scale, (106 + 38) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["bar3"]))

    return img

# 2. Horizontal Lockup: [ P ] Pathd (1200 x 360)
def render_horizontal(bg_type="dark", size=(1200, 360)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[1] / 180.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(24 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(24 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "stem": "#f59e0b",
        "bar1": "#16a34a" if bg_type == "light" else "#4ade80",
        "bar2": "#2563eb" if bg_type == "light" else "#60a5fa",
        "bar3": "#9333ea" if bg_type == "light" else "#c084fc",
        "text": "#0f172a" if bg_type == "light" else "#f8fafc"
    }

    # Offset icon
    ox, oy = (24 * scale), (0 * scale)
    draw.rounded_rectangle([ox + 24 * scale, oy + 24 * scale, ox + (24 + 26) * scale, oy + (24 + 132) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 24 * scale, ox + (62 + 70) * scale, oy + (24 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 59 * scale, ox + (62 + 95) * scale, oy + (59 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 94 * scale, ox + (62 + 60) * scale, oy + (94 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar3"]))

    # Draw Text "Path" + "d"
    font = get_font(int(100 * scale))
    tx = int(220 * scale)
    ty = int(32 * scale)
    
    draw.text((tx, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((tx + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)

    return img

# 3. Vertical Lockup: [ P ] over Pathd (1000 x 1000)
def render_vertical(bg_type="dark", size=(1000, 1000)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[0] / 500.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(54 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(54 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "stem": "#f59e0b",
        "bar1": "#16a34a" if bg_type == "light" else "#4ade80",
        "bar2": "#2563eb" if bg_type == "light" else "#60a5fa",
        "bar3": "#9333ea" if bg_type == "light" else "#c084fc",
        "text": "#0f172a" if bg_type == "light" else "#f8fafc",
        "subtext": "#475569" if bg_type == "light" else "#94a3b8"
    }

    # Center icon: ox=150, oy=60
    ox, oy = (150 * scale), (60 * scale)
    draw.rounded_rectangle([ox + 6 * scale, oy + 6 * scale, ox + (6 + 38) * scale, oy + (6 + 188) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([ox + 56 * scale, oy + 6 * scale, ox + (56 + 102) * scale, oy + (6 + 38) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([ox + 56 * scale, oy + 56 * scale, ox + (56 + 138) * scale, oy + (56 + 38) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([ox + 56 * scale, oy + 106 * scale, ox + (56 + 88) * scale, oy + (106 + 38) * scale], radius=int(19 * scale), fill=hex_to_rgb(colors["bar3"]))

    # Main text centered
    font = get_font(int(88 * scale))
    full_text = "Pathd"
    full_w = draw.textlength(full_text, font=font)
    start_x = (size[0] - full_w) / 2
    ty = int(300 * scale)

    draw.text((start_x, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((start_x + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)

    # Subtext centered
    sub_font = get_regular_font(int(22 * scale))
    sub_text = "MEDIA TRACKER & GUIDES"
    sub_w = draw.textlength(sub_text, font=sub_font)
    sub_x = (size[0] - sub_w) / 2
    sub_y = int(410 * scale)
    draw.text((sub_x, sub_y), sub_text, fill=hex_to_rgb(colors["subtext"]), font=sub_font)

    return img

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "frontend", "public")
    
    # 1. Icon Only PNGs
    render_icon_only("dark", (512, 512)).save(os.path.join(target_dir, "logo-dark.png"), "PNG")
    render_icon_only("light", (512, 512)).save(os.path.join(target_dir, "logo-light.png"), "PNG")
    render_icon_only("transparent", (512, 512)).save(os.path.join(target_dir, "logo-transparent.png"), "PNG")
    print("Generated Icon Only PNGs")

    # 2. Horizontal Lockups PNGs (1200 x 360)
    render_horizontal("dark", (1200, 360)).save(os.path.join(target_dir, "logo-horizontal-dark.png"), "PNG")
    render_horizontal("light", (1200, 360)).save(os.path.join(target_dir, "logo-horizontal-light.png"), "PNG")
    render_horizontal("transparent", (1200, 360)).save(os.path.join(target_dir, "logo-horizontal-transparent.png"), "PNG")
    print("Generated Horizontal PNGs")

    # 3. Vertical Lockups PNGs (1000 x 1000)
    render_vertical("dark", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-dark.png"), "PNG")
    render_vertical("light", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-light.png"), "PNG")
    render_vertical("transparent", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-transparent.png"), "PNG")
    print("Generated Vertical PNGs")

if __name__ == "__main__":
    main()
