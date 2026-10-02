"""Plan browsing: training/nutrition plan overview and week detail."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen8.py")).read().split("NEW8 = {")[0]
exec(_src)


def plan_header(kind, name, coach, dates, week, total, pct, stats):
    color, text = ("%%TRAIN%%", "%%TRAIN_TEXT%%") if kind == "t" else ("%%NUTRI%%", "%%NUTRI_TEXT%%")
    label, icon = ("TRAINING PLAN", "dumbbell") if kind == "t" else ("NUTRITION PLAN", "leaf")
    cells = "".join(f'<span style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">{l}</span><span style="font-size: 15px; font-weight: 600">{v}</span></span>' for l, v in stats)
    return f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 6px">{eyebrow(label, text, icon)}<h1 style="{H1}">{name}</h1><span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: %%MUTED%%">{avatar(coach[0], 22)}{coach[1]} · {dates}</span></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: baseline"><span style="font-size: 15px; font-weight: 600">Week {week} <span style="color: %%MUTED%%; font-weight: 400">of {total}</span></span><span style="margin-left: auto; font-size: 13px; color: {text}; font-weight: 600">{pct}%</span></div>
<div style="height: 4px; border-radius: 4px; background: %%HAIR%%"><div style="width: {pct}%; height: 4px; border-radius: 4px; background: {color}"></div></div>
<div style="display: flex; gap: 12px">{cells}</div></div>'''


def week_rows(kind, rows):
    color, soft, text = ("%%TRAIN%%", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%") if kind == "t" else ("%%NUTRI%%", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%")
    out = ""
    for i, (title, sub, state, right) in enumerate(rows):
        border = "" if i == 0 else "border-top: 1px solid %%HAIR%%;"
        if state == "done":
            mark = f'<span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; background: {color}; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 13, sw="2.6")}</span>'
        elif state == "folded":
            mark = f'<span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; background: %%SEG%%; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("check", 13, sw="2.4")}</span>'
        elif state == "current":
            mark = f'<span style="width: 23px; height: 23px; flex-shrink: 0; border-radius: 13px; border: 1.5px solid {color}; display: flex; align-items: center; justify-content: center"><span style="width: 9px; height: 9px; border-radius: 5px; background: {color}"></span></span>'
        elif state == "upcoming":
            mark = '<span style="width: 24px; height: 24px; flex-shrink: 0; border-radius: 13px; border: 1px dashed %%MUTED%%"></span>'
        else:  # preparing
            mark = f'<span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; background: %%SEG%%; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("clock", 13, sw="1.8")}</span>'
        bg = f"background: {soft}; margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 14px; border-top: none;" if state == "current" else border
        col = "%%MUTED%%" if state in ("preparing", "folded") else "%%INK%%"
        chev = f'<span style="display: flex; color: %%MUTED%%">{ic("chevdown" if state == "folded" else "chevron", 15)}</span>' if state != "preparing" else ""
        out += f'''<a href="#" style="display: flex; align-items: center; gap: 12px; padding-top: 12px; padding-bottom: 12px; {bg} color: {col}; {A}">{mark}
<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: {600 if state == "current" else 500}">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></span>
<span style="margin-left: auto; font-size: 13px; color: {text if state == "current" else "%%MUTED%%"}; font-weight: {600 if state == "current" else 400}">{right}</span>{chev}</a>'''
    return f'<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 4px 18px">{out}</div>'


PATHS.setdefault("chevdown", '<path d="M6 9l6 6 6-6"></path>')


# ---------------------------------------------------------------- Training plan overview
def training_plan(mode, t):
    rows = [("Weeks 1 – 4", "2 – 29 Aug", "folded", "16 / 16"),
            ("Week 5", "21 – 27 Sep", "done", "3 / 4"),
            ("Week 6 · this week", "28 Sep – 4 Oct", "current", "2 of 3"),
            ("Week 7", "5 – 11 Oct · published", "upcoming", "4 sessions"),
            ("Week 8", "Martin is preparing it", "preparing", ""),
            ("Weeks 9 – 12", "Not published yet", "preparing", "")]
    body = body_top(f'''{plan_header("t", "Strength block 2", ("MK", "Martin Král"), "2 Aug – 13 Dec", 6, 12, 50, [("Sessions", "17 / 18"), ("Per week", "3 – 4"), ("Formats", "Strength, AMRAP")])}
<div style="padding: 4px 20px 0; display: flex; align-items: center">{eyebrow("WEEKS")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">tap a week to see its days</span></div>
{week_rows("t", rows)}''', top=88, gap=12)
    return screen("Training plan", body + top_bar(gbtn("back", "Back"), "", gbtn("info", "Plan notes")), t, mode)


# ---------------------------------------------------------------- Nutrition plan overview
def nutrition_plan(mode, t):
    rows = [("Weeks 1 – 6", "10 Aug – 20 Sep", "folded", "91 % logged"),
            ("Week 7", "21 – 27 Sep", "done", "26 / 28"),
            ("Week 8 · this week", "28 Sep – 4 Oct", "current", "9 of 28"),
            ("Week 9", "5 – 11 Oct · published", "upcoming", "2,100 kcal"),
            ("Week 10", "Jana is preparing it", "preparing", "")]
    body = body_top(f'''{plan_header("n", "Cut — phase 2", ("JK", "Jana Kučerová"), "10 Aug – 18 Oct", 8, 10, 80, [("Daily target", "2,100 kcal"), ("Meals logged", "89 %"), ("Meals / day", "4")])}
<div style="padding: 4px 20px 0; display: flex; align-items: center">{eyebrow("WEEKS")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">tap a week to see its days</span></div>
{week_rows("n", rows)}
<div style="padding: 0 16px">{group("", list_row("Shopping list · this week", "9 items left", icon="cart", soft="%%NUTRI_SOFT%%", ink="%%NUTRI_TEXT%%", first=True))}</div>''', top=88, gap=12)
    return screen("Nutrition plan", body + top_bar(gbtn("back", "Back"), "", gbtn("info", "Plan notes")), t, mode)


def week_nav(title, sub):
    arrow = lambda icon, label: f'<button aria-label="{label}" style="width: 36px; height: 36px; border-radius: 18px; border: 1px solid %%HAIR%%; background: transparent; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 16, sw="1.8")}</button>'
    return f'<div style="margin: 0 16px; display: flex; align-items: center; gap: 10px">{arrow("back", "Previous week")}<span style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 1px"><span style="font-size: 16px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></span>{arrow("chevron", "Next week")}</div>'


# ---------------------------------------------------------------- Training week
def training_week_detail(mode, t):
    days = [("Mon 28", [("Upper body A", "Strength · 50 min", "done")]),
            ("Tue 29", []),
            ("Wed 30", [("Lower body A", "Strength · 55 min", "done")]),
            ("Thu 1 · today", [("Mobility flow", "15 min", "done"), ("Lower body A", "Strength · 55 min", "next"), ("Easy run", "Zone 2 · 30 min", "todo")]),
            ("Fri 2", []),
            ("Sat 3", [("Full body C", "Strength, AMRAP, Tabata · 50 min", "todo")]),
            ("Sun 4", [])]
    out = ""
    for i, (day, sessions) in enumerate(days):
        today = "today" in day
        head = f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: {"%%TRAIN_TEXT%%" if today else "%%MUTED%%"}">{day.upper()}</span>'
        if not sessions:
            body = '<span style="font-size: 14px; color: %%MUTED%%">Rest day</span>'
        else:
            body = ""
            for name, meta, st in sessions:
                if st == "done":
                    m = f'<span style="width: 22px; height: 22px; border-radius: 11px; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{ic("check", 11, sw="2.8")}</span>'
                else:
                    m = f'<span style="width: 20px; height: 20px; border-radius: 11px; border: 1.5px solid {"%%TRAIN%%" if st == "next" else "%%MUTED%%"}; opacity: {1 if st == "next" else 0.5}; flex-shrink: 0"></span>'
                body += f'<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 4px 0; color: %%INK%%; opacity: {0.55 if st == "done" else 1}; {A}">{m}<span style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: {600 if st == "next" else 500}">{name}</span><span style="font-size: 12px; color: %%MUTED%%">{meta}</span></span><span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 14)}</span></a>'
        bg = "background: %%TRAIN_SOFT%%; margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 14px;" if today else ("" if i == 0 else "border-top: 1px solid %%HAIR%%;")
        out += f'<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 11px; padding-bottom: 11px; {bg}">{head}{body}</div>'
    body = body_top(f'''<div style="padding: 0 20px"><span style="font-size: 13px; color: %%MUTED%%">Strength block 2</span></div>
{week_nav("Week 6 of 12", "28 Sep – 4 Oct · 2 of 6 done")}
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 4px 18px">{out}</div>''', top=84, gap=12)
    return screen("Training week detail", body + top_bar(gbtn("back", "Back"), '<span style="font-size: 15px; font-weight: 600">Training</span>', ""), t, mode)


# ---------------------------------------------------------------- Nutrition week
def nutrition_week_detail(mode, t):
    days = [("Mon 28", 4, 4, "2,080"), ("Tue 29", 4, 4, "2,140"), ("Wed 30", 3, 4, "1,890"), ("Thu 1 · today", 2, 4, "1,240"),
            ("Fri 2", 0, 4, ""), ("Sat 3", 0, 4, ""), ("Sun 4", 0, 4, "")]
    out = ""
    for i, (day, eaten, total, kcal) in enumerate(days):
        today = "today" in day
        future = not kcal
        dots = "".join(f'<span style="width: 8px; height: 8px; border-radius: 4px; {"background: %%NUTRI%%" if j < eaten else "border: 1px solid %%MUTED%%; box-sizing: border-box; opacity: 0.6"}"></span>' for j in range(total))
        right = f'<span style="font-size: 13px; color: %%MUTED%%">{"plan · 2,100 kcal" if future else kcal + " kcal"}</span>'
        bg = "background: %%NUTRI_SOFT%%; margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 14px;" if today else ("" if i == 0 else "border-top: 1px solid %%HAIR%%;")
        out += f'''<a href="#" style="display: flex; align-items: center; gap: 12px; padding-top: 13px; padding-bottom: 13px; {bg} color: %%INK%%; {A}">
<span style="width: 92px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: {600 if today else 500}; color: {"%%NUTRI_TEXT%%" if today else "%%INK%%"}">{day}</span><span style="display: flex; gap: 4px">{dots}</span></span>
<span style="margin-left: auto">{right}</span><span style="display: flex; color: %%MUTED%%">{ic("chevron", 14)}</span></a>'''
    body = body_top(f'''<div style="padding: 0 20px"><span style="font-size: 13px; color: %%MUTED%%">Cut — phase 2</span></div>
{week_nav("Week 8 of 10", "28 Sep – 4 Oct · 13 of 28 meals")}
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 4px 18px">{out}</div>
<div style="margin: 0 16px; display: flex; gap: 14px; padding: 0 4px; font-size: 12px; color: %%MUTED%%"><span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 4px; background: %%NUTRI%%"></span>Meal eaten</span><span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 4px; border: 1px solid %%MUTED%%; box-sizing: border-box"></span>Planned</span></div>
<div style="padding: 0 16px">{group("", list_row("Shopping list for this week", "9 items left", icon="cart", soft="%%NUTRI_SOFT%%", ink="%%NUTRI_TEXT%%", first=True))}</div>''', top=84, gap=12)
    return screen("Nutrition week detail", body + top_bar(gbtn("back", "Back"), '<span style="font-size: 15px; font-weight: 600">Nutrition</span>', ""), t, mode)


NEW10 = {"TrainingPlan": training_plan, "TrainingWeekDetail": training_week_detail, "NutritionPlan": nutrition_plan, "NutritionWeekDetail": nutrition_week_detail}
for mode, t in MODES.items():
    for label_, fn in NEW10.items():
        with open(os.path.join(HERE, "project", f"Glass{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
        print(f"Glass{label_}{mode}.dc.html")
