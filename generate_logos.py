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

# 1. Icon Only (512x512)
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

    draw.rounded_rectangle([24 * scale, 24 * scale, (24 + 28) * scale, (24 + 152) * scale], radius=int(14 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([64 * scale, 24 * scale, (64 + 86) * scale, (24 + 28) * scale], radius=int(14 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([64 * scale, 66 * scale, (64 + 112) * scale, (66 + 28) * scale], radius=int(14 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([64 * scale, 108 * scale, (64 + 72) * scale, (108 + 28) * scale], radius=int(14 * scale), fill=hex_to_rgb(colors["bar3"]))
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
        "stem": "#f59e0b",
        "bar1": "#16a34a" if bg_type == "light" else "#4ade80",
        "bar2": "#2563eb" if bg_type == "light" else "#60a5fa",
        "bar3": "#9333ea" if bg_type == "light" else "#c084fc",
        "text": "#0f172a" if bg_type == "light" else "#f8fafc"
    }

    ox, oy = (24 * scale), (0 * scale)
    draw.rounded_rectangle([ox + 24 * scale, oy + 24 * scale, ox + (24 + 26) * scale, oy + (24 + 132) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 24 * scale, ox + (62 + 70) * scale, oy + (24 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 59 * scale, ox + (62 + 95) * scale, oy + (59 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 94 * scale, ox + (62 + 60) * scale, oy + (94 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar3"]))

    font = get_font(int(100 * scale))
    tx = int(220 * scale)
    ty = int(32 * scale)
    draw.text((tx, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((tx + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)
    return img

# 3. Horizontal With Tagline: [ P ] Pathd / Media Tracker & Guides (1280 x 360)
def render_horizontal_tagline(bg_type="dark", size=(1280, 360)):
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
        "text": "#0f172a" if bg_type == "light" else "#f8fafc",
        "subtext": "#475569" if bg_type == "light" else "#94a3b8"
    }

    ox, oy = (18 * scale), (0 * scale)
    draw.rounded_rectangle([ox + 24 * scale, oy + 24 * scale, ox + (24 + 26) * scale, oy + (24 + 132) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 24 * scale, ox + (62 + 70) * scale, oy + (24 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 59 * scale, ox + (62 + 95) * scale, oy + (59 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([ox + 62 * scale, oy + 94 * scale, ox + (62 + 60) * scale, oy + (94 + 26) * scale], radius=int(13 * scale), fill=hex_to_rgb(colors["bar3"]))

    font = get_font(int(84 * scale))
    tx = int(220 * scale)
    ty = int(18 * scale)
    draw.text((tx, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((tx + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)

    sub_font = get_font(int(19 * scale))
    draw.text((tx + int(4 * scale), ty + int(96 * scale)), "MEDIA TRACKER & GUIDES", fill=hex_to_rgb(colors["subtext"]), font=sub_font)
    return img

# 4. Vertical Clean - Scaled and Balanced (1000 x 1000 Square)
def render_vertical_clean(bg_type="dark", size=(1000, 1000)):
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
        "text": "#0f172a" if bg_type == "light" else "#f8fafc"
    }

    # Center icon: ox=155, oy=52
    ox, oy = (155 * scale), (52 * scale)
    draw.rounded_rectangle([ox, oy, ox + (36 * scale), oy + (232 * scale)], radius=int(18 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([ox + (52 * scale), oy, ox + (52 + 110) * scale, oy + (36 * scale)], radius=int(18 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([ox + (52 * scale), oy + (54 * scale), ox + (52 + 144) * scale, oy + (54 + 36) * scale], radius=int(18 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([ox + (52 * scale), oy + (108 * scale), ox + (52 + 92) * scale, oy + (108 + 36) * scale], radius=int(18 * scale), fill=hex_to_rgb(colors["bar3"]))

    font = get_font(int(108 * scale))
    full_text = "Pathd"
    full_w = draw.textlength(full_text, font=font)
    start_x = (size[0] - full_w) / 2
    ty = int(324 * scale)

    draw.text((start_x, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((start_x + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)
    return img

# 5. Vertical With Tagline - Scaled and Balanced (1000 x 1000 Square)
def render_vertical_tagline(bg_type="dark", size=(1000, 1000)):
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

    # Center icon: ox=160, oy=44
    ox, oy = (160 * scale), (44 * scale)
    draw.rounded_rectangle([ox, oy, ox + (34 * scale), oy + (206 * scale)], radius=int(17 * scale), fill=hex_to_rgb(colors["stem"]))
    draw.rounded_rectangle([ox + (48 * scale), oy, ox + (48 + 98) * scale, oy + (34 * scale)], radius=int(17 * scale), fill=hex_to_rgb(colors["bar1"]))
    draw.rounded_rectangle([ox + (48 * scale), oy + (48 * scale), ox + (48 + 132) * scale, oy + (48 + 34) * scale], radius=int(17 * scale), fill=hex_to_rgb(colors["bar2"]))
    draw.rounded_rectangle([ox + (48 * scale), oy + (96 * scale), ox + (48 + 84) * scale, oy + (96 + 34) * scale], radius=int(17 * scale), fill=hex_to_rgb(colors["bar3"]))

    font = get_font(int(94 * scale))
    full_text = "Pathd"
    full_w = draw.textlength(full_text, font=font)
    start_x = (size[0] - full_w) / 2
    ty = int(285 * scale)

    draw.text((start_x, ty), "Path", fill=hex_to_rgb(colors["text"]), font=font)
    path_w = draw.textlength("Path", font=font)
    draw.text((start_x + path_w, ty), "d", fill=hex_to_rgb("#f59e0b"), font=font)

    sub_font = get_font(int(20 * scale))
    sub_text = "MEDIA TRACKER & GUIDES"
    sub_w = draw.textlength(sub_text, font=sub_font)
    sub_x = (size[0] - sub_w) / 2
    sub_y = int(395 * scale)
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
    render_vertical_tagline("dark", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-dark.png"), "PNG")
    render_vertical_tagline("light", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-light.png"), "PNG")
    render_vertical_tagline("transparent", (1000, 1000)).save(os.path.join(target_dir, "logo-vertical-transparent.png"), "PNG")

    print("All Brand Suites aligned and regenerated with expanded balanced proportions!")

if __name__ == "__main__":
    main()
