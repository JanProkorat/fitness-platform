import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen.py")).read().split("# ---------------------------------------------------------------- palette")[0]
_src = _src.replace('os.path.dirname(__file__)', repr(HERE))
exec(_src)
PATHS.update({
    "play": '<path d="M7 4.5l12 7.5-12 7.5z"></path>',
    "info": '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 11v5"></path><path d="M12 8v.1"></path>',
    "arrowup": '<path d="M12 19V5"></path><path d="M6 11l6-6 6 6"></path>',
    "pause": '<path d="M8.5 5v14"></path><path d="M15.5 5v14"></path>',
})

MODES = {
    "Light": dict(
        BG="#FFFFFF", CARD="#FFFFFF", CARD_BORDER="1px solid #ECEAE5", CARD_SHADOW="0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
        INK="#141414", INK2="#3A3835", MUTED="#6B6863", LINE="#ECEAE5", TRACK="#EFEDE8",
        TRAIN="#F28C38", NUTRI="#8CC152", ON="#141414", TRAIN_TEXT="#B4500C", NUTRI_TEXT="#3F7D2A",
        RED="#D2342A", NUTRI_SOFT="#EEF6E3", TRAIN_SOFT="#FFF0E2",
        GLASS="rgba(255,255,255,0.58)", GLASS_BORDER="rgba(255,255,255,0.85)",
        GLASS_SHADOW="0 10px 30px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        GLASS_ON_COLOR="rgba(255,255,255,0.32)", GLASS_ON_COLOR_BORDER="rgba(255,255,255,0.6)",
        PILL="rgba(20,20,20,0.08)", INPUT_BG="#F6F5F2",
    ),
    "Dark": dict(
        BG="#0B0B0C", CARD="#1C1C1E", CARD_BORDER="1px solid #26262A", CARD_SHADOW="none",
        INK="#F5F5F7", INK2="#D1D1D6", MUTED="#98989F", LINE="#2C2C2E", TRACK="#2C2C2E",
        TRAIN="#F28C38", NUTRI="#8CC152", ON="#141414", TRAIN_TEXT="#F7A863", NUTRI_TEXT="#A9D673",
        RED="#D2342A", NUTRI_SOFT="#243319", TRAIN_SOFT="#3A2414",
        GLASS="rgba(44,44,48,0.52)", GLASS_BORDER="rgba(255,255,255,0.14)",
        GLASS_SHADOW="0 10px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)",
        GLASS_ON_COLOR="rgba(255,255,255,0.28)", GLASS_ON_COLOR_BORDER="rgba(255,255,255,0.5)",
        PILL="rgba(255,255,255,0.12)", INPUT_BG="#1C1C1E",
    ),
}

GL = "background: %%GLASS%%; -webkit-backdrop-filter: blur(22px) saturate(180%); backdrop-filter: blur(22px) saturate(180%); border: 1px solid %%GLASS_BORDER%%; box-shadow: %%GLASS_SHADOW%%"
GL_ON_COLOR = "background: %%GLASS_ON_COLOR%%; -webkit-backdrop-filter: blur(18px) saturate(160%); backdrop-filter: blur(18px) saturate(160%); border: 1px solid %%GLASS_ON_COLOR_BORDER%%; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 18px rgba(0,0,0,0.12)"
CARD = "background: %%CARD%%; border: %%CARD_BORDER%%; box-shadow: %%CARD_SHADOW%%"


def gbtn(icon, label, style=GL, color="%%INK%%", size=44, dot=False):
    d = '<span style="position: absolute; top: 9px; right: 10px; width: 8px; height: 8px; border-radius: 4px; background: %%RED%%"></span>' if dot else ""
    return f'<button aria-label="{label}" style="position: relative; width: {size}px; height: {size}px; border-radius: {size // 2}px; {style}; color: {color}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 20)}{d}</button>'


def tabbar(active, accessory):
    items = [("Today", "home", "%%RED%%"), ("Training", "dumbbell", "%%TRAIN_TEXT%%"), ("Nutrition", "leaf", "%%NUTRI_TEXT%%"), ("Messages", "chat", "%%RED%%")]
    out = ""
    for label, icon, col in items:
        on = label == active
        bg = "background: %%PILL%%;" if on else ""
        c = col if on else "%%INK2%%"
        out += f'<a href="#" style="flex-grow: 1; height: 54px; border-radius: 27px; {bg} color: {c}; text-decoration: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; font-weight: {700 if on else 500}">{ic(icon, 22, sw="2" if on else "1.7")}{label}</a>'
    return f'''<div style="position: absolute; left: 14px; right: 14px; bottom: 26px; display: flex; gap: 10px; align-items: center">
<nav aria-label="Tabs" style="flex-grow: 1; height: 64px; padding: 0 5px; box-sizing: border-box; border-radius: 32px; {GL}; display: flex; align-items: center">{out}</nav>
{accessory}
</div>'''


def label(icon, text, color):
    return f'<div style="display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: {color}">{ic(icon, 15, sw="2.2")}{text}</div>'


def bar(pct, color, h=8, track="%%TRACK%%"):
    return f'<div style="height: {h}px; border-radius: {h // 2}px; background: {track}"><div style="width: {pct}%; height: {h}px; border-radius: {h // 2}px; background: {color}"></div></div>'


def macro(lbl, val, color, pct):
    return f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; color: %%MUTED%%">{lbl}</span>{bar(pct, color, 5)}<span style="font-size: 13px; font-weight: 600">{val}</span></div>'


def screen(title, body, t, mode):
    html = f'''<div style="position: relative; width: 390px; height: 844px; background: %%BG%%; {FONT}; color: %%INK%%; overflow: hidden">
{body}
</div>'''
    return page(f"{title} {mode}", 390, 844, html, t)


def big_title(text, right):
    return f'''<div style="display: flex; align-items: flex-end; padding: 0 20px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; font-weight: 600; color: %%MUTED%%">Thursday, 1 October</span><h1 style="margin: 0; {DISP}; font-size: 36px; font-weight: 700; letter-spacing: -0.02em">{text}</h1></div>
<div style="margin-left: auto; display: flex; gap: 10px; padding-bottom: 4px">{right}</div>
</div>'''


# ---------------------------------------------------------------- Today
def today(mode, t):
    chip = lambda x: f'<span style="padding: 6px 11px; border-radius: 999px; background: rgba(20,20,20,0.1); font-size: 12px; font-weight: 700">{x}</span>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 30px; display: flex; flex-direction: column; gap: 18px">
{big_title("Today", gbtn("bell", "Notifications", dot=True) + f'<button aria-label="Profile" style="width: 44px; height: 44px; border-radius: 22px; {GL}; color: %%INK%%; font: 700 14px \'DM Sans\', sans-serif; padding: 0">ES</button>')}
<div style="margin: 0 16px; border-radius: 30px; background: %%TRAIN%%; color: %%ON%%; padding: 22px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center">{label("dumbbell", "TODAY'S TRAINING", "%%ON%%")}<span style="margin-left: auto; font-size: 13px; font-weight: 700">Week 6 · 3 of 4</span></div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 32px; font-weight: 700; letter-spacing: -0.02em">Lower body A</span><span style="font-size: 14px; font-weight: 500">6 exercises · about 55 min · with Martin</span></div>
<div style="display: flex; gap: 6px">{chip("Back squat")}{chip("RDL")}{chip("+4 more")}</div>
<a href="#" style="height: 52px; border-radius: 26px; background: #141414; color: #F28C38; text-decoration: none; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px">{ic("play", 18, "#F28C38", "2.4")}Start workout</a>
</div>
<div style="margin: 0 16px; border-radius: 30px; {CARD}; padding: 20px; display: flex; flex-direction: column; gap: 14px">
{label("leaf", "NUTRITION", "%%NUTRI_TEXT%%")}
<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 32px; font-weight: 700">1,240</span><span style="font-size: 14px; color: %%MUTED%%">of 2,100 kcal</span><span style="margin-left: auto; font-size: 13px; font-weight: 700; color: %%NUTRI_TEXT%%">860 left</span></div>
{bar(59, "%%NUTRI%%", 10)}
<div style="display: flex; gap: 14px">{macro("Protein", "88 / 150 g", "%%PROT%%", 59)}{macro("Carbs", "131 / 230 g", "%%CARB%%", 57)}{macro("Fat", "41 / 70 g", "%%FAT%%", 59)}</div>
<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: 18px; background: %%NUTRI%%; color: %%ON%%; text-decoration: none; font-size: 14px"><span style="font-weight: 800">Next: Lunch</span><span style="font-weight: 500">Chicken rice bowl</span><span style="margin-left: auto; display: flex">{ic("chevron", 18, sw="2.2")}</span></a>
</div>
<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 16px 18px; display: flex; align-items: center; gap: 12px">
<span style="width: 42px; height: 42px; border-radius: 14px; background: %%RED%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("clipboard", 20, sw="2")}</span>
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Weekly check-in due Sunday</span><span style="font-size: 13px; color: %%MUTED%%">Takes about 2 minutes</span></span>
</div>
</div>
{tabbar("Today", gbtn("search", "Search", size=64))}'''
    return screen("Today glass", body, t, mode)


# ---------------------------------------------------------------- Workout
def workout(mode, t):
    def setrow(n, prev, kg, reps, done):
        if done:
            mark = f'<span style="width: 34px; height: 34px; border-radius: 17px; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 18, sw="2.6")}</span>'
            cell = lambda v: f'<span style="font-size: 17px; font-weight: 700; text-align: center">{v}</span>'
            bg = ""
        else:
            mark = '<span style="width: 32px; height: 32px; border-radius: 17px; border: 2px solid %%TRAIN%%"></span>'
            cell = lambda v: f'<input value="{v}" aria-label="Set {n}" style="width: 100%; box-sizing: border-box; height: 42px; border-radius: 14px; border: 2px solid %%TRAIN%%; background: %%INPUT_BG%%; text-align: center; font: 700 17px \'DM Sans\', sans-serif; color: %%INK%%">'
            bg = "background: %%TRAIN_SOFT%%;"
        return f'<div style="display: grid; grid-template-columns: 30px minmax(0, 1fr) 66px 66px 36px; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 18px; {bg}"><span style="font-size: 15px; font-weight: 700; color: %%MUTED%%">{n}</span><span style="font-size: 13px; color: %%MUTED%%">{prev}</span>{cell(kg)}{cell(reps)}{mark}</div>'
    seg = "".join(f'<span style="height: 5px; border-radius: 3px; background: #141414; opacity: {1 if i < 1 else 0.45 if i == 1 else 0.15}"></span>' for i in range(6))
    nxt = lambda n, s: f'<div style="display: flex; align-items: center; padding: 13px 0; border-top: 1px solid %%LINE%%"><span style="font-size: 15px; font-weight: 600">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{s}</span></div>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 330px; background: %%TRAIN%%; color: %%ON%%; padding: 96px 22px 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px">
<span style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em">LOWER BODY A · EXERCISE 2 OF 6</span>
<span style="{DISP}; font-size: 38px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em">Romanian<br>deadlift</span>
<span style="font-size: 15px; font-weight: 600">3 sets × 8–10 reps · rest 90 s</span>
<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; padding-top: 6px">{seg}</div>
</div>
<div style="position: absolute; top: 30px; left: 16px; right: 16px; display: flex; align-items: center; gap: 10px">
{gbtn("back", "Back", GL_ON_COLOR, "#141414")}
<span style="margin-left: auto; height: 44px; padding: 0 16px; border-radius: 22px; {GL_ON_COLOR}; color: #141414; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 7px">{ic("clock", 17, sw="2.2")}18:42</span>
{gbtn("pause", "Pause workout", GL_ON_COLOR, "#141414")}
</div>
<div style="position: absolute; top: 306px; left: 0; right: 0; bottom: 0; border-radius: 30px 30px 0 0; background: %%BG%%; padding: 18px 16px 0; display: flex; flex-direction: column; gap: 14px">
<div style="border-radius: 26px; {CARD}; padding: 14px 6px 8px; display: flex; flex-direction: column; gap: 4px">
<div style="display: grid; grid-template-columns: 30px minmax(0, 1fr) 66px 66px 36px; gap: 10px; padding: 0 12px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: %%MUTED%%"><span>SET</span><span>LAST TIME</span><span style="text-align: center">KG</span><span style="text-align: center">REPS</span><span></span></div>
{setrow("1", "60 × 10", "62.5", "10", True)}{setrow("2", "60 × 10", "62.5", "9", True)}{setrow("3", "60 × 9", "62.5", "8", False)}
</div>
<div style="padding: 0 6px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">UP NEXT</span>{nxt("Bulgarian split squat", "3 × 10")}{nxt("Lying leg curl", "3 × 12")}{nxt("Standing calf raise", "4 × 15")}</div>
</div>
<div style="position: absolute; left: 14px; right: 14px; bottom: 26px; display: flex; gap: 10px">
<button style="height: 64px; padding: 0 20px; border-radius: 32px; {GL}; color: %%INK%%; font: 700 15px 'DM Sans', sans-serif; display: flex; align-items: center; gap: 7px">{ic("clock", 18)}Rest 1:30</button>
<button style="flex-grow: 1; height: 64px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.45); background: rgba(242,140,56,0.9); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 26px rgba(242,140,56,0.35); color: #141414; font: 800 17px 'DM Sans', sans-serif">Log set 3</button>
</div>'''
    return screen("Workout glass", body, t, mode)


# ---------------------------------------------------------------- Nutrition
def nutrition(mode, t):
    days = ""
    for i, (dn, num) in enumerate([("M", "28"), ("T", "29"), ("W", "30"), ("T", "1"), ("F", "2"), ("S", "3"), ("S", "4")]):
        on = i == 3
        st = "background: %%NUTRI%%; color: %%ON%%" if on else "color: %%INK%%"
        sub = "%%ON%%" if on else "%%MUTED%%"
        days += f'<a href="#" style="flex-grow: 1; height: 54px; border-radius: 27px; {st}; text-decoration: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px"><span style="font-size: 11px; font-weight: 700; color: {sub}">{dn}</span><span style="font-size: 16px; font-weight: 800">{num}</span></a>'
    ring = '<svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="%%TRACK%%" stroke-width="12"></circle><circle cx="60" cy="60" r="50" fill="none" stroke="%%NUTRI%%" stroke-width="12" stroke-linecap="round" stroke-dasharray="185 314" transform="rotate(-90 60 60)"></circle></svg>'

    def meal(name, food, kcal, done):
        if done:
            act = f'<span style="width: 38px; height: 38px; border-radius: 19px; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 19, sw="2.6")}</span>'
        else:
            act = f'<button style="height: 38px; padding: 0 14px; border-radius: 19px; border: 2px solid %%NUTRI%%; background: transparent; color: %%NUTRI_TEXT%%; font: 800 13px \'DM Sans\', sans-serif; display: flex; align-items: center; gap: 4px">{ic("plus", 15, sw="2.4")}Log</button>'
        return f'<div style="display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-top: 1px solid %%LINE%%"><div style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: %%MUTED%%">{name}</span><span style="font-size: 15px; font-weight: 700">{food}</span><span style="font-size: 13px; color: %%MUTED%%">{kcal} kcal</span></div><span style="margin-left: auto">{act}</span></div>'
    mb = lambda l, v, g, c, p: f'<div style="display: flex; flex-direction: column; gap: 5px"><div style="display: flex; font-size: 13px"><span style="color: %%INK2%%">{l}</span><span style="margin-left: auto; font-weight: 700">{v}<span style="color: %%MUTED%%; font-weight: 400"> / {g} g</span></span></div>{bar(p, c, 6)}</div>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 30px; display: flex; flex-direction: column; gap: 16px">
{big_title("Nutrition", gbtn("cart", "Shopping list"))}
<div style="margin: 0 16px; padding: 5px; border-radius: 32px; {GL}; display: flex">{days}</div>
<div style="margin: 0 16px; border-radius: 30px; {CARD}; padding: 18px; display: flex; align-items: center; gap: 18px">
<div style="position: relative; width: 120px; height: 120px; flex-shrink: 0">{ring}<div style="position: absolute; top: 0; left: 0; width: 120px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center"><span style="{DISP}; font-size: 26px; font-weight: 700">1,240</span><span style="font-size: 12px; color: %%MUTED%%">of 2,100 kcal</span></div></div>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px">{mb("Protein", "88", "150", "%%PROT%%", 59)}{mb("Carbs", "131", "230", "%%CARB%%", 57)}{mb("Fat", "41", "70", "%%FAT%%", 59)}</div>
</div>
<div style="margin: 0 16px; border-radius: 30px; {CARD}; overflow: hidden">
<div style="padding: 16px 18px 12px; display: flex; align-items: center"><span style="{DISP}; font-size: 19px; font-weight: 700">Meals</span><span style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%NUTRI_TEXT%%">2 of 4 logged</span></div>
{meal("BREAKFAST", "Oat bowl with berries", "420", True)}{meal("SNACK", "Greek yogurt, honey", "180", True)}{meal("LUNCH", "Chicken rice bowl", "640", False)}{meal("DINNER", "Salmon, potatoes, greens", "610", False)}
</div>
</div>
{tabbar("Nutrition", f'<button aria-label="Log food" style="width: 64px; height: 64px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.45); background: rgba(140,193,82,0.92); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 26px rgba(140,193,82,0.35); color: #141414; display: flex; align-items: center; justify-content: center; padding: 0">{ic("plus", 26, sw="2.6")}</button>')}'''
    return screen("Nutrition glass", body, t, mode)


# ---------------------------------------------------------------- Chat
def chat(mode, t):
    inc = lambda x: f'<div style="align-self: flex-start; max-width: 270px; padding: 11px 15px; border-radius: 22px 22px 22px 8px; {CARD}; font-size: 15px; line-height: 1.4">{x}</div>'
    own = lambda x: f'<div style="align-self: flex-end; max-width: 270px; padding: 11px 15px; border-radius: 22px 22px 8px 22px; background: %%RED%%; color: #FFFFFF; font-size: 15px; line-height: 1.4">{x}</div>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 112px 16px 0; display: flex; flex-direction: column; gap: 10px">
<span style="align-self: center; font-size: 12px; font-weight: 600; color: %%MUTED%%">Tuesday 18:05</span>
{inc("Leg day felt heavy — only 8 reps on the last RDL set.")}
{own("That's fine. Keep 62.5 kg and aim for 9 next time.")}
{own("How did you sleep this week?")}
{inc("About 6 hours. I'll work on it.")}
<span style="align-self: center; font-size: 12px; font-weight: 600; color: %%MUTED%%">Today 10:30</span>
<a href="#" style="align-self: flex-start; width: 260px; border-radius: 24px; overflow: hidden; {CARD}; text-decoration: none; color: %%INK%%">
<div style="background: %%TRAIN%%; color: %%ON%%; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px">{label("dumbbell", "NEW WEEK PUBLISHED", "%%ON%%")}<span style="{DISP}; font-size: 20px; font-weight: 700">Week 7 · Strength block</span></div>
<div style="padding: 12px 16px; display: flex; align-items: center; font-size: 14px; font-weight: 600">4 sessions · starts Monday<span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 18)}</span></div>
</a>
{inc("New week is up — Thursday is Lower body A again.")}
{own("Thanks! See you Thursday 💪".replace(" 💪", ""))}
<span style="align-self: flex-end; font-size: 12px; color: %%MUTED%%">Read 10:43</span>
<div style="height: 120px; flex-shrink: 0"></div>
</div>
<div style="position: absolute; top: 30px; left: 16px; right: 16px; display: flex; align-items: center; gap: 10px">
{gbtn("back", "Back")}
<div style="flex-grow: 1; height: 52px; border-radius: 26px; {GL}; display: flex; align-items: center; justify-content: center; gap: 10px">
<span style="width: 34px; height: 34px; border-radius: 17px; background: #141414; color: #F6F4F0; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">MK</span>
<span style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 700">Martin Král</span><span style="font-size: 11px; color: %%MUTED%%">Trainer · Nutritionist</span></span>
</div>
{gbtn("info", "Coach details")}
</div>
<div style="position: absolute; left: 14px; right: 14px; bottom: 26px; display: flex; gap: 10px; align-items: center">
{gbtn("plus", "Attach", size=52)}
<label style="flex-grow: 1; height: 52px; padding: 0 6px 0 18px; box-sizing: border-box; border-radius: 26px; {GL}; display: flex; align-items: center; gap: 8px">
<input placeholder="Message" aria-label="Message" style="flex-grow: 1; border: none; outline: none; background: transparent; font: 15px 'DM Sans', sans-serif; color: %%INK%%">
<button aria-label="Send" style="width: 40px; height: 40px; border-radius: 20px; border: none; background: %%RED%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center; padding: 0">{ic("arrowup", 19, sw="2.6")}</button>
</label>
</div>'''
    return screen("Chat glass", body, t, mode)


# ---------------------------------------------------------------- canvas
SCREENS = [("Today", today), ("Workout", workout), ("Nutrition", nutrition), ("Chat", chat)]
cpath = os.path.join(HERE, "project", "canvas.json")
canvas = json.load(open(cpath))
if not any(p["id"] == "glass" for p in canvas["pages"]):
    canvas["pages"].append({"id": "glass", "name": "Mobile — Liquid Glass"})
row_y = {"Light": 0, "Dark": 844 + 120 + 300}
for mode, t in MODES.items():
    x = 0
    for label_, fn in SCREENS:
        fname = f"Glass{label_}{mode}.dc.html"
        with open(os.path.join(HERE, "project", fname), "w") as f:
            f.write(fn(mode, t))
        canvas["boards"][fname] = {"x": x, "y": row_y[mode], "w": 390, "h": 844, "title": f"{mode} · {label_}", "page": "glass"}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
        print(fname)
        x += 390 + 80
    canvas["notes"][f"glass{mode}"] = {"x": 0, "y": row_y[mode] - 300, "text": f"{mode} mode — energetic, Liquid Glass", "kind": "title1", "maxW": x - 80, "page": "glass"}
json.dump(canvas, open(cpath, "w"), indent=2)
