"""Refined (elegant) pass over every Liquid Glass mobile screen. Overwrites the Glass*.dc.html files."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen3.py")).read().split("# ---------------------------------------------------------------- Today")[0]
exec(_src)
PATHS.update({
    "bookopen": '<path d="M12 7C10 5.5 7 5 4 5.5V18c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5.5C17 5 14 5.5 12 7z"></path><path d="M12 7v12.5"></path>',
    "camera": '<path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z"></path><circle cx="12" cy="13.2" r="3.4"></circle>',
    "minus": '<path d="M5 12h14"></path>',
    "mail": '<rect x="3.5" y="5.5" width="17" height="13" rx="2"></rect><path d="M4 7l8 6 8-6"></path>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>',
    "apple": '<path d="M15.5 4c-.3 1.6-1.6 2.9-3.1 2.8.1-1.5 1.5-2.8 3.1-2.8z"></path><path d="M17.5 12.8c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-1 2.3-2 .7-1 1-2 1-2.1 0 0-1.6-.6-1.6-3.2z"></path>',
    "g": '<path d="M20 12.2c0-.6 0-1.1-.1-1.7H12v3.3h4.5a3.9 3.9 0 0 1-1.7 2.5v2.1h2.7c1.6-1.5 2.5-3.6 2.5-6.2z"></path><path d="M12 20.5c2.3 0 4.2-.8 5.5-2.1l-2.7-2.1c-.7.5-1.7.8-2.8.8-2.2 0-4-1.5-4.7-3.4H4.6v2.2A8.5 8.5 0 0 0 12 20.5z"></path><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.1H4.6a8.5 8.5 0 0 0 0 7.8z"></path><path d="M12 6.9c1.2 0 2.4.4 3.3 1.3l2.4-2.4A8.5 8.5 0 0 0 4.6 8.1l2.7 2.2C8 8.4 9.8 6.9 12 6.9z"></path>',
    "x": '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    "trend": '<path d="M4 8l6 6 4-4 6 6"></path><path d="M20 12v4h-4"></path>',
})
MODES["Light"].update(HAIR="rgba(20,20,20,0.08)", SEG="rgba(20,20,20,0.05)", SEG_ON="#FFFFFF", SEG_SHADOW="0 1px 3px rgba(0,0,0,0.12)", RED_SOFT="#FBE7E5", CARD_BORDER="1px solid rgba(20,20,20,0.06)", CARD_SHADOW="0 1px 2px rgba(0,0,0,0.04)")
MODES["Dark"].update(HAIR="rgba(255,255,255,0.08)", SEG="rgba(255,255,255,0.06)", SEG_ON="#3A3A3E", SEG_SHADOW="0 1px 3px rgba(0,0,0,0.4)", RED_SOFT="#3A1A17", CARD_BORDER="1px solid rgba(255,255,255,0.05)")
CARD = "background: %%CARD%%; border: %%CARD_BORDER%%; box-shadow: %%CARD_SHADOW%%"
GL = "background: %%GLASS%%; -webkit-backdrop-filter: blur(22px) saturate(180%); backdrop-filter: blur(22px) saturate(180%); border: 1px solid %%GLASS_BORDER%%; box-shadow: %%GLASS_SHADOW%%"
A = "text-decoration: none"

H1 = f"margin: 0; {DISP}; font-size: 30px; line-height: 1.12; font-weight: 600; letter-spacing: -0.015em"
EYEBROW = "font-size: 12px; font-weight: 600; letter-spacing: 0.08em"
BTN = "height: 52px; border-radius: 26px; border: none; font: 600 16px 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px"


def gbtn(icon, label, size=40, dot=False, style=None, color="%%INK%%"):
    d = '<span style="position: absolute; top: 8px; right: 9px; width: 7px; height: 7px; border-radius: 4px; background: %%RED%%"></span>' if dot else ""
    return f'<button aria-label="{label}" style="position: relative; width: {size}px; height: {size}px; border-radius: {size // 2}px; {style or GL}; color: {color}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 18, sw="1.7")}{d}</button>'


def soft_icon(icon, soft, ink, size=34):
    return f'<span style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: {size // 2}px; background: {soft}; color: {ink}; display: flex; align-items: center; justify-content: center">{ic(icon, size * 0.5, sw="1.8")}</span>'


def eyebrow(text, color="%%MUTED%%", icon=None):
    i = ic(icon, 14, sw="1.9") if icon else ""
    return f'<span style="display: flex; align-items: center; gap: 6px; {EYEBROW}; color: {color}">{i}{text}</span>'


def thin_bar(pct, color, h=4):
    return f'<div style="height: {h}px; border-radius: {h}px; background: %%HAIR%%"><div style="width: {pct}%; height: {h}px; border-radius: {h}px; background: {color}"></div></div>'


def macro(lbl, val, color, pct):
    return f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px"><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: %%MUTED%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {color}"></span>{lbl}</span><span style="font-size: 14px; font-weight: 600">{val}</span>{thin_bar(pct, color, 3)}</div>'


def tabbar(active, accessory):
    items = [("Today", "home", "%%RED%%"), ("Training", "dumbbell", "%%TRAIN_TEXT%%"), ("Nutrition", "leaf", "%%NUTRI_TEXT%%"), ("Messages", "chat", "%%RED%%")]
    out = ""
    for label, icon, col in items:
        on = label == active
        bg = "background: %%SEG%%;" if on else ""
        c = col if on else "%%MUTED%%"
        out += f'<a href="#" style="flex-grow: 1; height: 48px; border-radius: 24px; {bg} color: {c}; {A}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; font-weight: {600 if on else 500}">{ic(icon, 20, sw="1.8" if on else "1.6")}{label}</a>'
    # accessory is ignored: the round button beside the tab bar was dropped (no clear job in this app)
    return f'''<nav aria-label="Tabs" style="position: absolute; left: 20px; right: 20px; bottom: 28px; height: 58px; padding: 0 5px; box-sizing: border-box; border-radius: 29px; {GL}; display: flex; align-items: center">{out}</nav>'''


def cta(label, icon=None, bg="%%INK%%", fg="%%BG%%", shadow="0 8px 24px rgba(0,0,0,0.18)"):
    i = ic(icon, 17, sw="2") if icon else ""
    return f'<button style="position: absolute; left: 20px; right: 20px; bottom: 34px; {BTN}; background: {bg}; color: {fg}; box-shadow: {shadow}">{label}{i}</button>'


def fade():
    return '<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 130px; background: linear-gradient(180deg, transparent, %%BG%% 55%)"></div>'


def top_bar(left="", middle="", right=""):
    return f'<div style="position: absolute; top: 30px; left: 16px; right: 16px; height: 40px; display: flex; align-items: center; gap: 10px"><div style="width: 64px; display: flex">{left}</div><div style="flex-grow: 1; display: flex; justify-content: center">{middle}</div><div style="width: 64px; display: flex; justify-content: flex-end">{right}</div></div>'


def progress(step, total):
    return f'<div style="width: 140px; display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="font-size: 12px; font-weight: 500; color: %%MUTED%%">{step} of {total}</span>{thin_bar(round(step / total * 100), "%%INK%%", 3).replace("<div style=\"height", "<div style=\"width: 100%; height", 1)}</div>'


def seg_scale(name, value, n=5, color="%%INK%%"):
    out = ""
    for i in range(1, n + 1):
        on = i == value
        st = f"background: %%SEG_ON%%; box-shadow: %%SEG_SHADOW%%; color: {color}; font-weight: 700" if on else "background: transparent; color: %%MUTED%%; font-weight: 500"
        out += f'<button aria-label="{name} {i}" aria-pressed="{"true" if on else "false"}" style="flex-grow: 1; height: 32px; border-radius: 16px; border: none; {st}; font-family: \'DM Sans\', sans-serif; font-size: 14px">{i}</button>'
    return f'<div style="display: flex; padding: 3px; border-radius: 19px; background: %%SEG%%">{out}</div>'


def round_btn(icon, label, size=36):
    return f'<button aria-label="{label}" style="width: {size}px; height: {size}px; border-radius: {size // 2}px; border: 1px solid %%HAIR%%; background: transparent; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 16, sw="1.8")}</button>'


def field(lbl, value, icon=None, tail=""):
    i = f'<span style="display: flex; color: %%MUTED%%">{ic(icon, 17, sw="1.7")}</span>' if icon else ""
    return f'''<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%MUTED%%">{lbl}
<span style="height: 48px; padding: 0 14px; border-radius: 14px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; display: flex; align-items: center; gap: 10px; font-size: 16px; color: %%INK%%">{i}{value}{tail}</span></label>'''


def screen(title, body, t, mode):
    html = f'<div style="position: relative; width: 390px; height: 844px; background: %%BG%%; {FONT}; color: %%INK%%; overflow: hidden">\n{body}\n</div>'
    return page(f"{title} {mode}", 390, 844, html, t)


def head(title, right, sub="Thursday, 1 October"):
    return f'''<div style="display: flex; align-items: flex-end; padding: 0 20px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: %%MUTED%%">{sub}</span><h1 style="{H1}">{title}</h1></div>
<div style="margin-left: auto; display: flex; gap: 8px; padding-bottom: 2px">{right}</div>
</div>'''


# ---------------------------------------------------------------- Today
TODAY_MEALS = [("Breakfast", "07:30", "Oat bowl with berries", "420", True), ("Snack", "10:00", "Greek yogurt, honey", "180", True),
               ("Lunch", "12:30", "Chicken rice bowl", "640", False), ("Dinner", "18:30", "Salmon, potatoes, greens", "610", False)]


# Colours used on top of the solid nutrition (lime) fill — dark ink in both modes.
ON_INK, ON_MUTED, ON_HAIR = "#141414", "rgba(20,20,20,0.62)", "rgba(20,20,20,0.14)"


def on_bar(pct, h=4):
    return f'<div style="height: {h}px; border-radius: {h}px; background: {ON_HAIR}"><div style="width: {pct}%; height: {h}px; border-radius: {h}px; background: {ON_INK}"></div></div>'


def on_macro(lbl, val, color, pct):
    return f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px"><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: {ON_MUTED}"><span style="width: 6px; height: 6px; border-radius: 3px; background: {color}"></span>{lbl}</span><span style="font-size: 14px; font-weight: 600">{val}</span>{on_bar(pct, 3)}</div>'


def today_meals():
    out = ""
    for i, (name, time, food, kcal, eaten) in enumerate(TODAY_MEALS):
        nxt = name == "Lunch"
        if eaten:
            box = f'<button role="checkbox" aria-checked="true" aria-label="{name} eaten" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: none; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("check", 14, sw="2.6")}</button>'
        else:
            box = f'<button role="checkbox" aria-checked="false" aria-label="Mark {name} as eaten" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: 1.5px solid {"%%NUTRI%%" if nxt else "%%MUTED%%"}; background: transparent; padding: 0; opacity: {1 if nxt else 0.5}"></button>'
        tag = '<span style="padding: 2px 7px; border-radius: 999px; background: %%NUTRI%%; color: %%ON%%; font-size: 11px; font-weight: 600">Next</span>' if nxt else ""
        out += f'''<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}">{box}
<a href="#" style="flex-grow: 1; display: flex; align-items: center; gap: 8px; color: %%INK%%; opacity: {0.55 if eaten else 1}; {A}"><span style="display: flex; flex-direction: column; gap: 1px"><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: %%MUTED%%">{name} · {time}{tag}</span><span style="font-size: 15px; font-weight: {500 if eaten else 600}">{food}</span></span>
<span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{kcal}</span><span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a></div>'''
    return out


def today(mode, t):
    profile = f'<button aria-label="Profile" style="width: 40px; height: 40px; border-radius: 20px; {GL}; color: %%INK%%; font: 600 13px \'DM Sans\', sans-serif; padding: 0">ES</button>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 34px; display: flex; flex-direction: column; gap: 12px">
{head("Today", gbtn("bell", "Notifications", dot=True) + profile)}
<div style="margin: 4px 16px 0; border-radius: 24px; background: %%TRAIN_SOFT%%; padding: 18px 18px 16px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center">{eyebrow("TODAY'S TRAINING", "%%TRAIN_TEXT%%", "dumbbell")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Week 6 · 3 of 4</span></div>
<div style="display: flex; flex-direction: column; gap: 3px"><span style="{DISP}; font-size: 26px; font-weight: 600; letter-spacing: -0.01em">Lower body A</span><span style="font-size: 14px; color: %%INK2%%">6 exercises · 55 min · with Martin</span></div>
<div style="display: flex; align-items: center; padding-top: 2px"><span style="font-size: 13px; color: %%MUTED%%">Squat, RDL and 4 more</span>
<a href="#" style="margin-left: auto; height: 38px; padding: 0 16px; border-radius: 19px; background: %%TRAIN%%; color: %%ON%%; {A}; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("play", 13, sw="2.2")}Start</a></div>
</div>
<div style="margin: 0 16px; border-radius: 24px; background: %%NUTRI_SOFT%%; padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center">{eyebrow("NUTRITION", "%%NUTRI_TEXT%%", "leaf")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">860 kcal left</span></div>
<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 28px; font-weight: 600">1,240</span><span style="font-size: 14px; color: %%MUTED%%">/ 2,100 kcal</span></div>
{thin_bar(59, "%%NUTRI%%", 5)}
<div style="display: flex; gap: 16px">{macro("Protein", "88 g", "%%PROT%%", 59)}{macro("Carbs", "131 g", "%%CARB%%", 57)}{macro("Fat", "41 g", "%%FAT%%", 59)}{macro("Fiber", "18 g", "%%FIB%%", 60)}</div>
<div style="border-top: 1px solid %%HAIR%%">{today_meals()}</div>
</div>
<a href="#" style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; display: flex; align-items: center; gap: 12px; color: %%INK%%; {A}">
{soft_icon("clipboard", "%%RED_SOFT%%", "%%RED%%")}
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Weekly check-in</span><span style="font-size: 13px; color: %%MUTED%%">Due Sunday · about 2 minutes</span></span>
<span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 16)}</span>
</a>
</div>
{tabbar("Today", gbtn("search", "Search", size=58))}'''
    return screen("Today glass", body, t, mode)


# ---------------------------------------------------------------- Workout
def workout(mode, t):
    def setrow(n, prev, kg, reps, done):
        if done:
            mark = f'<span style="width: 26px; height: 26px; border-radius: 13px; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="2.4")}</span>'
            cell = lambda v: f'<span style="font-size: 16px; font-weight: 600; text-align: center">{v}</span>'
            bg = ""
        else:
            mark = '<span style="width: 24px; height: 24px; border-radius: 13px; border: 1.5px solid %%TRAIN%%"></span>'
            cell = lambda v: f'<input value="{v}" aria-label="Set {n}" style="width: 100%; box-sizing: border-box; height: 36px; border-radius: 10px; border: 1px solid %%TRAIN%%; background: %%CARD%%; text-align: center; font: 600 16px \'DM Sans\', sans-serif; color: %%INK%%">'
            bg = "background: %%TRAIN_SOFT%%;"
        return f'<div style="display: grid; grid-template-columns: 24px minmax(0, 1fr) 62px 62px 28px; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 14px; {bg}"><span style="font-size: 14px; font-weight: 500; color: %%MUTED%%">{n}</span><span style="font-size: 13px; color: %%MUTED%%">{prev}</span>{cell(kg)}{cell(reps)}{mark}</div>'
    seg = "".join(f'<span style="height: 3px; border-radius: 2px; background: #141414; opacity: {0.9 if i < 1 else 0.4 if i == 1 else 0.15}"></span>' for i in range(6))
    nxt = lambda n, s: f'<div style="display: flex; align-items: center; padding: 12px 0; border-top: 1px solid %%HAIR%%"><span style="font-size: 15px">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{s}</span></div>'
    glass_on = "background: rgba(255,255,255,0.28); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.45); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4)"
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 268px; background: %%TRAIN%%; color: %%ON%%; padding: 90px 22px 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px">
{eyebrow("LOWER BODY A · 2 OF 6", "%%ON%%")}
<span style="{DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.015em">Romanian deadlift</span>
<span style="font-size: 14px">3 sets × 8–10 reps · rest 90 s</span>
<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; padding-top: 10px">{seg}</div>
</div>
{top_bar(gbtn("back", "Back", style=glass_on, color="#141414"), f'<span style="height: 34px; padding: 0 14px; border-radius: 17px; {glass_on}; color: #141414; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("clock", 15, sw="1.9")}18:42</span>', gbtn("pause", "Pause workout", style=glass_on, color="#141414"))}
<div style="position: absolute; top: 248px; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; background: %%BG%%; padding: 18px 16px 0; display: flex; flex-direction: column; gap: 16px">
<div style="border-radius: 22px; {CARD}; padding: 12px 4px 6px; display: flex; flex-direction: column; gap: 2px">
<div style="display: grid; grid-template-columns: 24px minmax(0, 1fr) 62px 62px 28px; gap: 10px; padding: 0 12px 4px; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; color: %%MUTED%%"><span>SET</span><span>LAST TIME</span><span style="text-align: center">KG</span><span style="text-align: center">REPS</span><span></span></div>
{setrow("1", "60 × 10", "62.5", "10", True)}{setrow("2", "60 × 10", "62.5", "9", True)}{setrow("3", "60 × 9", "62.5", "8", False)}
</div>
<div style="padding: 0 4px">{eyebrow("UP NEXT")}<div style="height: 6px"></div>{nxt("Bulgarian split squat", "3 × 10")}{nxt("Lying leg curl", "3 × 12")}{nxt("Standing calf raise", "4 × 15")}</div>
</div>
{fade()}
<div style="position: absolute; left: 20px; right: 20px; bottom: 34px; display: flex; gap: 10px">
<button style="{BTN}; padding: 0 18px; {GL}; color: %%INK%%; font-weight: 500">{ic("clock", 16, sw="1.8")}1:30</button>
<button style="{BTN}; flex-grow: 1; background: %%TRAIN%%; color: %%ON%%; box-shadow: 0 8px 22px rgba(242,140,56,0.3)">Log set 3</button>
</div>'''
    return screen("Workout glass", body, t, mode)


# ---------------------------------------------------------------- Nutrition
def nutrition(mode, t):
    days = ""
    for i, (dn, num) in enumerate([("M", "28"), ("T", "29"), ("W", "30"), ("T", "1"), ("F", "2"), ("S", "3"), ("S", "4")]):
        on = i == 3
        n = f'<span style="width: 30px; height: 30px; border-radius: 15px; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600">{num}</span>' if on else f'<span style="height: 30px; display: flex; align-items: center; font-size: 14px; font-weight: 500">{num}</span>'
        days += f'<a href="#" style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; color: %%INK%%; {A}"><span style="font-size: 11px; color: %%MUTED%%">{dn}</span>{n}</a>'
    ring = '<svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="45" fill="none" stroke="%%HAIR%%" stroke-width="7"></circle><circle cx="52" cy="52" r="45" fill="none" stroke="%%NUTRI%%" stroke-width="7" stroke-linecap="round" stroke-dasharray="167 283" transform="rotate(-90 52 52)"></circle></svg>'

    def meal(name, food, kcal, done):
        if done:
            act = f'<span style="width: 26px; height: 26px; border-radius: 13px; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="2.4")}</span>'
        else:
            act = f'<button style="height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid %%HAIR%%; background: transparent; color: %%NUTRI_TEXT%%; font: 600 13px \'DM Sans\', sans-serif; display: flex; align-items: center; gap: 4px">{ic("plus", 13, sw="2")}Log</button>'
        return f'<div style="display: flex; align-items: center; gap: 14px; padding: 13px 0; border-top: 1px solid %%HAIR%%"><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">{name} · {kcal} kcal</span><span style="font-size: 15px; font-weight: 500">{food}</span></div><span style="margin-left: auto">{act}</span></div>'
    mb = lambda l, v, g, c, p: f'<div style="display: flex; flex-direction: column; gap: 5px"><div style="display: flex; font-size: 13px"><span style="display: flex; align-items: center; gap: 5px; color: %%MUTED%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {c}"></span>{l}</span><span style="margin-left: auto; font-weight: 600">{v}<span style="color: %%MUTED%%; font-weight: 400"> / {g} g</span></span></div>{thin_bar(p, c, 3)}</div>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 34px; display: flex; flex-direction: column; gap: 16px">
{head("Nutrition", gbtn("calendar", "Full plan") + gbtn("bookopen", "Recipes") + gbtn("cart", "Shopping list"))}
<div style="margin: 0 16px; padding: 10px 8px; border-radius: 22px; {GL}; display: flex">{days}</div>
<div style="margin: 0 16px; border-radius: 24px; {CARD}; overflow: hidden">
<div style="padding: 18px; display: flex; align-items: center; gap: 18px">
<div style="position: relative; width: 104px; height: 104px; flex-shrink: 0">{ring}<div style="position: absolute; top: 0; left: 0; width: 104px; height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: center"><span style="{DISP}; font-size: 22px; font-weight: 600">1,240</span><span style="font-size: 11px; color: %%MUTED%%">of 2,100 kcal</span></div></div>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px">{mb("Protein", "88", "150", "%%PROT%%", 59)}{mb("Carbs", "131", "230", "%%CARB%%", 57)}{mb("Fat", "41", "70", "%%FAT%%", 59)}{mb("Fiber", "18", "30", "%%FIB%%", 60)}</div>
</div>
<div style="padding: 4px 18px 2px; margin: 0 0 0; border-top: 1px solid %%HAIR%%">
<div style="display: flex; align-items: center; padding-bottom: 10px"><span style="{DISP}; font-size: 17px; font-weight: 600">Meals</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">2 of 4 logged</span></div>
{meal("Breakfast", "Oat bowl with berries", "420", True)}{meal("Snack", "Greek yogurt, honey", "180", True)}{meal("Lunch", "Chicken rice bowl", "640", False)}{meal("Dinner", "Salmon, potatoes, greens", "610", False)}
<a href="#" style="display: flex; align-items: center; gap: 8px; padding: 13px 0; border-top: 1px solid %%HAIR%%; color: %%MUTED%%; {A}; font-size: 14px">{ic("plus", 15, sw="1.8")}Add food you ate outside the plan</a>
</div>
</div>
</div>
{tabbar("Nutrition", f'<button aria-label="Log food" style="width: 58px; height: 58px; border-radius: 29px; border: 1px solid rgba(255,255,255,0.4); background: rgba(140,193,82,0.9); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 20px rgba(140,193,82,0.28); color: #141414; display: flex; align-items: center; justify-content: center; padding: 0">{ic("plus", 22, sw="2")}</button>')}'''
    return screen("Nutrition glass", body, t, mode)


# ---------------------------------------------------------------- Chat
def chat(mode, t):
    inc = lambda x: f'<div style="align-self: flex-start; max-width: 270px; padding: 10px 14px; border-radius: 20px 20px 20px 6px; {CARD}; font-size: 15px; line-height: 1.4">{x}</div>'
    own = lambda x: f'<div style="align-self: flex-end; max-width: 270px; padding: 10px 14px; border-radius: 20px 20px 6px 20px; background: %%RED%%; color: #FFFFFF; font-size: 15px; line-height: 1.4">{x}</div>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 100px 16px 0; display: flex; flex-direction: column; gap: 8px">
<span style="align-self: center; font-size: 12px; color: %%MUTED%%">Tuesday 18:05</span>
{inc("Leg day felt heavy — only 8 reps on the last RDL set.")}
{own("That's fine. Keep 62.5 kg and aim for 9 next time.")}
{own("How did you sleep this week?")}
{inc("About 6 hours. I'll work on it.")}
<span style="align-self: center; font-size: 12px; color: %%MUTED%%; padding-top: 6px">Today 10:30</span>
<a href="#" style="align-self: flex-start; width: 250px; border-radius: 20px; {CARD}; padding: 14px; display: flex; align-items: center; gap: 12px; color: %%INK%%; {A}">
{soft_icon("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", 38)}
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%TRAIN_TEXT%%; font-weight: 600">New week published</span><span style="font-size: 15px; font-weight: 600">Week 7 · Strength</span><span style="font-size: 12px; color: %%MUTED%%">4 sessions · from Monday</span></span>
</a>
{inc("Thursday is Lower body A again.")}
{own("Thanks! See you Thursday")}
<span style="align-self: flex-end; font-size: 11px; color: %%MUTED%%">Read 10:43</span>
</div>
{top_bar(gbtn("back", "Back"), f'<div style="height: 44px; padding: 0 16px 0 6px; border-radius: 22px; {GL}; display: flex; align-items: center; gap: 9px"><span style="width: 32px; height: 32px; border-radius: 16px; background: #141414; color: #F6F4F0; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center">MK</span><span style="display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 600">Martin Král</span><span style="font-size: 11px; color: %%MUTED%%">Trainer · Nutritionist</span></span></div>', gbtn("info", "Coach details"))}
<div style="position: absolute; left: 16px; right: 16px; bottom: 30px; display: flex; gap: 8px; align-items: center">
{gbtn("plus", "Attach", size=46)}
<label style="flex-grow: 1; height: 46px; padding: 0 4px 0 16px; box-sizing: border-box; border-radius: 23px; {GL}; display: flex; align-items: center; gap: 8px">
<input placeholder="Message" aria-label="Message" style="flex-grow: 1; border: none; outline: none; background: transparent; font: 15px 'DM Sans', sans-serif; color: %%INK%%">
<button aria-label="Send" style="width: 36px; height: 36px; border-radius: 18px; border: none; background: %%RED%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center; padding: 0">{ic("arrowup", 16, sw="2.2")}</button>
</label>
</div>'''
    return screen("Chat glass", body, t, mode)


# ---------------------------------------------------------------- Login / Register
def login(mode, t):
    body = f'''<div style="position: absolute; top: 110px; left: 0; right: 0; padding: 0 24px; display: flex; flex-direction: column; gap: 14px">
<div style="padding-bottom: 22px">{logo("B", mode == "Dark", 22)}</div>
<h1 style="{H1}; font-size: 32px; padding-bottom: 12px">Train and eat<br>with your coach.</h1>
{field("Email", "eva.svobodova@email.cz", "mail")}
{field("Password", "••••••••••", "lock", '<span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">Show</span>')}
<a href="#" style="align-self: flex-end; font-size: 13px; font-weight: 500; color: %%INK2%%; {A}">Forgot password?</a>
<button style="{BTN}; background: %%INK%%; color: %%BG%%; margin-top: 6px">Sign in</button>
<div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: %%MUTED%%"><span style="flex-grow: 1; height: 1px; background: %%HAIR%%"></span>or<span style="flex-grow: 1; height: 1px; background: %%HAIR%%"></span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<button style="{BTN}; height: 46px; background: transparent; border: 1px solid %%HAIR%%; color: %%INK%%; font-weight: 500; font-size: 15px">{ic("apple", 17, sw="1.6")}Apple</button>
<button style="{BTN}; height: 46px; background: transparent; border: 1px solid %%HAIR%%; color: %%INK%%; font-weight: 500; font-size: 15px">{ic("g", 17, sw="1.6")}Google</button>
</div>
</div>
<span style="position: absolute; left: 0; right: 0; bottom: 44px; text-align: center; font-size: 14px; color: %%MUTED%%">New here? <a href="#" style="font-weight: 600; color: %%RED%%; {A}">Create account</a></span>'''
    return screen("Login glass", body, t, mode)


def register(mode, t):
    rule = lambda txt, ok: f'<span style="display: flex; align-items: center; gap: 7px; font-size: 12px; color: {"%%INK2%%" if ok else "%%MUTED%%"}"><span style="width: 14px; height: 14px; border-radius: 7px; {"background: %%NUTRI%%; color: %%ON%%" if ok else "border: 1px solid %%HAIR%%"}; display: flex; align-items: center; justify-content: center">{ic("check", 9, sw="3") if ok else ""}</span>{txt}</span>'
    body = f'''{top_bar(gbtn("back", "Back"))}
<div style="position: absolute; top: 96px; left: 0; right: 0; padding: 0 24px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 6px; padding-bottom: 6px"><h1 style="{H1}">Create account</h1><span style="font-size: 15px; color: %%MUTED%%">Takes a minute. Your coach connects with you after.</span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{field("First name", "Eva")}{field("Last name", "Svobodová")}</div>
{field("Email", "eva.svobodova@email.cz", "mail")}
{field("Password", "••••••••", "lock", '<span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">Show</span>')}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px">{rule("At least 8 characters", True)}{rule("Uppercase letter", False)}{rule("Lowercase letter", True)}{rule("Digit", False)}</div>
<label style="display: flex; gap: 10px; align-items: flex-start; padding-top: 4px; font-size: 13px; line-height: 1.45; color: %%MUTED%%"><span style="width: 20px; height: 20px; flex-shrink: 0; border-radius: 6px; background: %%INK%%; color: %%BG%%; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.6")}</span>I agree to the processing of my personal data and to the terms of use.</label>
</div>
<span style="position: absolute; left: 0; right: 0; bottom: 104px; text-align: center; font-size: 14px; color: %%MUTED%%">Already have an account? <a href="#" style="font-weight: 600; color: %%RED%%; {A}">Sign in</a></span>
{cta("Create account")}'''
    return screen("Register glass", body, t, mode)


# ---------------------------------------------------------------- Onboarding
SKIP = f'<a href="#" style="font-size: 14px; font-weight: 500; color: %%MUTED%%; {A}">Skip</a>'


def onboarding_goal(mode, t):
    opts = [("Lose fat", "Lean out while keeping strength", "leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", True),
            ("Build muscle", "Add size with a structured plan", "dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", False),
            ("Get stronger", "Lift heavier, week by week", "trend", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", False),
            ("Eat better", "Simple meals that fit your day", "leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", False),
            ("Move more", "Build a habit you can keep", "clock", "%%RED_SOFT%%", "%%RED%%", False)]
    rows = ""
    for title, sub, icon, soft, ink, sel in opts:
        border = "1.5px solid %%INK%%" if sel else "1.5px solid transparent"
        mark = (f'<span style="width: 22px; height: 22px; border-radius: 11px; background: %%INK%%; color: %%BG%%; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.8")}</span>'
                if sel else '<span style="width: 20px; height: 20px; border-radius: 11px; border: 1.5px solid %%HAIR%%"></span>')
        rows += f'''<button aria-pressed="{"true" if sel else "false"}" style="display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-radius: 18px; background: %%CARD%%; border: {border}; box-shadow: %%CARD_SHADOW%%; color: %%INK%%; text-align: left; font-family: 'DM Sans', sans-serif">
{soft_icon(icon, soft, ink, 36)}
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 600">{title}</span><span style="font-size: 13px; color: %%MUTED%%">{sub}</span></span>
<span style="margin-left: auto">{mark}</span></button>'''
    body = f'''{top_bar(gbtn("back", "Back"), progress(2, 6), SKIP)}
<div style="position: absolute; top: 104px; left: 0; right: 0; padding: 0 20px; display: flex; flex-direction: column; gap: 10px">
<h1 style="{H1}">What's your main goal?</h1>
<span style="font-size: 15px; color: %%MUTED%%; padding-bottom: 10px">Your coach uses this to build your first plan.</span>
{rows}
</div>
{cta("Continue")}'''
    return screen("Onboarding goal glass", body, t, mode)


def onboarding_body(mode, t):
    def stepper(lbl, value, unit, sub):
        return f'''<div style="display: flex; align-items: center; padding: 16px 0; border-top: 1px solid %%HAIR%%">
<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; color: %%MUTED%%">{lbl}</span><span style="display: flex; align-items: baseline; gap: 4px"><span style="{DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">{value}</span><span style="font-size: 15px; color: %%MUTED%%">{unit}</span></span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></div>
<div style="margin-left: auto; display: flex; gap: 8px">{round_btn("minus", "Decrease " + lbl)}{round_btn("plus", "Increase " + lbl)}</div></div>'''
    seg = "".join(f'<button style="flex-grow: 1; height: 34px; border-radius: 17px; border: none; {"background: %%SEG_ON%%; box-shadow: %%SEG_SHADOW%%; color: %%INK%%; font-weight: 600" if x == "Female" else "background: transparent; color: %%MUTED%%; font-weight: 500"}; font-family: \'DM Sans\', sans-serif; font-size: 14px">{x}</button>' for x in ("Female", "Male"))
    body = f'''{top_bar(gbtn("back", "Back"), progress(3, 6), SKIP)}
<div style="position: absolute; top: 104px; left: 0; right: 0; padding: 0 20px; display: flex; flex-direction: column; gap: 14px">
<h1 style="{H1}">A few basics</h1>
<span style="font-size: 15px; color: %%MUTED%%">So your coach can set realistic targets.</span>
<div style="border-radius: 22px; {CARD}; padding: 14px 18px 4px; display: flex; flex-direction: column">
<div style="display: flex; padding: 3px; border-radius: 20px; background: %%SEG%%; margin-bottom: 4px">{seg}</div>
{stepper("Height", "168", "cm", "Hold to change faster")}
{stepper("Current weight", "73.0", "kg", "Your starting point")}
<div style="display: flex; flex-direction: column; gap: 10px; padding: 16px 0 14px; border-top: 1px solid %%HAIR%%">
<div style="display: flex; font-size: 13px"><span style="color: %%MUTED%%">How active are you?</span><span style="margin-left: auto; font-weight: 600; color: %%TRAIN_TEXT%%">Moderately</span></div>
{seg_scale("Activity", 3, color="%%TRAIN_TEXT%%")}
<div style="display: flex; font-size: 11px; color: %%MUTED%%"><span>Desk job</span><span style="margin-left: auto">Very active</span></div>
</div>
</div>
</div>
{cta("Continue")}'''
    return screen("Onboarding basics glass", body, t, mode)


# ---------------------------------------------------------------- Check-in
def checkin(mode, t):
    def row(lbl, val, desc, color):
        return f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid %%HAIR%%"><div style="display: flex; font-size: 14px"><span style="font-weight: 500">{lbl}</span><span style="margin-left: auto; font-size: 13px; color: {color}; font-weight: 600">{desc}</span></div>{seg_scale(lbl, val, color=color)}</div>'
    photo = lambda lbl, filled: (f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px; align-items: center"><div style="width: 100%; height: 88px; border-radius: 14px; background: linear-gradient(160deg, #D9B9A0, #B98E73)"></div><span style="font-size: 12px; color: %%INK2%%">{lbl}</span></div>'
                                 if filled else f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px; align-items: center"><button aria-label="Add {lbl} photo" style="width: 100%; height: 88px; border-radius: 14px; border: 1px dashed %%MUTED%%; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("camera", 20, sw="1.6")}</button><span style="font-size: 12px; color: %%MUTED%%">{lbl}</span></div>')
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 84px; display: flex; flex-direction: column; gap: 12px">
<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px">{eyebrow("WEEK 6 · DUE SUNDAY", "%%RED%%")}<h1 style="{H1}">Weekly check-in</h1></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px 18px; display: flex; align-items: center">
<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; color: %%MUTED%%">Weight this morning</span><span style="display: flex; align-items: baseline; gap: 4px"><span style="{DISP}; font-size: 32px; font-weight: 600; letter-spacing: -0.01em">72.4</span><span style="font-size: 15px; color: %%MUTED%%">kg</span></span><span style="font-size: 12px; font-weight: 600; color: %%NUTRI_TEXT%%">−0.6 kg vs last week</span></div>
<div style="margin-left: auto; display: flex; gap: 8px">{round_btn("minus", "Decrease weight")}{round_btn("plus", "Increase weight")}</div>
</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 12px 18px 4px">
<div style="padding: 2px 0 10px; {DISP}; font-size: 17px; font-weight: 600">How was your week?</div>
{row("Energy", 4, "Good", "%%TRAIN_TEXT%%")}{row("Sleep", 2, "Short nights", "%%TRAIN_TEXT%%")}{row("Hunger", 3, "Okay", "%%NUTRI_TEXT%%")}
</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 14px 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex"><span style="{DISP}; font-size: 17px; font-weight: 600">Progress photos</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">1 of 3</span></div>
<div style="display: flex; gap: 10px">{photo("Front", True)}{photo("Side", False)}{photo("Back", False)}</div>
</div>
</div>
{top_bar(gbtn("back", "Back"), "", gbtn("x", "Close"))}
{fade()}
{cta("Send to Martin", "arrowup")}'''
    return screen("Check-in glass", body, t, mode)


SCREENS = [("Workout", workout), ("Nutrition", nutrition), ("Chat", chat), ("Login", login),
           ("Register", register), ("OnboardingGoal", onboarding_goal), ("OnboardingBasics", onboarding_body), ("CheckIn", checkin)]
for mode, t in MODES.items():
    for label_, fn in SCREENS:
        fname = f"Glass{label_}{mode}.dc.html"
        with open(os.path.join(HERE, "project", fname), "w") as f:
            f.write(fn(mode, t))
        print(fname)
