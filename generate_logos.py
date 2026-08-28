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

# Immutable Master Logo Drawer: Identical to logo-transparent.svg (x=24, y=24, w=28, h=152, rx=14)
def draw_master_logo(draw, ox, oy, s, bg_type="dark"):
    colors = {
        "stem": "#f59e0b",
        "bar1": "#16a34a" if bg_type == "light" else "#4ade80",
        "bar2": "#2563eb" if bg_type == "light" else "#60a5fa",
        "bar3": "#9333ea" if bg_type == "light" else "#c084fc"
    }

    # Stem: x=24, y=24, w=28, h=152, rx=14
    draw.rounded_rectangle(
        [ox + 24 * s, oy + 24 * s, ox + (24 + 28) * s, oy + (24 + 152) * s],
        radius=int(14 * s), fill=hex_to_rgb(colors["stem"])
    )
    # Bar 1: x=64, y=24, w=86, h=28, rx=14
    draw.rounded_rectangle(
        [ox + 64 * s, oy + 24 * s, ox + (64 + 86) * s, oy + (24 + 28) * s],
        radius=int(14 * s), fill=hex_to_rgb(colors["bar1"])
    )
    # Bar 2: x=64, y=66, w=112, h=28, rx=14
    draw.rounded_rectangle(
        [ox + 64 * s, oy + 66 * s, ox + (64 + 112) * s, oy + (66 + 28) * s],
        radius=int(14 * s), fill=hex_to_rgb(colors["bar2"])
    )
    # Bar 3: x=64, y=108, w=72, h=28, rx=14
    draw.rounded_rectangle(
        [ox + 64 * s, oy + 108 * s, ox + (64 + 72) * s, oy + (108 + 28) * s],
        radius=int(14 * s), fill=hex_to_rgb(colors["bar3"])
    )

# 1. Icon Only (512x512)
def render_icon_only(bg_type="dark", size=(512, 512)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[0] / 200.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(46 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(46 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    draw_master_logo(draw, 0, 0, scale, bg_type)
    return img

# 2. Horizontal Clean: [ P ] Pathd (1200 x 360)
def render_horizontal_clean(bg_type="dark", size=(1200, 360)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[1] / 180.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(24 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(24 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "text": "#0f172a" if bg_type == "light" else "#f8fafc"
    }

    # Draw logo scaled (0.87 ratio in 180h canvas)
    ox, oy = (12 * scale), (2 * scale)
    draw_master_logo(draw, ox, oy, 0.88 * scale, bg_type)

    font = get_font(int(92 * scale))
    tx = int(200 * scale)
    ty = int(36 * scale)
    draw.text((tx, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((tx + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)
    return img

# 3. Horizontal With Tagline (1280 x 360)
def render_horizontal_tagline(bg_type="dark", size=(1280, 360)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[1] / 180.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(24 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(24 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "text": "#0f172a" if bg_type == "light" else "#f8fafc",
        "subtext": "#475569" if bg_type == "light" else "#94a3b8"
    }

    ox, oy = (14 * scale), (2 * scale)
    draw_master_logo(draw, ox, oy, 0.88 * scale, bg_type)

    font = get_font(int(78 * scale))
    tx = int(200 * scale)
    ty = int(20 * scale)
    draw.text((tx, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((tx + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)

    sub_font = get_font(int(18 * scale))
    draw.text((tx + int(2 * scale), ty + int(88 * scale)), "MEDIA TRACKER & GUIDES", fill=hex_to_rgb(colors["subtext"]), font=sub_font)
    return img

# 4. Vertical Clean (1000 x 1000 Square) - scale 1.65 uniform
def render_vertical_clean(bg_type="dark", size=(1000, 1000)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[0] / 500.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(54 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(54 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "text": "#0f172a" if bg_type == "light" else "#f8fafc"
    }

    # Center icon with exact uniform scale (1.65 * scale)
    ox, oy = (85 * scale), (25 * scale)
    draw_master_logo(draw, ox, oy, 1.65 * scale, bg_type)

    font = get_font(int(96 * scale))
    full_text = "Pathd"
    full_w = draw.textlength(full_text, font=font)
    start_x = (size[0] - full_w) / 2
    ty = int(350 * scale)

    draw.text((start_x, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((start_x + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)
    return img

# 5. Vertical With Tagline (1000 x 1000 Square) - scale 1.52 uniform
def render_vertical_tagline(bg_type="dark", size=(1000, 1000)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size[0] / 500.0

    if bg_type == "dark":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(54 * scale), fill=(9, 13, 22, 255))
    elif bg_type == "light":
        draw.rounded_rectangle([0, 0, size[0], size[1]], radius=int(54 * scale), fill=(241, 245, 249, 255), outline=(226, 232, 240, 255), width=int(2 * scale))

    colors = {
        "text": "#0f172a" if bg_type == "light" else "#f8fafc",
        "subtext": "#475569" if bg_type == "light" else "#94a3b8"
    }

    # Center icon with exact uniform scale (1.52 * scale)
    ox, oy = (98 * scale), (18 * scale)
    draw_master_logo(draw, ox, oy, 1.52 * scale, bg_type)

    font = get_font(int(88 * scale))
    full_text = "Pathd"
    full_w = draw.textlength(full_text, font=font)
    start_x = (size[0] - full_w) / 2
    ty = int(320 * scale)

    draw.text((start_x, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((start_x + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)

    sub_font = get_font(int(20 * scale))
    sub_text = "MEDIA TRACKER & GUIDES"
    sub_w = draw.textlength(sub_text, font=sub_font)
    sub_x = (size[0] - sub_w) / 2
    sub_y = int(410 * scale)
    draw.text((sub_x, sub_y), sub_text, fill=hex_to_rgb(colors["subtext"]), font=sub_font)
    return img

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "frontend", "public")
    
    # 1. Icon Only
    render_icon_only("dark", (512, 512)).save(os.path.join(target_dir, "logo-dark.png"), "PNG")
    render_icon_only("light", (512, 512)).save(os.path.join(target_dir, "logo-light.png"), "PNG")
    render_icon_only("transparent", (512, 512)).save(os.path.join(target_dir, "logo-transparent.png"), "PNG")

    # 2. Horizontal Clean
    render_horizontal_clean("dark", (1200, 360)).save(os.path.join(target_dir, "logo-horizontal-dark.png"), "PNG")
    render_horizontal_clean("light", (1200, 360)).save(os.path.join(target_dir, "logo-horizontal-light.png"), "PNG")
    render_horizontal_clean("transparent", (1200, 360)).save(os.path.join(target_dir, "logo-horizontal-transparent.png"), "PNG")

    # 3. Horizontal With Tagline
    render_horizontal_tagline("dark", (1280, 360)).save(os.path.join(target_dir, "logo-horizontal-tagline-dark.png"), "PNG")
    render_horizontal_tagline("light", (1280, 360)).save(os.path.join(target_dir, "logo-horizontal-tagline-light.png"), "PNG")
    render_horizontal_tagline("transparent", (1280, 360)).save(os.path.join(target_dir, "logo-horizontal-tagline-transparent.png"), "PNG")

    # 4. Vertical Clean (No Tagline)
    render_vertical_clean("dark", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-clean-dark.png"), "PNG")
    render_vertical_clean("light", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-clean-light.png"), "PNG")
    render_vertical_clean("transparent", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-clean-transparent.png"), "PNG")

    # 5. Vertical With Tagline
    render_vertical_tagline("dark", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-tagline-dark.png"), "PNG")
    render_vertical_tagline("light", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-tagline-light.png"), "PNG")
    render_vertical_tagline("transparent", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-tagline-transparent.png"), "PNG")

    # Also save standard logo-vertical-*.png pointing to tagline
    render_vertical_tagline("dark", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-dark.png"), "PNG")
    render_vertical_tagline("light", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-light.png"), "PNG")
    render_vertical_tagline("transparent", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-transparent.png"), "PNG")

    print("Master draw logo executed with exact uniform scale across all formats!")

if __name__ == "__main__":
    main()
