"""Three colour options for the Today cards, shown side by side (light mode)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen5.py")).read().split("SCREENS = [")[0]
exec(_src)
V1 = False
PATHS.setdefault("ruler", '<rect x="3" y="8" width="18" height="8" rx="1.5"></rect><path d="M7 8v3"></path><path d="M11 8v4"></path><path d="M15 8v3"></path>')
MACRO["FIB"] = "#2E9CB0"  # fibre: cyan, distinct from the section and macro colours
PATHS.setdefault("chevdown", '<path d="M6 9l6 6 6-6"></path>')


def meals_list(on_tint=False):
    out = ""
    hair = "rgba(20,20,20,0.08)" if on_tint else "%%HAIR%%"
    for i, (name, time, food, kcal, eaten) in enumerate(TODAY_MEALS):
        nxt = name == "Lunch"
        if eaten:
            box = f'<button role="checkbox" aria-checked="true" aria-label="{name} eaten" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: none; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("check", 14, sw="2.6")}</button>'
        else:
            box = f'<button role="checkbox" aria-checked="false" aria-label="Mark {name} as eaten" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: 1.5px solid {"%%NUTRI%%" if nxt else "%%MUTED%%"}; background: transparent; padding: 0; opacity: {1 if nxt else 0.5}"></button>'
        tag = '<span style="padding: 2px 7px; border-radius: 999px; background: %%NUTRI%%; color: %%ON%%; font-size: 11px; font-weight: 600">Next</span>' if nxt else ""
        out += f'''<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: {"none" if i == 0 else "1px solid " + hair}">{box}
<a href="#" style="flex-grow: 1; display: flex; align-items: center; gap: 8px; color: %%INK%%; opacity: {0.55 if eaten else 1}; {A}"><span style="display: flex; flex-direction: column; gap: 1px"><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: %%MUTED%%">{name} · {time}{tag}</span><span style="font-size: 15px; font-weight: {500 if eaten else 600}">{food}</span></span>
<span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{kcal}</span><span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a></div>'''
    return out


def training_card(soft):
    if soft:
        return f'''<div style="margin: 0 16px; border-radius: 24px; background: %%TRAIN_SOFT%%; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center">{eyebrow("TODAY'S TRAINING", "%%TRAIN_TEXT%%", "dumbbell")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Week 6 · 3 of 4</span></div>
<div style="display: flex; align-items: center"><span style="display: flex; flex-direction: column; gap: 3px"><span style="{DISP}; font-size: 24px; font-weight: 600">Lower body A</span><span style="font-size: 13px; color: %%MUTED%%">6 exercises · 55 min · with Martin</span></span>
<a href="#" style="margin-left: auto; height: 38px; padding: 0 16px; border-radius: 19px; background: %%TRAIN%%; color: %%ON%%; {A}; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("play", 13, sw="2.2")}Start</a></span></div></div>'''
    return f'''<div style="margin: 0 16px; border-radius: 24px; background: %%TRAIN%%; color: %%ON%%; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center">{eyebrow("TODAY'S TRAINING", "%%ON%%", "dumbbell")}<span style="margin-left: auto; font-size: 12px; font-weight: 500">Week 6 · 3 of 4</span></div>
<div style="display: flex; align-items: center"><span style="display: flex; flex-direction: column; gap: 3px"><span style="{DISP}; font-size: 24px; font-weight: 600">Lower body A</span><span style="font-size: 13px">6 exercises · 55 min · with Martin</span></span>
<a href="#" style="margin-left: auto; height: 38px; padding: 0 16px; border-radius: 19px; background: #141414; color: #F6F4F0; {A}; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("play", 13, "#F6F4F0", "2.2")}Start</a></div></div>'''


def summary_block(solid):
    if solid:
        return f'''<div style="display: flex; align-items: center">{eyebrow("NUTRITION", ON_INK, "leaf")}<span style="margin-left: auto; font-size: 12px; font-weight: 500">860 kcal left</span></div>
<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 24px; font-weight: 600">1,240</span><span style="font-size: 13px; color: {ON_MUTED}">/ 2,100 kcal</span></div>
{on_bar(59, 4)}
<div style="display: flex; gap: 16px">{on_macro("Protein", "88 g", "%%PROT%%", 59)}{on_macro("Carbs", "131 g", "%%CARB%%", 57)}{on_macro("Fat", "41 g", "%%FAT%%", 59)}</div>'''
    return f'''<div style="display: flex; align-items: center">{eyebrow("NUTRITION", "%%NUTRI_TEXT%%", "leaf")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">860 kcal left</span></div>
<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 24px; font-weight: 600">1,240</span><span style="font-size: 13px; color: %%MUTED%%">/ 2,100 kcal</span></div>
<div style="height: 4px; border-radius: 4px; background: rgba(20,20,20,0.08)"><div style="width: 59%; height: 4px; border-radius: 4px; background: %%NUTRI%%"></div></div>
<div style="display: flex; gap: 16px">{macro("Protein", "88 g", "%%PROT%%", 59)}{macro("Carbs", "131 g", "%%CARB%%", 57)}{macro("Fat", "41 g", "%%FAT%%", 59)}</div>'''


def frame(variant, mode, t):
    profile = f'<button aria-label="Profile" style="width: 40px; height: 40px; border-radius: 20px; {GL}; color: %%INK%%; font: 600 13px \'DM Sans\', sans-serif; padding: 0">ES</button>'
    top = head("Today", gbtn("bell", "Notifications", dot=True) + profile)
    if variant == "O":  # original: solid orange training, white nutrition card with green labels
        cards = (training_card(False)
                 + f'<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 12px">{summary_block(False)}<div style="border-top: 1px solid %%HAIR%%">{meals_list()}</div></div>')
    elif variant == "D":  # both white cards; training lists today's sessions like meals
        sessions = [("Morning", "Mobility flow", "15 min", "done"), ("Afternoon", "Lower body A", "6 exercises · 55 min", "next"), ("Evening", "Easy run", "Zone 2 · 30 min", "todo")]
        rows = ""
        for i, (when, name, meta, state) in enumerate(sessions):
            done, nxt = state == "done", state == "next"
            if done:
                box = f'<button role="checkbox" aria-checked="true" aria-label="{name} done" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: none; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("check", 14, sw="2.6")}</button>'
                action = '<span style="font-size: 13px; color: %%MUTED%%">Done</span>'
            else:
                box = f'<button role="checkbox" aria-checked="false" aria-label="Mark {name} as done" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: 1.5px solid {"%%TRAIN%%" if nxt else "%%MUTED%%"}; background: transparent; padding: 0; opacity: {1 if nxt else 0.5}"></button>'
                st = "background: %%TRAIN%%; color: %%ON%%; border: none" if nxt else "background: transparent; color: %%TRAIN_TEXT%%; border: 1px solid %%HAIR%%"
                action = f'<a href="#" aria-label="Start {name}" style="height: 32px; padding: 0 12px; border-radius: 16px; {st}; {A}; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 5px">{ic("play", 11, sw="2.2")}Start</a>'
            tag = '<span style="padding: 2px 7px; border-radius: 999px; background: %%TRAIN%%; color: %%ON%%; font-size: 11px; font-weight: 600">Next</span>' if nxt else ""
            rows += f'''<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}">{box}
<a href="#" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; color: %%INK%%; opacity: {0.55 if done else 1}; {A}"><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: %%MUTED%%">{when} · {meta}{tag}</span><span style="font-size: 15px; font-weight: {500 if done else 600}">{name}</span></a>
{action}</div>'''
        train = f'''<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center">{eyebrow("TRAINING", "%%TRAIN_TEXT%%", "dumbbell")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Week 6 · with Martin</span></div>
<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 24px; font-weight: 600">1</span><span style="font-size: 13px; color: %%MUTED%%">/ 3 sessions today</span></div>
<div style="height: 4px; border-radius: 4px; background: %%HAIR%%"><div style="width: 33%; height: 4px; border-radius: 4px; background: %%TRAIN%%"></div></div>
<div style="border-top: 1px solid %%HAIR%%">{rows}</div>
</div>'''
        cards = (train
                 + f'<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 12px">{summary_block(False)}<div style="border-top: 1px solid %%HAIR%%">{meals_list()}</div></div>')
    elif variant == "E":  # D2 · calmer: done items folded, no macros, no Next tags
        def done_line(text, color, chevron=False):
            c = f'<span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevdown", 15) if chevron else ""}</span>'
            return f'<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 10px 0; color: %%MUTED%%; {A}; font-size: 13px"><span style="width: 20px; height: 20px; border-radius: 10px; background: {color}; color: %%ON%%; display: flex; align-items: center; justify-content: center; opacity: 0.85">{ic("check", 11, sw="2.8")}</span>{text}{c}</a>'

        def item(name, meta, color, primary, action):
            box = f'<button role="checkbox" aria-checked="false" aria-label="Mark {name} as done" style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; border: 1.5px solid {color if primary else "%%MUTED%%"}; background: transparent; padding: 0; opacity: {1 if primary else 0.5}"></button>'
            return f'''<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid %%HAIR%%">{box}
<a href="#" style="flex-grow: 1; display: flex; flex-direction: column; gap: 1px; color: %%INK%%; {A}"><span style="font-size: 15px; font-weight: {600 if primary else 500}">{name}</span><span style="font-size: 12px; color: %%MUTED%%">{meta}</span></a>{action}</div>'''

        start = lambda name, primary: (f'<a href="#" aria-label="Start {name}" style="height: 32px; padding: 0 14px; border-radius: 16px; background: %%TRAIN%%; color: %%ON%%; {A}; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 5px">{ic("play", 11, sw="2.2")}Start</a>' if primary
                                       else f'<a href="#" aria-label="Start {name}" style="width: 32px; height: 32px; border-radius: 16px; border: 1px solid %%HAIR%%; color: %%TRAIN_TEXT%%; {A}; display: flex; align-items: center; justify-content: center">{ic("play", 11, sw="2.2")}</a>')
        kcal = lambda k: f'<span style="font-size: 13px; color: %%MUTED%%">{k}</span>'
        head_row = lambda label, color, icon, right, week: f'<div style="display: flex; align-items: center; gap: 8px">{eyebrow(label, color, icon)}<span style="font-size: 12px; color: %%MUTED%%">· {week}</span><span style="margin-left: auto">{right}</span></div>'
        train = f'''<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 10px">
{head_row("TRAINING", "%%TRAIN_TEXT%%", "dumbbell", '<span style="font-size: 13px"><b style="font-weight: 600">1</b><span style="color: %%MUTED%%"> of 3 done</span></span>', "Week 6 of 12")}
<div style="height: 4px; border-radius: 4px; background: %%HAIR%%"><div style="width: 33%; height: 4px; border-radius: 4px; background: %%TRAIN%%"></div></div>
<div>{done_line("Mobility flow", "%%TRAIN%%")}{item("Lower body A", "Afternoon · 55 min", "%%TRAIN%%", True, start("Lower body A", True))}{item("Easy run", "Evening · 30 min", "%%TRAIN%%", False, start("Easy run", False))}</div>
</div>'''
        nutri = f'''<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 10px">
{head_row("NUTRITION", "%%NUTRI_TEXT%%", "leaf", '<span style="font-size: 13px"><b style="font-weight: 600">1,240</b><span style="color: %%MUTED%%"> / 2,100 kcal</span></span>', "Week 8 of 10")}
<div style="height: 4px; border-radius: 4px; background: %%HAIR%%"><div style="width: 59%; height: 4px; border-radius: 4px; background: %%NUTRI%%"></div></div>
<div>{done_line("2 meals eaten · Breakfast, Snack", "%%NUTRI%%", True)}{item("Chicken rice bowl", "Lunch · 12:30", "%%NUTRI%%", True, kcal("640 kcal"))}{item("Salmon, potatoes, greens", "Dinner · 18:30", "%%NUTRI%%", False, kcal("610 kcal"))}</div>
</div>'''
        def quick(icon, label, value, unit, sub, action_label, action_icon="plus", good=False):
            return f'''<div style="border-radius: 18px; {CARD}; padding: 10px 11px; display: flex; flex-direction: column; gap: 4px; min-width: 0">
<div style="display: flex; align-items: center">{soft_icon(icon, "%%RED_SOFT%%", "%%RED%%", 24)}<button aria-label="{action_label}" style="margin-left: auto; width: 24px; height: 24px; border-radius: 12px; border: 1px solid %%HAIR%%; background: transparent; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic(action_icon, 12, sw="2")}</button></div>
<span style="font-size: 11px; color: %%MUTED%%; padding-top: 2px">{label}</span>
<span style="display: flex; align-items: baseline; gap: 3px"><span style="{DISP}; font-size: 18px; font-weight: 600">{value}</span><span style="font-size: 11px; color: %%MUTED%%">{unit}</span></span>
<span style="font-size: 11px; color: {"%%NUTRI_TEXT%%" if good else "%%MUTED%%"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></div>'''
        if V1:
            tiles = f'''<a href="#" style="margin: 0 16px; border-radius: 18px; {CARD}; padding: 12px 14px; display: flex; align-items: center; gap: 12px; color: %%INK%%; {A}">{soft_icon("clipboard", "%%RED_SOFT%%", "%%RED%%", 34)}
<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 600">Weekly check-in</span><span style="font-size: 12px; color: %%MUTED%%">Due Sunday · about 2 minutes</span></span>
<span style="margin-left: auto; height: 32px; padding: 0 14px; border-radius: 16px; background: %%RED%%; color: #FFFFFF; font-size: 13px; font-weight: 600; display: flex; align-items: center">Fill in</span></a>'''
        else:
            tiles = f'''<div style="margin: 0 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
{quick("ruler", "Weight", "72.4", "kg", "−0.6 this week", "Add measurement", good=True)}
{quick("camera", "Photos", "14", "", "3 days ago", "Take progress photo")}
{quick("clipboard", "Check-in", "Sun", "", "Due in 3 days", "Fill in check-in", "chevron")}
</div>'''
        cards = tiles + train + nutri
    elif variant == "A":  # soft tints on both cards
        cards = (training_card(True)
                 + f'<div style="margin: 0 16px; border-radius: 24px; background: %%NUTRI_SOFT%%; padding: 16px 18px 6px; display: flex; flex-direction: column; gap: 12px">{summary_block(False)}<div style="display: flex; flex-direction: column; border-top: 1px solid rgba(20,20,20,0.08)">{meals_list(True)}</div></div>')
    elif variant == "B":  # solid green header, white meal list in the same card
        cards = (training_card(False)
                 + f'<div style="margin: 0 16px; border-radius: 24px; {CARD}; overflow: hidden"><div style="background: %%NUTRI%%; color: {ON_INK}; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px">{summary_block(True)}</div><div style="padding: 2px 18px 4px">{meals_list()}</div></div>')
    else:  # C: two equal solid tiles, meals as their own white card
        cards = (training_card(False)
                 + f'<div style="margin: 0 16px; border-radius: 24px; background: %%NUTRI%%; color: {ON_INK}; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px">{summary_block(True)}</div>'
                 + f'<div style="margin: 0 16px; border-radius: 24px; {CARD}; padding: 12px 18px 4px"><div style="display: flex; padding-bottom: 6px"><span style="font-size: 15px; font-weight: 600">Meals today</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">2 of 4 eaten</span></div>{meals_list()}</div>')
    body = f'<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 34px; display: flex; flex-direction: column; gap: 12px">{top}{cards}</div>{tabbar("Today", "")}'
    return screen(f"Today option {variant}", body, t, mode)


# D2 is the chosen Today: also write it as the main Today screen
for V1, suffix in ((False, ""), (True, "V1")):
    for mode, t in MODES.items():
        with open(os.path.join(HERE, "project", f"GlassToday{suffix}{mode}.dc.html"), "w") as f:
            f.write(frame("E", mode, t).replace("<title>Today option E", f"<title>Today {suffix or 'glass'}"))

print("ok")
