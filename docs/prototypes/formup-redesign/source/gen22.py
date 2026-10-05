"""Logo round 6: symbol concepts (barbell + leaf, checkbox arrow, guided path) with the thin wordmark."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
__file__ = os.path.join(HERE, "gen21.py")
exec(open(__file__).read().split("ROUND5 = [")[0])

LINE = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'


def mark_balance(s):
    p = SCHEME[s]
    return (f'<path d="M10 62H44Q58 62 68 52" {LINE} stroke="{p["ink"]}" stroke-width="5"></path>'
            f'<rect x="18" y="34" width="10" height="56" rx="4" {LINE} stroke="{p["ink"]}" stroke-width="5"></rect>'
            f'<rect x="33" y="44" width="8" height="36" rx="3" {LINE} stroke="{p["ink"]}" stroke-width="5"></rect>'
            f'<path d="M68 52C62 34 70 16 90 8C94 30 88 46 68 52Z" {LINE} stroke="{ACCENT}" stroke-width="5"></path>'
            f'<path d="M68 52L84 22" {LINE} stroke="{ACCENT}" stroke-width="3.5"></path>')


def mark_plan(s):
    p = SCHEME[s]
    box = "M56 30H22A8 8 0 0 0 14 38V80A8 8 0 0 0 22 88H64A8 8 0 0 0 72 80V46"
    return (f'<path d="{box}" {LINE} stroke="{p["muted"]}" stroke-width="5"></path>'
            f'<path d="M28 58L42 72L80 16" fill="none" stroke="{ACCENT}" stroke-width="9" stroke-linejoin="miter" stroke-linecap="butt"></path>'
            f'<path d="M66 14H82V30" fill="none" stroke="{ACCENT}" stroke-width="9" stroke-linejoin="miter" stroke-linecap="butt"></path>')


def mark_guide(s):
    p = SCHEME[s]
    return (f'<path d="M16 88C16 66 84 76 82 56C80 40 34 48 38 32" {LINE} stroke="{p["ink"]}" stroke-width="5"></path>'
            f'<path d="M38 32C40 20 56 14 74 12" {LINE} stroke="{ACCENT}" stroke-width="5"></path>'
            f'<path d="M64 5L75 12L66 21" {LINE} stroke="{ACCENT}" stroke-width="5"></path>'
            f'<circle cx="82" cy="56" r="6.5" fill="{p["ink"]}"></circle>'
            f'<circle cx="38" cy="32" r="6.5" fill="{ACCENT}"></circle>')


ROUND6 = [
    (24, "1 · The Core Balance", "A barbell from the side: the bar bends slightly upward, and the far plate turns into a fresh leaf. White barbell, red-orange leaf — training and nutrition under one roof.", wordmark_base, mark_balance),
    (25, "2 · The Progress Plan", "A muted grey checkbox — the plan. The tick is a strong red-orange arrow that breaks through the box’s corner and shoots upward — done today, moving forward.", wordmark_base, mark_plan),
    (26, "3 · The Athlete & Guide", "A path that winds upward, with two dots: white is the client, red-orange is the coach ahead. The coach’s part of the path and the arrow are red-orange — guided, not alone.", wordmark_base, mark_guide),
]
for n, name, why, wm, mk in ROUND6:
    with open(os.path.join(HERE, "project", f"Logo{n}.dc.html"), "w") as f:
        f.write(board(n, name, why, wm, mk))
print("ok")
