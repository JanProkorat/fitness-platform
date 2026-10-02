import json, os, datetime

ROOT = os.path.join(os.path.dirname(__file__), "project")
os.makedirs(ROOT, exist_ok=True)

GRAD = "linear-gradient(90deg,#E8501E 0%,#D9700F 22%,#B8860B 42%,#9A9A1E 58%,#6AAE5E 80%,#4FBF9A 100%)"
MACRO = {"PROT": "#3563C9", "CARB": "#7A4FD0", "FAT": "#B53C7E", "FIB": "#2E9CB0"}

DIRS = {
    "A": dict(
        TAG="A · Spectrum", GROUND="#F5F6F3", SURFACE="#FFFFFF", INK="#16181D", INK2="#454A54",
        MUTED="#6B7180", LINE="#E3E5E8", SIDEBAR="#16181D", SIDEBAR_ACTIVE="#272A32",
        SIDEBAR_TEXT="#F2F3F0", SIDEBAR_MUTED="#9CA1AB", PRIMARY="#16181D", PRIMARY_TEXT="#FFFFFF",
        TRAIN="#C2410C", TRAIN_SOFT="#FDEBDF", TRAIN_INK="#9A3412", TRAIN_BRIGHT="#F07A3E",
        NUTRI="#1E7A5C", NUTRI_SOFT="#DFF3EA", NUTRI_INK="#155E46", NUTRI_BRIGHT="#4FBF9A",
        MARKER=GRAD, DANGER="#B42318", DANGER_SOFT="#FDE7E4",
    ),
    "B": dict(
        TAG="B · Ink & Red", GROUND="#ECEBE7", SURFACE="#FAF9F6", INK="#141414", INK2="#3F3D3A",
        MUTED="#6E6B66", LINE="#DAD8D2", SIDEBAR="#141414", SIDEBAR_ACTIVE="#27251F",
        SIDEBAR_TEXT="#F4F2EE", SIDEBAR_MUTED="#A19D95", PRIMARY="#141414", PRIMARY_TEXT="#FAF9F6",
        TRAIN="#B45309", TRAIN_SOFT="#F3E3CC", TRAIN_INK="#8A3F07", TRAIN_BRIGHT="#D9822B",
        NUTRI="#4A6B2F", NUTRI_SOFT="#E1E7D3", NUTRI_INK="#3A5424", NUTRI_BRIGHT="#8FAE5E",
        MARKER="#C8382F", DANGER="#9F1F17", DANGER_SOFT="#F5DEDA",
    ),
    "C": dict(
        TAG="C · Ink & Red, energetic", GROUND="#FFFFFF", SURFACE="#FFFFFF", INK="#141414", INK2="#3A3835",
        MUTED="#6B6863", LINE="#E7E4DE", SIDEBAR="#141414", SIDEBAR_ACTIVE="#2A2723",
        SIDEBAR_TEXT="#F6F4F0", SIDEBAR_MUTED="#A8A49C", PRIMARY="#141414", PRIMARY_TEXT="#FFFFFF",
        TRAIN="#C2510C", TRAIN_SOFT="#FFE8D2", TRAIN_INK="#8A3F07", TRAIN_BRIGHT="#F28C38",
        NUTRI="#3F7D2A", NUTRI_SOFT="#E3F1D4", NUTRI_INK="#2F5E1F", NUTRI_BRIGHT="#8CC152",
        MARKER="#D2342A", DANGER="#9F1F17", DANGER_SOFT="#FBE3DF", BOLD="1",
    ),
}
for _t in DIRS.values():
    _t.setdefault("ON_TRAIN", "#FFFFFF")
    _t.setdefault("ON_NUTRI", "#FFFFFF")
    _t.setdefault("CTA_BG", "#FFFFFF")
    _t.setdefault("CTA_TEXT", _t["TRAIN_INK"])
    _t.setdefault("BOLD", "")

# Row C's mobile screens: dark ground, bright section colours carrying dark text.
CM = dict(DIRS["C"], GROUND="#0F0F10", SURFACE="#1B1B1D", INK="#F4F2EE", INK2="#CFCAC2", MUTED="#948F87",
          LINE="#2C2B2E", PRIMARY="#F4F2EE", PRIMARY_TEXT="#141414",
          TRAIN="#F28C38", TRAIN_SOFT="#3A2414", TRAIN_INK="#F7A863", ON_TRAIN="#141414",
          NUTRI="#8CC152", NUTRI_SOFT="#243319", NUTRI_INK="#A9D673", ON_NUTRI="#141414",
          CTA_BG="#141414", CTA_TEXT="#F28C38", MARKER="#E5483D")

PATHS = {
    "home": '<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path>',
    "users": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2"></path>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"></path>',
    "dumbbell": '<path d="M6 7v10"></path><path d="M3 9.5v5"></path><path d="M18 7v10"></path><path d="M21 9.5v5"></path><path d="M6 12h12"></path>',
    "leaf": '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"></path><path d="M5 19l7-7"></path>',
    "book": '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path><path d="M4 21V5"></path>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15" rx="2"></rect><path d="M3.5 10h17"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
    "chevron": '<path d="M9 6l6 6-6 6"></path>',
    "back": '<path d="M15 6l-6 6 6 6"></path>',
    "clock": '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
    "plus": '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    "search": '<circle cx="11" cy="11" r="6.5"></circle><path d="M20 20l-4.2-4.2"></path>',
    "bell": '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"></path><path d="M10 20.5a2 2 0 0 0 4 0"></path>',
    "user": '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4.2 4.2-6.5 8-6.5s7 2.3 8 6.5"></path>',
    "grid": '<rect x="4" y="4" width="7" height="7" rx="1.5"></rect><rect x="13" y="4" width="7" height="7" rx="1.5"></rect><rect x="4" y="13" width="7" height="7" rx="1.5"></rect><rect x="13" y="13" width="7" height="7" rx="1.5"></rect>',
    "list": '<path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path><circle cx="4.5" cy="6" r="1"></circle><circle cx="4.5" cy="12" r="1"></circle><circle cx="4.5" cy="18" r="1"></circle>',
    "clipboard": '<rect x="5" y="4.5" width="14" height="16.5" rx="2"></rect><path d="M9 4.5h6v3H9z"></path><path d="M9 12h6"></path><path d="M9 16h4"></path>',
    "cart": '<path d="M3 4h2.5l2.2 11h10.6L20.5 7H6.6"></path><circle cx="9.5" cy="19" r="1.3"></circle><circle cx="17" cy="19" r="1.3"></circle>',
    "alert": '<path d="M12 4l9 16H3z"></path><path d="M12 10v4"></path><path d="M12 17.2v.1"></path>',
}


def ic(name, size=18, color="currentColor", sw="1.8"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{PATHS[name]}</svg>')


def logo(d, dark, size):
    base = f"font-family: 'Outfit', sans-serif; font-weight: 300; font-size: {size}px; letter-spacing: 0.22em; line-height: 1; white-space: nowrap"
    if d == "A":
        return (f'<span style="{base}; background: {GRAD}; -webkit-background-clip: text; background-clip: text; '
                f'color: transparent">FORM UP</span>')
    form = "#F4F2EE" if dark else "#141414"
    return f'<span style="{base}; color: {form}">FORM <span style="color: #C8382F">UP</span></span>'


def fill(s, t):
    for k, v in {**t, **MACRO}.items():
        s = s.replace(f"%%{k}%%", v)
    assert "%%" not in s, s[s.index("%%"):s.index("%%") + 40]
    return s


def page(title, w, h, body, t):
    return fill(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&amp;family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:%%INK%%}}a:hover{{color:%%INK2%%}}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
''', t)


FONT = "font-family: 'DM Sans', sans-serif"
DISP = "font-family: 'Outfit', sans-serif"


# ---------------------------------------------------------------- palette
def palette(d, t):
    rows = [
        ("Ink · primary buttons", t["INK"]), ("Ground", t["GROUND"]), ("Surface", t["SURFACE"]),
        ("Training", t["TRAIN"]), ("Training soft", t["TRAIN_SOFT"]),
        ("Nutrition", t["NUTRI"]), ("Nutrition soft", t["NUTRI_SOFT"]),
        ("Brand accent", "gradient" if d == "A" else t["MARKER"]), ("Error", t["DANGER"]),
    ]
    sw = ""
    for name, hexv in rows:
        bg = t["MARKER"] if name == "Brand accent" else hexv
        sw += f'''<div style="display: flex; align-items: center; gap: 14px">
<div style="width: 44px; height: 44px; border-radius: 10px; background: {bg}; border: 1px solid %%LINE%%; flex-shrink: 0"></div>
<div style="display: flex; flex-direction: column; gap: 2px">
<div style="font-size: 14px; font-weight: 600; color: %%INK%%">{name}</div>
<div style="font-size: 12px; color: %%MUTED%%; font-family: ui-monospace, monospace">{hexv}</div>
</div>
</div>
'''
    body = f'''<div style="width: 560px; height: 900px; box-sizing: border-box; padding: 40px; background: %%GROUND%%; {FONT}; color: %%INK%%; display: flex; flex-direction: column; gap: 24px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: %%MUTED%%">{t["TAG"]}</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<div style="height: 112px; border-radius: 16px; background: %%SURFACE%%; border: 1px solid %%LINE%%; display: flex; align-items: center; justify-content: center">{logo(d, False, 24)}</div>
<div style="height: 112px; border-radius: 16px; background: %%SIDEBAR%%; display: flex; align-items: center; justify-content: center">{logo(d, True, 24)}</div>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px">
{sw}</div>
<div style="display: flex; flex-wrap: wrap; gap: 10px">
<button style="height: 44px; padding: 0 18px; border-radius: 10px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font: 600 14px 'DM Sans', sans-serif">Publish week</button>
<button style="height: 44px; padding: 0 18px; border-radius: 10px; border: none; background: %%TRAIN%%; color: %%ON_TRAIN%%; font: 600 14px 'DM Sans', sans-serif">Start workout</button>
<button style="height: 44px; padding: 0 18px; border-radius: 10px; border: none; background: %%NUTRI%%; color: %%ON_NUTRI%%; font: 600 14px 'DM Sans', sans-serif">Log meal</button>
<button style="height: 44px; padding: 0 18px; border-radius: 10px; border: 1px solid %%DANGER%%; background: %%DANGER_SOFT%%; color: %%DANGER%%; font: 600 14px 'DM Sans', sans-serif; display: flex; align-items: center; gap: 8px">{ic("alert", 16)}Delete plan</button>
</div>
<div style="display: flex; gap: 8px">
<span style="padding: 6px 12px; border-radius: 999px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("dumbbell", 14)}Training</span>
<span style="padding: 6px 12px; border-radius: 999px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("leaf", 14)}Nutrition</span>
</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: %%MUTED%%">Macros (both directions)</div>
<div style="display: flex; gap: 16px; font-size: 13px; color: %%INK2%%">
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 3px; background: %%PROT%%"></span>Protein</span>
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 3px; background: %%CARB%%"></span>Carbs</span>
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 3px; background: %%FAT%%"></span>Fat</span>
</div>
</div>
</div>'''
    return page(f"Palette {d}", 560, 900, body, t)


# ---------------------------------------------------------------- web
def nav_item(label, icon, active=False, badge=None):
    bg = "%%SIDEBAR_ACTIVE%%" if active else "transparent"
    col = "%%SIDEBAR_TEXT%%" if active else "%%SIDEBAR_MUTED%%"
    marker = '<span style="position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 2px; background: %%MARKER%%"></span>' if active else ""
    b = f'<span style="margin-left: auto; min-width: 20px; height: 20px; border-radius: 10px; background: %%MARKER%%; color: #FFFFFF; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">{badge}</span>' if badge else ""
    return f'''<a href="#" style="position: relative; display: flex; align-items: center; gap: 12px; height: 38px; padding: 0 12px; border-radius: 8px; background: {bg}; color: {col}; text-decoration: none; font-size: 14px; font-weight: 500">{marker}{ic(icon, 18)}{label}{b}</a>
'''


def nav_group(label, dot):
    return f'<div style="display: flex; align-items: center; gap: 8px; padding: 18px 12px 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: %%SIDEBAR_MUTED%%"><span style="width: 7px; height: 7px; border-radius: 4px; background: {dot}"></span>{label}</div>\n'


def session_row(day, name, done):
    mark = (f'<span style="width: 22px; height: 22px; border-radius: 11px; background: %%TRAIN%%; color: %%ON_TRAIN%%; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="2.4")}</span>'
            if done else '<span style="width: 20px; height: 20px; border-radius: 11px; border: 1.5px dashed %%MUTED%%"></span>')
    status = "Done" if done else "Sunday"
    return f'''<div style="display: flex; align-items: center; gap: 12px; padding: 9px 0; border-top: 1px solid %%LINE%%">
{mark}<span style="width: 34px; font-size: 13px; color: %%MUTED%%">{day}</span><span style="font-size: 14px; font-weight: 500">{name}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{status}</span>
</div>
'''


def macro_bar(label, val, goal, color, pct):
    return f'''<div style="display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; font-size: 13px"><span style="color: %%INK2%%">{label}</span><span style="margin-left: auto; font-weight: 600">{val} <span style="color: %%MUTED%%; font-weight: 400">/ {goal} g</span></span></div>
<div style="height: 6px; border-radius: 3px; background: %%LINE%%"><div style="width: {pct}%; height: 6px; border-radius: 3px; background: {color}"></div></div>
</div>
'''


def activity(dot, text, sub, when):
    return f'''<div style="display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid %%LINE%%">
<span style="width: 8px; height: 8px; border-radius: 4px; background: {dot}; flex-shrink: 0"></span>
<span style="font-size: 14px; font-weight: 500">{text}</span><span style="font-size: 13px; color: %%MUTED%%">{sub}</span>
<span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{when}</span>
</div>
'''


def card(inner, extra=""):
    return f'<div style="background: %%SURFACE%%; border: 1px solid %%LINE%%; border-radius: 14px; padding: 22px; display: flex; flex-direction: column; gap: 14px{extra}">{inner}</div>'


def card_head(icon, soft, ink, title, sub):
    return f'''<div style="display: flex; align-items: center; gap: 12px">
<span style="width: 36px; height: 36px; border-radius: 10px; background: {soft}; color: {ink}; display: flex; align-items: center; justify-content: center">{ic(icon, 19)}</span>
<div style="display: flex; flex-direction: column; gap: 2px"><span style="{DISP}; font-size: 17px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></div>
</div>'''


def web(d, t):
    side = (f'<div style="padding: 6px 12px 22px">{logo(d, True, 20)}</div>\n'
            + nav_item("Dashboard", "grid") + nav_item("Clients", "users", True) + nav_item("Messages", "chat", badge="3")
            + nav_group("TRAINING", "%%TRAIN_BRIGHT%%") + nav_item("Training plans", "calendar") + nav_item("Session templates", "clipboard") + nav_item("Exercises", "dumbbell")
            + nav_group("NUTRITION", "%%NUTRI_BRIGHT%%") + nav_item("Nutrition plans", "calendar") + nav_item("Recipes", "book") + nav_item("Ingredients", "leaf"))
    training = card(card_head("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_INK%%", "Training", "Strength block · week 6 of 12") + f'''
<div style="display: flex; align-items: baseline; gap: 8px"><span style="{DISP}; font-size: 34px; font-weight: 600">3</span><span style="font-size: 14px; color: %%MUTED%%">of 4 sessions this week</span></div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px"><span style="height: 6px; border-radius: 3px; background: %%TRAIN%%"></span><span style="height: 6px; border-radius: 3px; background: %%TRAIN%%"></span><span style="height: 6px; border-radius: 3px; background: %%TRAIN%%"></span><span style="height: 6px; border-radius: 3px; background: %%LINE%%"></span></div>
<div>{session_row("Mon", "Upper body A", True)}{session_row("Wed", "Lower body A", True)}{session_row("Fri", "Upper body B", True)}{session_row("Sun", "Lower body B", False)}</div>
<a href="#" style="font-size: 14px; font-weight: 600; color: %%TRAIN_INK%%; text-decoration: none; display: flex; align-items: center; gap: 4px">Open training plan{ic("chevron", 16)}</a>''')
    nutrition = card(card_head("leaf", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Nutrition", "Average of the last 7 days") + f'''
<div style="display: flex; align-items: baseline; gap: 8px"><span style="{DISP}; font-size: 34px; font-weight: 600">1,980</span><span style="font-size: 14px; color: %%MUTED%%">of 2,100 kcal</span></div>
<div style="height: 6px; border-radius: 3px; background: %%LINE%%"><div style="width: 94%; height: 6px; border-radius: 3px; background: %%NUTRI%%"></div></div>
{macro_bar("Protein", "142", "150", "%%PROT%%", 95)}{macro_bar("Carbs", "205", "230", "%%CARB%%", 89)}{macro_bar("Fat", "68", "70", "%%FAT%%", 97)}
<div style="font-size: 13px; color: %%MUTED%%">24 of 28 meals logged</div>
<a href="#" style="font-size: 14px; font-weight: 600; color: %%NUTRI_INK%%; text-decoration: none; display: flex; align-items: center; gap: 4px">Open nutrition plan{ic("chevron", 16)}</a>''')
    stat = lambda k, v, s: f'<div style="display: flex; align-items: baseline; padding: 10px 0; border-top: 1px solid %%LINE%%"><span style="font-size: 13px; color: %%INK2%%">{k}</span><span style="margin-left: auto; font-size: 15px; font-weight: 600">{v}</span><span style="margin-left: 6px; font-size: 12px; color: %%MUTED%%">{s}</span></div>'
    checkin = card(card_head("clipboard", "%%GROUND%%", "%%INK%%", "Weekly check-in", "Submitted Sunday 19:40") + f'''
<div>{stat("Weight", "72.4 kg", "−0.6")}{stat("Sleep", "7.1 h", "avg")}{stat("Energy", "4 / 5", "")}{stat("Hunger", "2 / 5", "")}</div>
<button style="height: 40px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; font: 600 14px 'DM Sans', sans-serif">Review check-in</button>''')
    acts = card(f'<div style="{DISP}; font-size: 17px; font-weight: 600">Recent activity</div><div>'
                + activity("%%TRAIN%%", "Logged Upper body B", "5 exercises · 18 sets", "Fri 18:12")
                + activity("%%NUTRI%%", "Logged lunch", "Chicken rice bowl · 640 kcal", "Fri 12:30")
                + activity("%%MUTED%%", "Submitted weekly check-in", "Weight −0.6 kg", "Sun 19:40") + "</div>", "; gap: 4px; padding: 18px 22px 8px")
    body = f'''<div style="width: 1440px; height: 900px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">
<nav style="width: 248px; flex-shrink: 0; background: %%SIDEBAR%%; padding: 26px 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px">
{side}<div style="margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 14px 12px 0; border-top: 1px solid %%SIDEBAR_ACTIVE%%">
<span style="width: 34px; height: 34px; border-radius: 17px; background: %%SIDEBAR_ACTIVE%%; color: %%SIDEBAR_TEXT%%; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center">MK</span>
<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600; color: %%SIDEBAR_TEXT%%">Martin Král</span><span style="font-size: 12px; color: %%SIDEBAR_MUTED%%">Trainer · Nutritionist</span></div>
</div>
</nav>
<main style="flex-grow: 1; padding: 26px 40px; display: flex; flex-direction: column; gap: 22px; min-width: 0">
<div style="display: flex; align-items: center; gap: 12px">
<span style="font-size: 13px; color: %%MUTED%%">Clients  /  <span style="color: %%INK%%">Eva Svobodová</span></span>
<label style="margin-left: auto; display: flex; align-items: center; gap: 8px; width: 280px; height: 38px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; background: %%SURFACE%%; border: 1px solid %%LINE%%; color: %%MUTED%%">{ic("search", 16)}<input placeholder="Search clients, plans, recipes" aria-label="Search" style="border: none; outline: none; background: transparent; font: 14px 'DM Sans', sans-serif; color: %%INK%%; width: 100%"></label>
<button aria-label="Notifications" style="width: 38px; height: 38px; border-radius: 10px; background: %%SURFACE%%; border: 1px solid %%LINE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("bell", 18)}</button>
</div>
<div style="display: flex; align-items: center; gap: 18px">
<span style="width: 60px; height: 60px; border-radius: 30px; background: %%INK%%; color: %%SURFACE%%; {DISP}; font-size: 20px; font-weight: 500; display: flex; align-items: center; justify-content: center">ES</span>
<div style="display: flex; flex-direction: column; gap: 6px">
<h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">Eva Svobodová</h1>
<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: %%MUTED%%">
<span style="padding: 3px 10px; border-radius: 999px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; font-weight: 600">Training</span>
<span style="padding: 3px 10px; border-radius: 999px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-weight: 600">Nutrition</span>
<span>Client since March 2026 · Goal: get stronger, lose 4 kg</span>
</div>
</div>
<div style="margin-left: auto; display: flex; gap: 10px">
<button style="height: 42px; padding: 0 18px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; font: 600 14px 'DM Sans', sans-serif; display: flex; align-items: center; gap: 8px">{ic("chat", 17)}Message</button>
<button style="height: 42px; padding: 0 18px; border-radius: 10px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font: 600 14px 'DM Sans', sans-serif">Publish next week</button>
</div>
</div>
<div style="display: flex; gap: 28px; border-bottom: 1px solid %%LINE%%; font-size: 14px; font-weight: 500">
<a href="#" style="padding: 0 0 12px; color: %%INK%%; text-decoration: none; border-bottom: 2px solid %%INK%%; margin-bottom: -1px">Overview</a>
<a href="#" style="padding: 0 0 12px; color: %%MUTED%%; text-decoration: none">Training</a>
<a href="#" style="padding: 0 0 12px; color: %%MUTED%%; text-decoration: none">Nutrition</a>
<a href="#" style="padding: 0 0 12px; color: %%MUTED%%; text-decoration: none">Check-ins</a>
<a href="#" style="padding: 0 0 12px; color: %%MUTED%%; text-decoration: none">Photos</a>
<a href="#" style="padding: 0 0 12px; color: %%MUTED%%; text-decoration: none">Notes</a>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px">
{training}{nutrition}{checkin}
</div>
{acts}
</main>
</div>'''
    return page(f"Coach portal {d}", 1440, 900, body, t)


# ---------------------------------------------------------------- mobile
def tabbar(active):
    items = [("Today", "home", "%%INK%%"), ("Training", "dumbbell", "%%TRAIN%%"), ("Nutrition", "leaf", "%%NUTRI%%"),
             ("Messages", "chat", "%%INK%%"), ("Profile", "user", "%%INK%%")]
    out = ""
    for label, icon, col in items:
        on = label == active
        c = col if on else "%%MUTED%%"
        w = "700" if on else "500"
        out += f'<a href="#" style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 10px; color: {c}; text-decoration: none; font-size: 11px; font-weight: {w}">{ic(icon, 23, sw="2" if on else "1.7")}{label}</a>'
    return f'<nav style="margin-top: auto; height: 84px; flex-shrink: 0; display: flex; background: %%SURFACE%%; border-top: 1px solid %%LINE%%">{out}</nav>'


def phone(title, d, t, inner):
    body = f'''<div style="width: 390px; height: 844px; display: flex; flex-direction: column; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">
{inner}
</div>'''
    return page(title, 390, 844, body, t)


def mini_macro(label, val, color, pct):
    return f'''<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px">
<span style="font-size: 12px; color: %%MUTED%%">{label}</span>
<div style="height: 5px; border-radius: 3px; background: %%LINE%%"><div style="width: {pct}%; height: 5px; border-radius: 3px; background: {color}"></div></div>
<span style="font-size: 13px; font-weight: 600">{val}</span>
</div>'''


def today(d, t):
    inner = f'''<div style="padding: 28px 22px 0; display: flex; flex-direction: column; gap: 18px; flex-grow: 1">
<div style="display: flex; align-items: center">
<div style="display: flex; flex-direction: column; gap: 6px">
<span style="font-size: 13px; color: %%MUTED%%">Thursday, 1 October</span>
<span style="{DISP}; font-size: 28px; font-weight: 600; letter-spacing: -0.01em">Morning, Eva</span>
<span style="width: 36px; height: 4px; border-radius: 2px; background: %%MARKER%%"></span>
</div>
<button aria-label="Notifications" style="margin-left: auto; width: 44px; height: 44px; border-radius: 22px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("bell", 20)}</button>
</div>
<div style="border-radius: 22px; background: %%TRAIN%%; color: %%ON_TRAIN%%; padding: 20px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; opacity: 0.9">{ic("dumbbell", 16)}TODAY'S TRAINING</div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 26px; font-weight: 600">Lower body A</span><span style="font-size: 14px; opacity: 0.9">6 exercises · about 55 min · with Martin</span></div>
<div style="display: flex; gap: 6px"><span style="padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 600">Squat</span><span style="padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 600">RDL</span><span style="padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 12px; font-weight: 600">+4 more</span></div>
<a href="#" style="height: 48px; border-radius: 14px; background: %%CTA_BG%%; color: %%CTA_TEXT%%; text-decoration: none; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">Start workout</a>
</div>
<div style="border-radius: 22px; background: %%SURFACE%%; border: 1px solid %%LINE%%; padding: 20px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; color: %%NUTRI%%">{ic("leaf", 16)}NUTRITION</div>
<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 30px; font-weight: 600">1,240</span><span style="font-size: 14px; color: %%MUTED%%">of 2,100 kcal</span><span style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%NUTRI_INK%%">860 left</span></div>
<div style="height: 8px; border-radius: 4px; background: %%NUTRI_SOFT%%"><div style="width: 59%; height: 8px; border-radius: 4px; background: %%NUTRI%%"></div></div>
<div style="display: flex; gap: 14px">{mini_macro("Protein", "88 / 150 g", "%%PROT%%", 59)}{mini_macro("Carbs", "131 / 230 g", "%%CARB%%", 57)}{mini_macro("Fat", "41 / 70 g", "%%FAT%%", 59)}</div>
<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; text-decoration: none; font-size: 14px"><span style="font-weight: 700">Next: Lunch</span><span>Chicken rice bowl</span><span style="margin-left: auto; display: flex">{ic("chevron", 18)}</span></a>
</div>
<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 18px; background: %%SURFACE%%; border: 1px solid %%LINE%%; color: %%INK%%; text-decoration: none">
<span style="width: 40px; height: 40px; border-radius: 12px; background: %%GROUND%%; display: flex; align-items: center; justify-content: center">{ic("clipboard", 20)}</span>
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Weekly check-in due Sunday</span><span style="font-size: 13px; color: %%MUTED%%">Takes about 2 minutes</span></span>
<span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 18)}</span>
</a>
</div>
{tabbar("Today")}'''
    return phone(f"Today {d}", d, t, inner)


def set_row(n, prev, kg, reps, state):
    if state == "done":
        mark = f'<span style="width: 32px; height: 32px; border-radius: 10px; background: %%TRAIN%%; color: %%ON_TRAIN%%; display: flex; align-items: center; justify-content: center">{ic("check", 18, sw="2.4")}</span>'
        cell = lambda v: f'<span style="font-size: 16px; font-weight: 600; text-align: center">{v}</span>'
        rowbg = "transparent"
    else:
        mark = '<span style="width: 30px; height: 30px; border-radius: 10px; border: 1.5px solid %%TRAIN%%"></span>'
        cell = lambda v: f'<input value="{v}" aria-label="Set {n}" style="width: 100%; box-sizing: border-box; height: 40px; border-radius: 10px; border: 1.5px solid %%TRAIN%%; background: %%SURFACE%%; text-align: center; font: 600 16px \'DM Sans\', sans-serif; color: %%INK%%">'
        rowbg = "%%TRAIN_SOFT%%"
    return f'''<div style="display: grid; grid-template-columns: 34px minmax(0, 1fr) 64px 64px 36px; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; background: {rowbg}">
<span style="font-size: 14px; font-weight: 600; color: %%MUTED%%">{n}</span><span style="font-size: 13px; color: %%MUTED%%">{prev}</span>{cell(kg)}{cell(reps)}{mark}
</div>
'''


def next_row(name, scheme):
    return f'<div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid %%LINE%%"><span style="width: 8px; height: 8px; border-radius: 4px; border: 1.5px solid %%TRAIN%%"></span><span style="font-size: 15px; font-weight: 500">{name}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{scheme}</span></div>'


def training(d, t):
    seg = "".join(f'<span style="height: 4px; border-radius: 2px; background: %%ON_TRAIN%%; opacity: {1 if i < 1 else 0.45 if i == 1 else 0.2}"></span>' for i in range(6))
    inner = f'''<div style="background: %%TRAIN%%; color: %%ON_TRAIN%%; padding: 20px 22px 22px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center">
<a href="#" aria-label="Back" style="width: 44px; height: 44px; margin-left: -10px; border-radius: 22px; color: %%ON_TRAIN%%; display: flex; align-items: center; justify-content: center">{ic("back", 22)}</a>
<span style="margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 13px; font-weight: 600">{ic("clock", 15)}18:42</span>
</div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 28px; font-weight: 600">Lower body A</span><span style="font-size: 14px; opacity: 0.9">Exercise 2 of 6</span></div>
<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px">{seg}</div>
</div>
<div style="padding: 18px 18px 0; display: flex; flex-direction: column; gap: 16px; flex-grow: 1">
<div style="border-radius: 20px; background: %%SURFACE%%; border: 1px solid %%LINE%%; padding: 18px 12px 12px; display: flex; flex-direction: column; gap: 10px">
<div style="padding: 0 6px; display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 21px; font-weight: 600">Romanian deadlift</span><span style="font-size: 13px; color: %%MUTED%%">3 sets × 8–10 reps · rest 90 s</span></div>
<div style="display: grid; grid-template-columns: 34px minmax(0, 1fr) 64px 64px 36px; gap: 10px; padding: 4px 10px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: %%MUTED%%"><span>SET</span><span>LAST TIME</span><span style="text-align: center">KG</span><span style="text-align: center">REPS</span><span></span></div>
{set_row("1", "60 × 10", "62.5", "10", "done")}{set_row("2", "60 × 10", "62.5", "9", "done")}{set_row("3", "60 × 9", "62.5", "8", "current")}
</div>
<div style="display: flex; flex-direction: column"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.12em; color: %%MUTED%%; padding-bottom: 6px">UP NEXT</span>{next_row("Bulgarian split squat", "3 × 10")}{next_row("Lying leg curl", "3 × 12")}{next_row("Standing calf raise", "4 × 15")}</div>
</div>
<div style="padding: 14px 18px 30px; display: flex; gap: 10px; background: %%SURFACE%%; border-top: 1px solid %%LINE%%">
<button style="height: 54px; padding: 0 18px; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; font: 600 15px 'DM Sans', sans-serif">Skip</button>
<button style="flex-grow: 1; height: 54px; border-radius: 16px; border: none; background: %%TRAIN%%; color: %%ON_TRAIN%%; font: 700 16px 'DM Sans', sans-serif">Log set 3</button>
</div>'''
    return phone(f"Workout {d}", d, t, inner)


def meal(name, food, kcal, done):
    if done:
        act = f'<span style="width: 36px; height: 36px; border-radius: 18px; background: %%NUTRI%%; color: %%ON_NUTRI%%; display: flex; align-items: center; justify-content: center">{ic("check", 18, sw="2.4")}</span>'
    else:
        act = f'<button style="height: 36px; padding: 0 14px; border-radius: 18px; border: 1.5px solid %%NUTRI%%; background: %%SURFACE%%; color: %%NUTRI_INK%%; font: 700 13px \'DM Sans\', sans-serif; display: flex; align-items: center; gap: 4px">{ic("plus", 15, sw="2.2")}Log</button>'
    return f'''<div style="display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-top: 1px solid %%LINE%%">
<div style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.1em; color: %%MUTED%%">{name}</span><span style="font-size: 15px; font-weight: 600">{food}</span><span style="font-size: 13px; color: %%MUTED%%">{kcal} kcal</span></div>
<span style="margin-left: auto">{act}</span>
</div>
'''


def nutrition(d, t):
    days = ""
    for i, (dn, num) in enumerate([("M", "28"), ("T", "29"), ("W", "30"), ("T", "1"), ("F", "2"), ("S", "3"), ("S", "4")]):
        on = i == 3
        bg = "%%NUTRI%%" if on else "transparent"
        col = "%%ON_NUTRI%%" if on else "%%INK%%"
        sub = "%%ON_NUTRI%%" if on else "%%MUTED%%"
        days += f'<a href="#" style="flex-grow: 1; height: 58px; border-radius: 14px; background: {bg}; color: {col}; text-decoration: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px"><span style="font-size: 11px; font-weight: 600; color: {sub}">{dn}</span><span style="font-size: 16px; font-weight: 700">{num}</span></a>'
    ring = '''<svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="46" fill="none" stroke="%%NUTRI_SOFT%%" stroke-width="10"></circle><circle cx="56" cy="56" r="46" fill="none" stroke="%%NUTRI%%" stroke-width="10" stroke-linecap="round" stroke-dasharray="170 289" transform="rotate(-90 56 56)"></circle></svg>'''
    inner = f'''<div style="padding: 24px 20px 0; display: flex; flex-direction: column; gap: 16px; flex-grow: 1">
<div style="display: flex; align-items: center">
<span style="{DISP}; font-size: 28px; font-weight: 600">Nutrition</span>
<button aria-label="Shopping list" style="margin-left: auto; width: 44px; height: 44px; border-radius: 22px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("cart", 20)}</button>
</div>
<div style="display: flex; gap: 4px">{days}</div>
<div style="border-radius: 22px; background: %%SURFACE%%; border: 1px solid %%LINE%%; padding: 18px; display: flex; align-items: center; gap: 18px">
<div style="position: relative; width: 112px; height: 112px; flex-shrink: 0">{ring}<div style="position: absolute; top: 0; left: 0; width: 112px; height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center"><span style="{DISP}; font-size: 24px; font-weight: 600">1,240</span><span style="font-size: 12px; color: %%MUTED%%">of 2,100 kcal</span></div></div>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px">{macro_bar("Protein", "88", "150", "%%PROT%%", 59)}{macro_bar("Carbs", "131", "230", "%%CARB%%", 57)}{macro_bar("Fat", "41", "70", "%%FAT%%", 59)}</div>
</div>
<div style="border-radius: 22px; background: %%SURFACE%%; border: 1px solid %%LINE%%; display: flex; flex-direction: column; overflow: hidden">
<div style="padding: 14px 16px 12px; display: flex; align-items: center"><span style="{DISP}; font-size: 17px; font-weight: 600">Meals</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">2 of 4 logged</span></div>
{meal("BREAKFAST", "Oat bowl with berries", "420", True)}{meal("SNACK", "Greek yogurt, honey", "180", True)}{meal("LUNCH", "Chicken rice bowl", "640", False)}{meal("DINNER", "Salmon, potatoes, greens", "610", False)}
</div>
</div>
{tabbar("Nutrition")}'''
    return phone(f"Nutrition {d}", d, t, inner)


# ---------------------------------------------------------------- canvas
boards, order, notes = {}, [], {}
layout = [("Palette", 560, 900, palette), ("Web", 1440, 900, web), ("Today", 390, 844, today),
          ("Workout", 390, 844, training), ("Nutrition", 390, 844, nutrition)]
row_y = {"A": 0, "B": 1400, "C": 2800}
titles = {"A": "A · Spectrum — gradient logo, orange training, green nutrition",
          "B": "B · Ink & Red — black and red logo, warm grey, amber training, olive nutrition",
          "C": "C · B made energetic — white web with solid colour blocks, dark mobile with bright sections"}
names = []
for d, t in DIRS.items():
    x = 0
    for label, w, h, fn in layout:
        fname = "Main.dc.html" if (d == "A" and label == "Palette") else f"{label}{d}.dc.html"
        tt = CM if (d == "C" and label in ("Today", "Workout", "Nutrition")) else t
        with open(os.path.join(ROOT, fname), "w") as f:
            f.write(fn(d, tt))
        boards[fname] = {"x": x, "y": row_y[d], "w": w, "h": h, "title": f"{d} · {label}", "page": "concepts"}
        order.append(fname)
        x += w + 80
    notes[f"title{d}"] = {"x": 0, "y": row_y[d] - 300, "text": titles[d], "kind": "title1", "maxW": x - 80, "page": "concepts"}

_prev = json.load(open(os.path.join(ROOT, "canvas.json")))
canvas = {"v": 3, "createdOnFiles": _prev["createdOnFiles"],
          "title": "Form Up colour directions", "launch": {"view": "canvas"}, "pages": _prev.get("pages", []),
          "boards": boards, "order": order, "notes": notes, "designSystems": []}
with open(os.path.join(ROOT, "canvas.json"), "w") as f:
    json.dump(canvas, f, indent=1)
print("\n".join(order))
