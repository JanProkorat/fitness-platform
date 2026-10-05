"""Logo round 2: marks drawn from the field (plate, kettlebell+leaf, arms up, check-in tick, bowl, whistle)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen16.py")).read().split("for n, name, why in DIRECTIONS:")[0]
exec(_src)

_round1 = mark


def mark(n, scheme, size):
    if n <= 6:
        return _round1(n, scheme, size)
    p = PAL[scheme]
    line = lambda d, c, w=7: f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"></path>'
    if n == 7:  # the plate: weight plate as a dinner plate, fork and knife
        g = (f'<circle cx="50" cy="54" r="27" fill="none" stroke="{p["ink"]}" stroke-width="6"></circle>'
             f'<circle cx="50" cy="54" r="7" fill="none" stroke="{p["red"]}" stroke-width="5"></circle>'
             + line("M39 38 A17 17 0 0 1 61 38", p["ink"], 4)
             + line("M12 30 V80", p["ink"], 4) + line("M8 30 V42 Q12 48 16 42 V30", p["ink"], 4)
             + line("M88 80 V30 C94 34 94 46 88 52", p["ink"], 4))
    elif n == 8:  # kettlebell with a leaf
        g = (line("M35 44 V34 C35 18 65 18 65 34 V44", p["ink"], 7)
             + f'<circle cx="50" cy="62" r="25" fill="{p["ink"]}"></circle>'
             + f'<path d="M50 47 C63 52 63 69 50 77 C37 69 37 52 50 47 Z" fill="{p["green"]}"></path>'
             + line("M50 53 V72", p["bg"], 2.5))
    elif n == 9:  # arms up
        g = (f'<circle cx="50" cy="26" r="8" fill="{p["red"]}"></circle>'
             + line("M24 22 L50 52 L76 22", p["ink"], 8) + line("M50 52 V64", p["ink"], 8) + line("M38 84 L50 64 L62 84", p["ink"], 8))
    elif n == 10:  # check-in tick leaving the card
        g = (f'<rect x="22" y="24" width="48" height="58" rx="9" fill="none" stroke="{p["ink"]}" stroke-width="6"></rect>'
             + line("M34 54 L45 65 L82 18", p["red"], 8))
    elif n == 11:  # bowl and steam
        g = (f'<path d="M20 56 H80 C80 73 67 84 50 84 C33 84 20 73 20 56 Z" fill="{p["ink"]}"></path>'
             + line("M50 48 C41 40 59 32 50 20", p["red"], 6) + line("M43 25 L50 17 L57 25", p["red"], 6))
    else:  # whistle with a rising cord
        g = (f'<circle cx="42" cy="62" r="20" fill="{p["ink"]}"></circle>'
             f'<rect x="44" y="42" width="38" height="16" rx="5" fill="{p["ink"]}"></rect>'
             f'<circle cx="42" cy="62" r="6" fill="{p["bg"]}"></circle>'
             + line("M28 48 C14 38 18 16 34 16 C48 16 50 30 40 36", p["red"], 5))
    return f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">{g}</svg>'


ROUND2 = [
    (7, "The plate", "A weight plate that is also a dinner plate, with fork and knife — “plate” means lifting and eating."),
    (8, "Kettlebell with a leaf", "A kettlebell whose body carries the nutrition leaf — strength and food in one shape."),
    (9, "Arms up", "A figure with raised arms finishing a workout — achievement, and a V that reads as “up”."),
    (10, "Check-in tick", "A card whose tick shoots up and out — the weekly check-in, and progress beyond it."),
    (11, "Bowl and steam", "A bowl whose steam rises into an arrow — healthy food moving forward. Leans to nutrition."),
    (12, "Whistle", "A coach's whistle with its cord looping upward — having a coach. Reads more sports team."),
]
for n, name, why in ROUND2:
    with open(os.path.join(HERE, "project", f"Logo{n}.dc.html"), "w") as f:
        f.write(board(n, name, why))
print("ok")
