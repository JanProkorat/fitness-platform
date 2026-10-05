"""Logo round 3: marks built from F and U (summit flag, fork in bowl, kettlebell, U holds F)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen17.py")).read().split("ROUND2 = [")[0]
exec(_src)

_round2 = mark


def mark(n, scheme, size):
    if n <= 12:
        return _round2(n, scheme, size)
    p = PAL[scheme]
    line = lambda d, c, w=8: f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"></path>'
    if n == 13:  # summit flag: upside-down U as a hill, F as the flag on top
        g = line("M20 84 V62 C20 36 80 36 80 62 V84", p["ink"]) + line("M50 41 V12 H70", p["red"], 7) + line("M50 24 H63", p["red"], 7)
    elif n == 14:  # fork in the bowl: U as a bowl, F rising out of it
        g = line("M22 48 V56 C22 74 34 84 50 84 C66 84 78 74 78 56 V48", p["ink"]) + line("M44 66 V14 H62", p["red"], 7) + line("M44 28 H57", p["red"], 7)
    elif n == 15:  # kettlebell: upside-down U as the handle, F cut out of the body
        g = (line("M34 46 V34 C34 16 66 16 66 34 V46", p["ink"], 7)
             + f'<circle cx="50" cy="64" r="26" fill="{p["ink"]}"></circle>'
             + line("M44 76 V53 H59", p["red"], 6) + line("M44 64 H55", p["red"], 6))
    else:  # U holds F
        g = line("M24 24 V56 C24 74 36 83 50 83 C64 83 76 74 76 56 V24", p["ink"]) + line("M43 64 V28 H59", p["red"], 7) + line("M43 45 H54", p["red"], 7)
    return f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">{g}</svg>'


ROUND3 = [
    (13, "Summit flag", "The U turned upside down is a hill; the F is the flag planted on top — goal reached."),
    (14, "Fork in the bowl", "The U is a bowl, the F rises out of it like a fork — nutrition with the initials built in."),
    (15, "Kettlebell", "The upside-down U is the handle, the F is cut out of the bell — strength with hidden initials."),
    (16, "U holds F", "The F sits inside the U like something held in a cup — a compact monogram that avoids reading “FU”."),
]
for n, name, why in ROUND3:
    with open(os.path.join(HERE, "project", f"Logo{n}.dc.html"), "w") as f:
        f.write(board(n, name, why))
print("ok")
