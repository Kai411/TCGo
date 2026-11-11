"""Build the PWA splash assets from the existing TCGo logo files.

    python3 scripts/generate-splash.py      (needs Pillow)

Writes, under public/:
  splash-logo.png / splash-logo-dark.png   the logo cropped to its artwork, for
                                           the in-page cover (app/spa-loading-template.html)
  splash/<w>x<h>-<light|dark>.png          iPhone startup images, one per screen size

The logo is never redrawn: it is cropped and scaled from tcgo_sprites.png
(dark lettering, light theme) and tcgo_sprites_white.png (white lettering).

Re-run after changing the logo, LOGO_WIDTH or the colours, and keep the
<link rel="apple-touch-startup-image"> tags in nuxt.config.ts in step with
DEVICES. LOGO_WIDTH and the colours must match the template, or the logo jumps
when iOS swaps its startup image for the page.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# Logo width in CSS px, same as `width` in app/spa-loading-template.html.
LOGO_WIDTH = 180

# tailwind.config.ts canvas.DEFAULT and canvas.inverse.
BACKGROUND = {"light": (250, 250, 250), "dark": (17, 17, 20)}
SOURCE = {"light": "tcgo_sprites.png", "dark": "tcgo_sprites_white.png"}

# Where the artwork sits inside both source files (they share a layout), as
# fractions of the image: left, top, right, bottom. Faint glow is left out so
# the lettering is what gets centred.
CROP = (0.1074, 0.2905, 0.9043, 0.6602)

# iPhones, portrait only (the manifest locks portrait). CSS width, CSS height,
# device pixel ratio, status bar height in points. With the status bar style
# "default" the page starts below the status bar, so the logo is centred on the
# area under it to land exactly where the in-page cover draws it.
DEVICES = [
    (440, 956, 3, 62),  # 16 Pro Max, 17 Pro Max
    (430, 932, 3, 59),  # 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
    (420, 912, 3, 62),  # Air
    (402, 874, 3, 62),  # 16 Pro, 17, 17 Pro
    (393, 852, 3, 59),  # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3, 47),  # 12 Pro Max, 13 Pro Max, 14 Plus
    (390, 844, 3, 47),  # 12, 12 Pro, 13, 13 Pro, 14, 16e
    (414, 896, 3, 44),  # XS Max, 11 Pro Max
    (414, 896, 2, 48),  # XR, 11
    (375, 812, 3, 44),  # X, XS, 11 Pro, 12 mini, 13 mini
    (414, 736, 3, 20),  # 6s Plus, 7 Plus, 8 Plus
    (375, 667, 2, 20),  # 6s, 7, 8, SE 2nd and 3rd gen
    (320, 568, 2, 20),  # SE 1st gen
]


def cropped_logo(theme):
    im = Image.open(PUBLIC / SOURCE[theme]).convert("RGBA")
    w, h = im.size
    l, t, r, b = CROP
    return im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))


def scaled(logo, width):
    height = round(logo.height * width / logo.width)
    return logo.resize((width, height), Image.LANCZOS)


def save(im, path):
    # 256 colours is visually identical here and a fraction of the size.
    im.quantize(256, method=Image.FASTOCTREE).save(path, optimize=True)


def main():
    (PUBLIC / "splash").mkdir(exist_ok=True)
    for theme in ("light", "dark"):
        logo = cropped_logo(theme)

        # 3x the CSS width covers every phone screen.
        name = "splash-logo.png" if theme == "light" else "splash-logo-dark.png"
        save(scaled(logo, LOGO_WIDTH * 3), PUBLIC / name)

        for css_w, css_h, dpr, status_bar in DEVICES:
            w, h = css_w * dpr, css_h * dpr
            canvas = Image.new("RGBA", (w, h), BACKGROUND[theme] + (255,))
            mark = scaled(logo, LOGO_WIDTH * dpr)
            centre_y = (status_bar + (css_h - status_bar) / 2) * dpr
            x = round((w - mark.width) / 2)
            y = round(centre_y - mark.height / 2)
            canvas.alpha_composite(mark, (x, y))
            save(canvas.convert("RGB"), PUBLIC / "splash" / f"{w}x{h}-{theme}.png")


if __name__ == "__main__":
    main()
