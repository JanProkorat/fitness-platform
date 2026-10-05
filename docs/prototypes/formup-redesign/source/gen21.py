"""Logo round 5: thin geometric monoline wordmark (from the reference) + three concepts A/B/C."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen16.py")).read().split("for n, name, why in DIRECTIONS:")[0]
exec(_src)

ACCENT = "#E5442E"
SCHEME = {
    "light": dict(bg="#F5F4F0", ink="#2A2A2A", muted="#8C8A85", border="1px solid #E2DFD6"),
    "dark": dict(bg="#121212", ink="#F2F2F2", muted="#9A9A9A", border="none"),
}
SW = 6  # stroke width in a 100-unit cap height
GAP = 26
WORD_GAP = 60

# Centre-line paths in a 100-unit cap height, y down.
GLYPHS = {
    "F": (64, ["M0 3H64", "M3 100V48H56"]),
    "O": (100, ["M3 50A47 47 0 1 0 97 50A47 47 0 1 0 3 50"]),
    "R": (70, ["M3 100V3H42A24 24 0 0 1 42 51H3", "M36 51L68 100"]),
    "M": (90, ["M3 100V3L45 90L87 3V100"]),
    "U": (72, ["M3 0V64A33 33 0 0 0 69 64V0"]),
    "P": (68, ["M3 100V3H42A24 24 0 0 1 42 51H3"]),
}


def g(paths, color, dx=0, sw=SW):
    d = " ".join(paths)
    return f'<path d="{d}" transform="translate({dx} 0)" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="miter" stroke-miterlimit="10"></path>'


def letters(word, color, x):
    out = ""
    for ch in word:
        w, p = GLYPHS[ch]
        out += g(p, color, x)
        x += w + GAP
    return out, x - GAP


def svg(inner, vb_w, vb_h, height, vb_y=0, pad=4):
    width = round(height * (vb_w + 2 * pad) / (vb_h + 2 * pad))
    return f'<svg width="{width}" height="{height}" viewBox="{-pad} {vb_y - pad} {vb_w + 2 * pad} {vb_h + 2 * pad}" aria-hidden="true">{inner}</svg>'


# ---------------------------------------------------------------- wordmarks
def wordmark_base(s, height):
    p = SCHEME[s]
    a, x = letters("FORM", p["ink"], 0)
    b, x = letters("UP", ACCENT, x + WORD_GAP)
    return svg(a + b, x, 100, height)


def up_ligature(color, x0):
    """U and P pushed together; the space between them is an arrow pointing up."""
    u = "M3 0V64A33 33 0 0 0 69 64V40H57L76 3"
    p = "M83 100V40H112A18.5 18.5 0 0 0 112 3H76L95 40"
    return g([u, p], color, x0), x0 + 132


def wordmark_b(s, height):
    p = SCHEME[s]
    a, x = letters("FORM", p["muted"], 0)
    b, x = up_ligature(ACCENT, x + WORD_GAP)
    return svg(a + b, x, 100, height)


def wordmark_c(s, height):
    p = SCHEME[s]
    a, x = letters("FORM", p["ink"], 0)
    b, x = letters("UP", p["ink"], x + WORD_GAP)
    flat = f'<path d="M0 130H468" fill="none" stroke="{p["ink"]}" stroke-width="3"></path>'
    rise = (f'<path d="M468 130L630 118L668 22" fill="none" stroke="{ACCENT}" stroke-width="3" stroke-linejoin="miter"></path>'
            f'<path d="M654 30L668 22L672 38" fill="none" stroke="{ACCENT}" stroke-width="3"></path>')
    return svg(a + b + flat + rise, 680, 136, height)


# ---------------------------------------------------------------- icons
def mark_a(s):
    p = SCHEME[s]
    return (f'<path d="M30 92V30H52" fill="none" stroke="{p["ink"]}" stroke-width="9" stroke-linejoin="miter"></path>'
            f'<path d="M30 58H46L56 48" fill="none" stroke="{p["ink"]}" stroke-width="9" stroke-linejoin="miter"></path>'
            f'<path d="M48 30H52L74 8" fill="none" stroke="{ACCENT}" stroke-width="9" stroke-linejoin="miter"></path>'
            f'<path d="M58 8H74V24" fill="none" stroke="{ACCENT}" stroke-width="9" stroke-linejoin="miter"></path>')


def mark_b(s):
    inner, _ = up_ligature(ACCENT, 0)
    return f'<g transform="translate(12 21) scale(0.58)">{inner.replace(f"stroke-width=\"{SW}\"", "stroke-width=\"10\"")}</g>'


def mark_c(s):
    p = SCHEME[s]
    return (f'<path d="M14 76H46" fill="none" stroke="{p["ink"]}" stroke-width="8"></path>'
            f'<path d="M46 76L66 70L80 22" fill="none" stroke="{ACCENT}" stroke-width="8" stroke-linejoin="miter"></path>'
            f'<path d="M68 30L80 22L86 36" fill="none" stroke="{ACCENT}" stroke-width="8" stroke-linejoin="miter"></path>')


def icon(mark, s, size):
    p = SCHEME[s]
    return (f'<div style="width: {size}px; height: {size}px; border-radius: {round(size * 0.225)}px; background: {p["bg"]}; border: {p["border"]}; box-sizing: border-box; flex-shrink: 0; '
            f'display: flex; align-items: center; justify-content: center; box-shadow: 0 {max(1, size // 40)}px {max(2, size // 12)}px rgba(0,0,0,0.14)">'
            f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">{mark(s)}</svg></div>')


# ---------------------------------------------------------------- board
def board(n, name, why, wordmark, mark):
    panel = lambda s: (f'<div style="flex-grow: 1; flex-basis: 0; height: 220px; border-radius: 18px; background: {SCHEME[s]["bg"]}; border: {SCHEME[s]["border"]}; box-sizing: border-box; '
                       f'display: flex; align-items: center; justify-content: center">{wordmark(s, 54)}</div>')
    sizes = lambda s: "".join(icon(mark, s, z) for z in (60, 32, 16))
    web = (f'<div style="flex-grow: 1; height: 64px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E2DFD6; box-sizing: border-box; padding: 0 20px; display: flex; align-items: center; gap: 14px">'
           f'{wordmark("light", 20)}<span style="margin-left: auto; font-size: 12px; color: #8C8A85">Web portal header</span></div>')
    app = (f'<div style="flex-grow: 1; height: 64px; border-radius: 12px; background: #121212; box-sizing: border-box; padding: 0 20px; display: flex; align-items: center; gap: 14px">'
           f'{icon(mark, "dark", 36)}{wordmark("dark", 18)}<span style="margin-left: auto; font-size: 12px; color: #9A9A9A">App sign-in</span></div>')
    body = f'''<div style="width: 1100px; height: 700px; box-sizing: border-box; padding: 26px 28px; background: #F6F5F2; font-family: 'DM Sans', sans-serif; color: #141414; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; align-items: baseline; gap: 12px"><span style="font-family: 'Outfit', sans-serif; font-size: 34px; font-weight: 300; color: {ACCENT}">{n}</span><span style="font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600">{name}</span></div>
<span style="font-size: 14px; line-height: 1.45; color: #6B6863; margin-top: -10px; max-width: 900px">{why}</span>
<div style="display: flex; gap: 14px">{panel("light")}{panel("dark")}</div>
<div style="display: flex; gap: 22px; align-items: flex-end">{icon(mark, "dark", 150)}{icon(mark, "light", 150)}
<div style="display: flex; flex-direction: column; gap: 12px"><div style="display: flex; gap: 12px; align-items: flex-end">{sizes("dark")}</div><div style="display: flex; gap: 12px; align-items: flex-end">{sizes("light")}</div></div>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px">{web}{app}</div></div>
</div>'''
    return page(f"Logo {n}", 1100, 700, body, T)


ROUND5 = [
    (21, "A · Dynamic F", "The F’s arms turn up at 45° like a rising chart. Only the top tip — the arrow — is red-orange. Built for the app icon; reads at 16 px.", wordmark_base, mark_a),
    (22, "B · The Hidden Arrow", "U and P are pushed together; the gap between them is an arrow pointing up. FORM is muted grey, UP is the accent.", wordmark_b, mark_b),
    (23, "C · The Progress Line", "One thin line runs under FORM UP, flat at first, then breaks upward under UP like a progress chart. Only the rising part is red-orange.", wordmark_c, mark_c),
]
for n, name, why, wm, mk in ROUND5:
    with open(os.path.join(HERE, "project", f"Logo{n}.dc.html"), "w") as f:
        f.write(board(n, name, why, wm, mk))
print("ok")
