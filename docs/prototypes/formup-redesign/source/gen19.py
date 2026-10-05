"""Logo round 4: solid, angular marks in the style of the Athlete Zone logo, with a condensed wordmark."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen16.py")).read().split("for n, name, why in DIRECTIONS:")[0]
exec(_src)

PAL4 = {"dark": dict(bg="#1E2228", ink="#F4F2EE", accent="#E5483D"), "light": dict(bg="#F7F6F0", ink="#22272E", accent="#D2342A")}


def mark(n, scheme, size):
    p = PAL4[scheme]
    poly = lambda pts, c: f'<polygon points="{pts}" fill="{c}"></polygon>'
    if n == 17:  # peak over U
        g = poly("50,8 78,52 64,52 50,30 36,52 22,52", p["ink"]) + poly("22,60 36,60 36,80 64,80 64,60 78,60 78,94 22,94", p["ink"])
    elif n == 18:  # arrow F
        g = (poly("50,6 72,34 58,34 58,94 42,94 42,34 28,34", p["ink"])
             + poly("58,46 82,46 76,56 58,56", p["ink"]) + poly("58,64 74,64 68,74 58,74", p["ink"]))
    elif n == 19:  # U launches F
        g = (poly("18,48 30,48 30,82 70,82 70,48 82,48 82,94 18,94", p["ink"])
             + poly("46,6 62,26 52,26 52,72 40,72 40,26 30,26", p["ink"])
             + poly("52,36 70,36 65,44 52,44", p["ink"]) + poly("52,52 64,52 59,60 52,60", p["ink"]))
    else:  # summit with F flag, split by a diagonal gap
        g = (poly("8,92 46,34 58,52 30,92", p["ink"]) + poly("36,92 62,56 92,92", p["ink"])
             + poly("46,34 50,28 50,8 54,8 54,34", p["ink"])
             + poly("54,8 74,8 70,14 54,14", p["ink"]) + poly("54,18 66,18 63,23 54,23", p["ink"]))
    return f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">{g}</svg>'


def icon4(n, scheme, size):
    p = PAL4[scheme]
    border = "border: 1px solid #E2DFD6;" if scheme == "light" else ""
    return f'<div style="width: {size}px; height: {size}px; border-radius: {round(size * 0.225)}px; background: {p["bg"]}; {border} box-sizing: border-box; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 {max(1, size // 40)}px {max(2, size // 12)}px rgba(0,0,0,0.12)">{mark(n, scheme, round(size * 0.74))}</div>'


WORD = "font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase"


def board4(n, name, why):
    small = lambda scheme, bg: f'<div style="border-radius: 18px; background: {bg}; padding: 14px; display: flex; align-items: flex-end; gap: 14px">{icon4(n, scheme, 60)}{icon4(n, scheme, 40)}<div style="display: flex; flex-direction: column; gap: 6px; align-items: center">{icon4(n, scheme, 32)}{icon4(n, scheme, 16)}</div></div>'
    tab = f'''<div style="display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 10px 10px 0 0; background: #ECEBE7; width: 210px; box-sizing: border-box; font: 12px 'DM Sans', sans-serif; color: #3A3835">{mark(n, "light", 16)}Form Up — Clients<span style="margin-left: auto; color: #8F8A82">×</span></div>'''
    lockup = lambda scheme: f'<div style="flex-grow: 1; height: 150px; border-radius: 18px; background: {PAL4[scheme]["bg"]}; {"border: 1px solid #E2DFD6;" if scheme == "light" else ""} box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px">{mark(n, scheme, 70)}<span style="{WORD}; font-size: 22px; color: {PAL4[scheme]["ink"]}; padding-left: 0.32em">Form Up</span></div>'
    body = f'''<div style="width: 760px; height: 620px; box-sizing: border-box; padding: 26px 28px; background: #F6F5F2; font-family: 'DM Sans', sans-serif; color: #141414; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; align-items: baseline; gap: 12px"><span style="font-family: 'Outfit', sans-serif; font-size: 34px; font-weight: 300; color: #D2342A">{n}</span><span style="font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 600">{name}</span></div>
<span style="font-size: 14px; color: #6B6863; margin-top: -10px">{why}</span>
<div style="display: flex; gap: 22px; align-items: flex-start">{icon4(n, "dark", 168)}{icon4(n, "light", 168)}
<div style="display: flex; flex-direction: column; gap: 10px">{small("dark", "#2A2826")}{small("light", "#FFFFFF")}{tab}</div></div>
<div style="display: flex; gap: 12px">{lockup("light")}{lockup("dark")}</div>
</div>'''
    html = page(f"Logo {n}", 760, 620, body, T)
    return html.replace("family=DM+Sans:", "family=Barlow+Condensed:wght@500;600;700&amp;family=DM+Sans:", 1)


ROUND4 = [
    (17, "Peak over U", "A solid upward chevron above a square U, split by a gap — “up” over “U”, built like your A-over-Z."),
    (18, "Arrow F", "An F whose stem is an upward arrow, with two angle-cut arms — reads as both F and up."),
    (19, "U launches F", "A square U with the arrow-F rising out of it — both initials in one solid mark."),
    (20, "Summit", "A solid mountain split by a diagonal gap, with a small F-shaped flag on the peak."),
]
for n, name, why in ROUND4:
    with open(os.path.join(HERE, "project", f"Logo{n}.dc.html"), "w") as f:
        f.write(board4(n, name, why))
print("ok")
