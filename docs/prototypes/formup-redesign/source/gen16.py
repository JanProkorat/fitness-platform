"""Logo / app-icon directions: six marks, each shown as app icon (dark + light), small sizes, and wordmark lockup."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen.py")).read().split("# ---------------------------------------------------------------- palette")[0]
_src = _src.replace('os.path.dirname(__file__)', repr(HERE))
exec(_src)

T = DIRS["C"]
PAL = {
    "dark": dict(bg="#141414", ink="#F4F2EE", red="#E5483D", orange="#F28C38", green="#8CC152"),
    "light": dict(bg="#FFFFFF", ink="#141414", red="#D2342A", orange="#E87A25", green="#5E9E34"),
}


def mark(n, scheme, size):
    p = PAL[scheme]
    sw = 7
    line = lambda d, c, w=sw: f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"></path>'
    if n == 1:  # the up step
        g = line("M20 74 H40 V56 H58 V38", p["ink"]) + line("M58 38 H80 V22", p["red"])
    elif n == 2:  # two strands
        g = line("M24 80 L44 42", p["orange"], 8) + line("M76 80 L56 42", p["green"], 8) + line("M38 44 L50 22 L62 44", p["red"], 8)
    elif n == 3:  # progress ring with notch
        g = (f'<circle cx="50" cy="54" r="30" fill="none" stroke="{p["ink"]}" stroke-width="9" stroke-linecap="round" stroke-dasharray="150 189" transform="rotate(-60 50 54)"></circle>'
             + line("M41 22 L50 13 L59 22", p["red"], 8))
    elif n == 4:  # F-U monogram
        g = line("M54 24 H30 V60", p["ink"]) + line("M30 42 H46", p["ink"]) + line("M30 60 C30 80 70 80 70 60 V24", p["red"])
    elif n == 5:  # two dots, one path
        g = (line("M28 70 C48 70 52 34 72 34", p["ink"], 5)
             + f'<circle cx="28" cy="70" r="9" fill="{p["ink"]}"></circle><circle cx="72" cy="34" r="9" fill="{p["red"]}"></circle>')
    else:  # three rising bars
        g = (f'<rect x="20" y="54" width="16" height="24" rx="8" fill="{p["orange"]}"></rect>'
             f'<rect x="42" y="40" width="16" height="38" rx="8" fill="{p["green"]}"></rect>'
             f'<rect x="64" y="22" width="16" height="56" rx="8" fill="{p["red"]}"></rect>')
    return f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">{g}</svg>'


def icon(n, scheme, size):
    p = PAL[scheme]
    border = "border: 1px solid #E6E3DD;" if scheme == "light" else ""
    return f'<div style="width: {size}px; height: {size}px; border-radius: {round(size * 0.225)}px; background: {p["bg"]}; {border} box-sizing: border-box; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 {max(1, size // 40)}px {max(2, size // 12)}px rgba(0,0,0,0.12)">{mark(n, scheme, round(size * 0.86))}</div>'


DIRECTIONS = [
    (1, "The up step", "A line climbing in steps — steady progress, week by week. Grows out of the wordmark's F."),
    (2, "Two strands, one direction", "Training (orange) and nutrition (green) meeting in one upward peak."),
    (3, "Progress ring", "A ring almost closed, its gap turned into an upward notch — goals closing in."),
    (4, "F·U monogram", "The F flows into the U in one stroke. Brand initials — but the letters read badly in English."),
    (5, "Two dots, one path", "Coach and client joined by a rising path — the relationship behind the product."),
    (6, "Three rising bars", "Orange, green, red bars growing — simple and clear, but common."),
]
W, H = 760, 470


def board(n, name, why):
    small = lambda scheme, bg: f'<div style="border-radius: 18px; background: {bg}; padding: 14px; display: flex; align-items: flex-end; gap: 14px">{icon(n, scheme, 60)}{icon(n, scheme, 40)}<div style="display: flex; flex-direction: column; gap: 6px; align-items: center">{icon(n, scheme, 32)}{icon(n, scheme, 16)}</div></div>'
    tab = f'''<div style="display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 10px 10px 0 0; background: #ECEBE7; width: 210px; box-sizing: border-box; font: 12px 'DM Sans', sans-serif; color: #3A3835">{mark(n, "light", 16)}Form Up — Clients<span style="margin-left: auto; color: #8F8A82">×</span></div>'''
    lockup = lambda scheme, bg: f'<div style="flex-grow: 1; height: 72px; border-radius: 18px; background: {bg}; display: flex; align-items: center; justify-content: center; gap: 12px; {"border: 1px solid #E6E3DD;" if scheme == "light" else ""} box-sizing: border-box">{mark(n, scheme, 40)}{logo("B", scheme == "dark", 20)}</div>'
    body = f'''<div style="width: {W}px; height: {H}px; box-sizing: border-box; padding: 26px 28px; background: #F6F5F2; font-family: 'DM Sans', sans-serif; color: #141414; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; align-items: baseline; gap: 12px"><span style="font-family: 'Outfit', sans-serif; font-size: 34px; font-weight: 300; color: #D2342A">{n}</span><span style="font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600">{name}</span></div>
<span style="font-size: 14px; color: #6B6863; margin-top: -10px">{why}</span>
<div style="display: flex; gap: 22px; align-items: flex-start">
{icon(n, "dark", 168)}{icon(n, "light", 168)}
<div style="display: flex; flex-direction: column; gap: 10px">{small("dark", "#2A2826")}{small("light", "#FFFFFF")}{tab}</div>
</div>
<div style="display: flex; gap: 12px">{lockup("light", "#FFFFFF")}{lockup("dark", "#141414")}</div>
</div>'''
    return page(f"Logo {n}", W, H, body, T)


for n, name, why in DIRECTIONS:
    with open(os.path.join(HERE, "project", f"Logo{n}.dc.html"), "w") as f:
        f.write(board(n, name, why))
print("ok")
