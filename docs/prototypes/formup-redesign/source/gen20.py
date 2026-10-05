"""Web: nutrition plan templates — list, new-template drawer, week editor with drag & drop, meal panel."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen2.py")).read().split("# ---------------------------------------------------------------- canvas")[0]
exec(_src)
PATHS.update({
    "grip": '<circle cx="9" cy="6" r="1.2"></circle><circle cx="15" cy="6" r="1.2"></circle><circle cx="9" cy="12" r="1.2"></circle><circle cx="15" cy="12" r="1.2"></circle><circle cx="9" cy="18" r="1.2"></circle><circle cx="15" cy="18" r="1.2"></circle>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path>',
    "sliders": '<path d="M4 7h10"></path><path d="M18 7h2"></path><circle cx="16" cy="7" r="2"></circle><path d="M4 17h4"></path><path d="M12 17h8"></path><circle cx="10" cy="17" r="2"></circle>',
    "minus": '<path d="M5 12h14"></path>',
    "undo": '<path d="M9 14L4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 0 10h-3"></path>',
})

TEMPLATES = [
    ("Cut — 4 weeks", "Moderate deficit, high protein, four meals a day", 4, "2,100", 4, 6, "Today"),
    ("Lean bulk — 8 weeks", "Small surplus, five meals, pre- and post-workout snacks", 8, "2,850", 5, 3, "2 days ago"),
    ("Maintenance — busy week", "Quick recipes under 20 minutes, batch-cook friendly", 2, "2,300", 4, 9, "Last week"),
    ("Vegetarian cut", "Plant protein focus, no meat or fish", 6, "1,950", 4, 2, "12 Sep"),
    ("Postpartum reset", "Gentle deficit, iron and calcium rich", 8, "2,200", 5, 1, "4 Sep"),
    ("Competition peak week", "Carb manipulation for show week", 1, "2,400", 6, 0, "Aug"),
]


GOAL_OF = {"Cut — 4 weeks": "Lose fat", "Lean bulk — 8 weeks": "Build muscle", "Maintenance — busy week": "Maintain",
           "Vegetarian cut": "Lose fat", "Postpartum reset": None, "Competition peak week": "Performance"}
GOAL_COLOR = {"Lose fat": "%%TRAIN%%", "Build muscle": "%%PROT%%", "Maintain": "%%NUTRI%%", "Performance": "%%CARB%%"}


def goal_pill(goal):
    if goal is None:
        return '<a href="#" style="display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 13px; border: 1px dashed %%LINE%%; color: %%MUTED%%; font-size: 12px; font-weight: 600; text-decoration: none">+ Set goal</a>'
    c = GOAL_COLOR[goal]
    return f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid %%LINE%%; background: %%SURFACE%%; font-size: 12px; font-weight: 600; white-space: nowrap"><span style="width: 7px; height: 7px; border-radius: 4px; background: {c}"></span>{goal}</span>'


def templates_table():
    rows = ""
    for name, desc, weeks, kcal, meals, used, edited in TEMPLATES:
        used_cell = f'<span style="display: inline-flex; align-items: center; gap: 6px">{ic("users", 14)}{used}</span>' if used else '<span style="color: %%MUTED%%">—</span>'
        rows += f'''<tr>
<td style="{TD}"><div style="display: flex; align-items: center; gap: 12px"><span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; display: flex; align-items: center; justify-content: center">{ic("calendar", 18)}</span><div style="display: flex; flex-direction: column; gap: 2px"><a href="#" style="font-size: 14px; font-weight: 600; color: %%INK%%; text-decoration: none">{name}</a><span style="font-size: 12px; color: %%MUTED%%">{desc}</span></div></div></td>
<td style="{TD}">{goal_pill(GOAL_OF.get(name))}</td>
<td style="{TD}">{weeks} {"week" if weeks == 1 else "weeks"}</td>
<td style="{TD}"><span style="font-weight: 600">{kcal}</span> <span style="color: %%MUTED%%">kcal</span></td>
<td style="{TD}">{meals}</td>
<td style="{TD}">{used_cell}</td>
<td style="{TD}; color: %%MUTED%%">{edited}</td>
<td style="{TD}; width: 32px"><button aria-label="Template menu" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("more", 18)}</button></td>
</tr>
'''
    return f'''<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">
<table style="width: 100%; border-collapse: collapse">
<thead><tr><th style="{TH}">Template</th><th style="{TH}">Goal</th><th style="{TH}">Length</th><th style="{TH}">Avg per day</th><th style="{TH}">Meals / day</th><th style="{TH}">Used by</th><th style="{TH}">Edited</th><th style="{TH}"></th></tr></thead>
<tbody>{rows}</tbody></table>
{pagination(6, 6)}</div>'''


def list_main():
    return f'''<div style="display: flex; align-items: flex-end">{title_block("Plan templates", "Reusable nutrition plans — build once, assign to any client", ("NUTRITION", "%%NUTRI%%"))}<span style="margin-left: auto">{btn("New template", "primary", "plus", 40)}</span></div>
<div style="display: flex; align-items: center; gap: 10px">{search("Search templates…")}{filter_pill("Goal")}{filter_pill("Length")}{filter_pill("Meals per day")}{filter_pill("In use")}</div>
{templates_table()}'''


def templates_list(d, t):
    return page(f"Plan templates {d}", W, H, shell(d, "Plan templates", list_main()), t)


def new_template_drawer(d, t):
    under = shell(d, "Plan templates", list_main())
    meal_chip = lambda x, on: f'<button aria-pressed="{"true" if on else "false"}" style="height: 34px; padding: 0 12px; border-radius: 17px; {"background: %%INK%%; color: %%SURFACE%%; border: 1px solid %%INK%%" if on else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%"}; font: 500 13px \'DM Sans\', sans-serif; display: inline-flex; align-items: center; gap: 6px">{ic("check", 13) if on else ""}{x}</button>'
    goal_chip = lambda x, on: f'<button role="radio" aria-checked="{"true" if on else "false"}" style="height: 34px; padding: 0 12px; border-radius: 17px; {"background: %%INK%%; color: %%SURFACE%%; border: 1px solid %%INK%%" if on else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%"}; font: 500 13px {SQ}; display: inline-flex; align-items: center; gap: 7px"><span style="width: 7px; height: 7px; border-radius: 4px; background: {GOAL_COLOR[x]}"></span>{x}</button>'
    stepper = f'''<div style="display: flex; align-items: center; gap: 12px"><button aria-label="Fewer weeks" style="width: 40px; height: 40px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("minus", 16)}</button>
<span style="{DISP}; font-size: 26px; font-weight: 600; min-width: 28px; text-align: center">4</span><button aria-label="More weeks" style="width: 40px; height: 40px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("plus", 16)}</button><span style="font-size: 13px; color: %%MUTED%%">weeks · 28 days</span></div>'''
    sheet = f'''<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: rgba(10,10,12,0.45)"></div>
<aside aria-label="New template" style="position: absolute; top: 0; right: 0; bottom: 0; width: 560px; background: %%SURFACE%%; box-shadow: -12px 0 40px rgba(0,0,0,0.18); display: flex; flex-direction: column">
<div style="padding: 22px 24px; border-bottom: 1px solid %%LINE%%; display: flex; align-items: flex-start">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">New template</span><span style="font-size: 13px; color: %%MUTED%%">Set the frame — you'll fill the meals in the editor</span></div>
<button aria-label="Close" style="margin-left: auto; width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("x", 18)}</button></div>
<div style="flex-grow: 1; padding: 22px 24px; display: flex; flex-direction: column; gap: 22px">
{field("Name", "Cut — 4 weeks")}
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>Description</span><span style="min-height: 84px; padding: 10px 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; font-size: 14px; line-height: 1.5; color: %%INK%%">Moderate deficit, high protein, four meals a day. Good first plan for fat-loss clients.</span></label>
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 500; color: %%INK2%%">Goal <span style="color: %%DANGER%%">*</span></span><div role="radiogroup" aria-label="Goal" style="display: flex; flex-wrap: wrap; gap: 8px">{goal_chip("Lose fat", True)}{goal_chip("Build muscle", False)}{goal_chip("Maintain", False)}{goal_chip("Performance", False)}</div><span style="font-size: 12px; color: %%MUTED%%">We suggest this template for clients with the same goal.</span></div>
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 500; color: %%INK2%%">Number of weeks <span style="color: %%DANGER%%">*</span></span>{stepper}</div>
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 500; color: %%INK2%%">Meals per day</span><div style="display: flex; flex-wrap: wrap; gap: 8px">{meal_chip("Breakfast", True)}{meal_chip("Snack", True)}{meal_chip("Lunch", True)}{meal_chip("Dinner", True)}{meal_chip("Snack 2", False)}{meal_chip("+ Custom", False)}</div><span style="font-size: 12px; color: %%MUTED%%">These become the rows of the editor. You can change them later.</span></div>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>Daily calorie target <span style="color: %%MUTED%%; font-weight: 400">(optional)</span></span>
<span style="width: 200px; height: 40px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; font-size: 14px; color: %%INK%%">2,100<span style="margin-left: auto; color: %%MUTED%%">kcal</span></span></label>
</div>
<div style="padding: 16px 24px; border-top: 1px solid %%LINE%%; display: flex; justify-content: flex-end; gap: 8px">{btn("Cancel", "outline", h=40)}{btn("Create &amp; open editor", "primary", h=40)}</div>
</aside>'''
    body = under.replace("</main>\n</div>", "</main>\n" + sheet + "\n</div>")
    return page(f"New template {d}", W, H, body, t)


# ---------------------------------------------------------------- editor
PATHS.setdefault("panel", '<rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect><path d="M9 4.5v15"></path>')
PATHS.setdefault("note", '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M9 9h6"></path><path d="M9 13h6"></path><path d="M9 17h3"></path>')
PATHS.setdefault("eye", '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="3"></circle>')
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def R(n, k):
    return (n, "recipe", k)


def I(n, k):
    return (n, "ingredient", k)


ROWS = {
    "Breakfast": [[R("Oat bowl with berries", 420)], [R("Greek yogurt bowl", 380), I("Banana", 105)], [R("Oat bowl with berries", 420)], [R("Greek yogurt bowl", 380)], [R("Oat bowl with berries", 420)], [R("Egg &amp; avocado toast", 460)], [R("Egg &amp; avocado toast", 460), I("Orange juice", 110)]],
    "Snack": [[I("Greek yogurt", 100), I("Honey", 60)], [I("Apple", 80), I("Almonds", 130)], [I("Greek yogurt", 100), I("Honey", 60)], [I("Apple", 80), I("Almonds", 130)], [R("Protein shake", 160)], [R("Protein shake", 160)], None],
    "Lunch": [[R("Chicken rice bowl", 640)], [R("Chicken rice bowl", 640), I("Apple", 80), I("Greek yogurt", 100)], [R("Lentil curry", 560)], None, [R("Chicken rice bowl", 640)], [R("Tuna salad", 430), I("Rye bread", 160)], [R("Lentil curry", 560)]],
    "Dinner": [[R("Salmon, potatoes", 610)], [R("Beef stir-fry", 590)], [R("Tofu noodle bowl", 540)], [R("Salmon, potatoes", 610)], [R("Beef stir-fry", 590)], [R("Pizza night", 820)], [R("Tofu noodle bowl", 540)]],
}
DAY_NOTES = {2: "Rest day — lighter carbs", 5: "Family dinner, flexible"}
MEAL_NOTES = {("Lunch", 1), ("Dinner", 5)}
TARGET = 2100
NUTRI_MODE = False
TARGETS = {"P": 150, "C": 220, "F": 70, "Fib": 30}


def macros(kcal):
    """Sample macro split for a given kcal (25 % protein, 45 % carbs, 30 % fat)."""
    return {"P": round(kcal * 0.25 / 4), "C": round(kcal * 0.45 / 4), "F": round(kcal * 0.30 / 9), "Fib": round(kcal / 75)}


def split_bar(m, h=3):
    total = m["P"] * 4 + m["C"] * 4 + m["F"] * 9 or 1
    seg = lambda v, c: f'<span style="flex-grow: {v}; flex-basis: 0; height: {h}px; background: {c}"></span>'
    return f'<div style="display: flex; gap: 1px; border-radius: {h}px; overflow: hidden">{seg(m["P"] * 4, "%%PROT%%")}{seg(m["C"] * 4, "%%CARB%%")}{seg(m["F"] * 9, "%%FAT%%")}</div>'


def mline(m, fib=False):
    f = f' · Fib {m["Fib"]}' if fib else ""
    return f'P {m["P"]} · C {m["C"]} · F {m["F"]}{f}'
SQ = "'DM Sans', sans-serif"


def cell(items, key, drop=False, selected=False):
    if items is None:
        if drop:
            return f'<div style="height: 84px; border-radius: 10px; border: 1.5px dashed %%NUTRI%%; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 11px; font-weight: 600">{ic("plus", 14)}Drop to add</div>'
        return '<div style="height: 84px; border-radius: 10px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; display: flex; align-items: center; justify-content: center; font-size: 11px">Empty</div>'
    kcal = sum(i[2] for i in items)
    ring = "border: 2px solid %%INK%%; box-shadow: 0 4px 14px rgba(0,0,0,0.12);" if selected else "border: 1px solid %%LINE%%;"
    extra = f" +{len(items) - 2}" if len(items) > 2 else ""
    more = f'<span style="font-size: 11px; color: %%INK2%%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">+ {items[1][0]}{extra}</span>' if len(items) > 1 else ""
    note = f'<span title="Has a note" style="position: absolute; top: 7px; right: 7px; display: flex; color: %%NUTRI_INK%%">{ic("note", 12)}</span>' if key in MEAL_NOTES else ""
    count = f" · {len(items)}" if len(items) > 1 else ""
    m = macros(kcal)
    return (f'<a href="#" style="position: relative; height: 84px; box-sizing: border-box; border-radius: 10px; {ring} background: %%SURFACE%%; padding: 8px; display: flex; flex-direction: column; gap: 2px; color: %%INK%%; text-decoration: none">{note}'
            f'<span style="font-size: 12px; font-weight: 600; line-height: 1.25; padding-right: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{items[0][0]}</span>{more}'
            f'<span style="margin-top: auto; font-size: 11px; font-weight: 600; color: %%INK%%">{kcal} kcal<span style="font-weight: 400; color: %%MUTED%%">{count and " · " + str(len(items)) + " items"}</span></span>'
            f'{split_bar(m)}</a>')


def week_grid(selected=None, drop=None):
    cols = "84px repeat(7, minmax(0, 1fr))"
    head = '<span></span>'
    for i, d in enumerate(DAYS):
        has = i in DAY_NOTES
        icol = "%%NUTRI_INK%%" if has else "%%MUTED%%"
        ibg = "background: %%NUTRI_SOFT%%;" if has else "opacity: 0.55;"
        label = "Day note" if has else f"Add note for {d}"
        head += (f'<div style="display: flex; align-items: center; justify-content: center; gap: 6px"><span style="font-size: 12px; font-weight: 600; color: %%INK2%%">{d}</span>'
                 f'<button aria-label="{label}" title="{DAY_NOTES.get(i, label)}" style="width: 22px; height: 22px; border-radius: 6px; border: none; {ibg} color: {icol}; display: flex; align-items: center; justify-content: center; padding: 0">{ic("note", 12)}</button></div>')
    body = ""
    for row, meals in ROWS.items():
        body += f'<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; align-self: center">{MEAL_TYPE.get(row, row)}</span>'
        for i, m in enumerate(meals):
            body += nutri_cell(m, row) if NUTRI_MODE else cell(m, (row, i), drop == (row, i), selected == (row, i))
    totals = '<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; align-self: center">Day total</span>'
    for i in range(7):
        kc = sum(sum(x[2] for x in (ROWS[r][i] or [])) for r in ROWS)
        m = macros(kc)
        off = abs(kc - TARGET) / TARGET > 0.10
        col = "%%TRAIN%%" if off else "%%NUTRI%%"
        tcol = "%%TRAIN%%" if off else "%%INK%%"
        totals += (f'<div style="padding: 8px; border-radius: 10px; background: %%SURFACE%%; border: 1px solid %%LINE%%; display: flex; flex-direction: column; gap: 4px">'
                   f'<span style="font-size: 12px; font-weight: 700; color: {tcol}">{kc:,} <span style="font-weight: 400; color: %%MUTED%%">kcal</span></span>'
                   f'<div style="height: 4px; border-radius: 2px; background: %%LINE%%"><div style="width: {min(100, round(kc / TARGET * 100))}%; height: 4px; border-radius: 2px; background: {col}"></div></div>'
                   f'{split_bar(m)}<span style="font-size: 10px; line-height: 1.35; color: %%MUTED%%">P {m["P"]} · C {m["C"]} · F {m["F"]}<br>Fib {m["Fib"]} g</span></div>')
    return f'<div style="display: grid; grid-template-columns: {cols}; gap: 8px; align-items: stretch">{head}{totals}{body}</div>'


LIB = [(n, f"{k} kcal · " + mline(macros(k)), c) for n, k, c in [
    ("Chicken rice bowl", 640, "#C9D9A8"), ("Salmon, potatoes, greens", 610, "#F2C9B1"), ("Oat bowl with berries", 420, "#D8C8E6"),
    ("Turkey wrap", 520, "#E9D9C7"), ("Lentil curry", 560, "#E7B48F"), ("Greek yogurt, honey", 180, "#F1F1EC"),
    ("Tuna salad", 430, "#BFD3D8"), ("Beef stir-fry", 590, "#D7A68E"), ("Tofu noodle bowl", 540, "#E3D6B9")]]


def lib_card(n, s, c):
    return (f'<div style="display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 6px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: grab">'
            f'<span style="display: flex; color: %%MUTED%%">{ic("grip", 14)}</span><span style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; background: {c}"></span>'
            f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{n}</span><span style="font-size: 11px; color: %%MUTED%%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{s}</span></span>'
            f'<button aria-label="Add {n}" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("plus", 14)}</button></div>')


def lib_tab(x, on):
    st = "background: %%INK%%; color: %%SURFACE%%; border: none" if on else "background: %%TRAY_CARD%%; color: %%INK2%%; border: 1px solid %%LINE%%"
    return f'<button style="height: 32px; padding: 0 14px; border-radius: 16px; {st}; font: 600 13px {SQ}">{x}</button>'


def library(adding=None):
    cards = "".join(lib_card(*x) for x in LIB)
    if adding:
        hint = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; font-weight: 600">'
                f'<span style="width: 7px; height: 7px; border-radius: 4px; background: %%MARKER%%"></span>+ adds to {adding}'
                f'<button aria-label="Stop adding to {adding}" style="margin-left: auto; width: 24px; height: 24px; border-radius: 12px; border: none; background: rgba(127,127,127,0.25); color: inherit; display: flex; align-items: center; justify-content: center">{ic("x", 12)}</button></div>')
    else:
        hint = '<div style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">Drag onto a meal, or select a meal and press +. A meal can hold several recipes and ingredients.</div>'
    filt = f'<button aria-label="Filters" style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("sliders", 16)}</button>'
    return (f'<aside aria-label="Library" style="position: relative; z-index: 1; width: 320px; flex-shrink: 0; background: %%TRAY%%; border-right: 2px solid %%TRAY_EDGE%%; box-shadow: 6px 0 24px rgba(0,0,0,0.07); padding: 18px 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; overflow: hidden">'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: %%INK2%%">{ic("book", 14)}LIBRARY</span><span style="font-size: 12px; color: %%MUTED%%">· 48 recipes · 184 ingredients</span>'
            f'<button aria-label="Collapse library" title="Collapse library" style="margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("collapse", 14)}</button></div>'
            f'<div style="display: flex; gap: 6px">{lib_tab("Recipes", True)}{lib_tab("Ingredients", False)}</div>'
            f'<div style="display: flex; gap: 8px">{search("Search recipes…", 240).replace("background: %%SURFACE%%", "background: %%TRAY_CARD%%")}{filt}</div>{hint}'
            f'<div style="display: flex; flex-direction: column; gap: 7px">{cards}</div></aside>')


def rail(d):
    items = [("Clients", "users"), ("Inbox", "chat"), ("Recipes", "book"), ("Ingredients", "leaf"), ("Plan templates", "calendar"), ("Forms", "form"), ("Metrics", "bars")]
    out = ""
    for label, icon in items:
        on = label == "Plan templates"
        marker = '<span style="position: absolute; left: -12px; top: 10px; bottom: 10px; width: 3px; border-radius: 2px; background: %%MARKER%%"></span>' if on else ""
        bg = "%%NAV_ACTIVE%%" if on else "transparent"
        col = "%%NAV_TEXT%%" if on else "%%NAV_MUTED%%"
        out += f'<a href="#" aria-label="{label}" title="{label}" style="position: relative; width: 40px; height: 40px; border-radius: 10px; background: {bg}; color: {col}; display: flex; align-items: center; justify-content: center">{marker}{ic(icon, 18)}</a>'
    return (f'<nav aria-label="Main navigation, collapsed" style="width: 64px; flex-shrink: 0; background: %%NAV_BG%%; padding: 18px 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6px">'
            f'<button aria-label="Expand navigation" style="width: 40px; height: 40px; border-radius: 10px; border: none; background: transparent; color: %%NAV_TEXT%%; display: flex; align-items: center; justify-content: center; margin-bottom: 14px">{ic("panel", 18)}</button>{out}'
            f'<span style="margin-top: auto; width: 34px; height: 34px; border-radius: 17px; background: %%NAV_ACTIVE%%; color: %%NAV_TEXT%%; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center">MK</span></nav>')


def week_summary():
    days = [sum(sum(x[2] for x in (ROWS[r][i] or [])) for r in ROWS) for i in range(7)]
    avg = round(sum(days) / 7)
    m = macros(avg)
    dot = lambda c: f'<span style="width: 6px; height: 6px; border-radius: 3px; background: {c}"></span>'
    item = lambda c, txt: f'<span style="display: inline-flex; align-items: center; gap: 5px">{dot(c)}{txt}</span>'
    return (f'<div style="display: flex; align-items: center; gap: 14px; height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; font-size: 12px; color: %%INK2%%">'
            f'<span style="font-weight: 700; color: %%INK%%">Avg per day</span>'
            + item("%%NUTRI%%", '<b style="color: %%INK%%">' + f"{avg:,}" + "</b> / " + f"{TARGET:,}" + " kcal")
            + item("%%PROT%%", "P " + str(m["P"])) + item("%%CARB%%", "C " + str(m["C"])) + item("%%FAT%%", "F " + str(m["F"])) + item("%%FIB%%", "Fib " + str(m["Fib"]) + " g") +
            f'<span style="color: %%MUTED%%">· week total {sum(days):,} kcal</span>'
            f'<button style="margin-left: auto; height: 26px; padding: 0 8px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; font: 500 12px {SQ}; display: flex; align-items: center; gap: 4px">Details{ic("chevdown", 13)}</button></div>')


def week_strip():
    def arrow(icon, label):
        return f'<button aria-label="{label}" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic(icon, 15)}</button>'
    weeks = ""
    for w in range(2, 10):
        st = "background: %%INK%%; color: %%SURFACE%%" if w == 5 else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%"
        weeks += f'<a href="#" style="flex-shrink: 0; height: 32px; padding: 0 14px; border-radius: 16px; {st}; text-decoration: none; font-size: 13px; font-weight: 600; display: flex; align-items: center; box-sizing: border-box">Week {w}</a>'
    fades = ('<span style="position: absolute; left: 0; top: 0; bottom: 0; width: 44px; background: linear-gradient(90deg, %%GROUND%%, transparent)"></span>'
             '<span style="position: absolute; right: 0; top: 0; bottom: 0; width: 44px; background: linear-gradient(270deg, %%GROUND%%, transparent)"></span>')
    add = f'<button aria-label="Add week" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 16px; border: 1px dashed %%LINE%%; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("plus", 14)}</button>'
    return (f'<div style="display: flex; align-items: center; gap: 8px">{arrow("back", "Earlier weeks")}'
            f'<div style="position: relative; width: 600px; overflow: hidden"><div style="display: flex; gap: 8px; margin-left: -44px">{weeks}</div>{fades}</div>'
            f'{arrow("chevron", "Later weeks")}{add}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Week 5 of 12</span></div>')


def panel_item(kind, n, a, u, k, thumb):
    return (f'<div style="display: grid; grid-template-columns: 30px minmax(0, 1fr) 74px 62px 24px; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid %%LINE%%">'
            f'<span style="width: 30px; height: 30px; border-radius: 8px; background: {thumb}"></span>'
            f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{n}</span><span style="font-size: 10.5px; color: %%MUTED%%; white-space: nowrap">{kind} · {mline(macros(k), True)}</span></span>'
            f'<span style="height: 30px; border-radius: 8px; border: 1px solid %%LINE%%; display: flex; align-items: center; justify-content: center; gap: 3px; font-size: 13px; font-weight: 600">{a}<span style="font-weight: 400; color: %%MUTED%%; font-size: 11px">{u}</span></span>'
            f'<span style="font-size: 12px; color: %%MUTED%%; text-align: right">{k} kcal</span>'
            f'<button aria-label="Remove {n}" style="width: 24px; height: 24px; border-radius: 12px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("x", 13)}</button></div>')


def panel_day(x, on):
    st = "background: %%INK%%; color: %%SURFACE%%" if on else "border: 1px solid %%LINE%%; color: %%INK2%%"
    return f'<span style="width: 30px; height: 30px; border-radius: 8px; {st}; box-sizing: border-box; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center">{x}</span>'


def meal_panel():
    items = (panel_item("Recipe", "Chicken rice bowl", "1", "portion", 640, "#C9D9A8")
             + panel_item("Ingredient", "Apple", "150", "g", 80, "#E8C7A8")
             + panel_item("Ingredient", "Greek yogurt 0 %", "100", "g", 100, "#F1F1EC"))
    days = "".join(panel_day(x, on) for x, on in [("M", False), ("T", False), ("W", True), ("T", True), ("F", False), ("S", False), ("S", False)])
    close = f'<button aria-label="Close" style="margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("x", 16)}</button>'
    return (f'<div role="dialog" aria-label="Tuesday lunch" style="position: absolute; left: 236px; top: 300px; width: 450px; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 20px 50px rgba(0,0,0,0.22); padding: 16px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center"><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 12px; color: %%MUTED%%">Tue · week 5</span><span style="{DISP}; font-size: 17px; font-weight: 600">Lunch · 820 kcal</span></span>{close}</div>'
            f'<div>{items}</div>'
            f'<div style="height: 40px; border-radius: 10px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px">{ic("plus", 13)}Drag more recipes or ingredients here, or press + in the library</div>'
            f'<div style="display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 12px; color: %%INK2%%"><span style="font-weight: 600; color: %%INK%%">820 kcal</span><span>{mline(macros(820), True)} g</span><span style="margin-left: auto; width: 120px">{split_bar(macros(820), 4)}</span></div>'
            f'<label style="display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: %%MUTED%%">Note for the client<span style="min-height: 44px; padding: 8px 10px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; background: %%GROUND%%; font-size: 13px; font-weight: 400; line-height: 1.4; color: %%INK%%">Cook the rice the night before — it saves 15 minutes.</span></label>'
            f'<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; font-weight: 600; color: %%MUTED%%">Copy this meal to</span><div style="display: flex; gap: 6px">{days}<span style="margin-left: auto">{btn("Copy", "outline", "copy", 30)}</span></div></div>'
            f'<a href="#" style="font-size: 13px; font-weight: 600; color: %%NUTRI_INK%%; text-decoration: none">Save as meal template</a></div>')


PATHS.setdefault("collapse", '<path d="M15 6l-6 6 6 6"></path><path d="M20 4v16"></path>')
PATHS.setdefault("expand", '<path d="M9 6l6 6-6 6"></path><path d="M4 4v16"></path>')
MEAL_SHARE = {"Breakfast": 0.25, "Snack": 0.10, "Lunch": 0.35, "Dinner": 0.30}


def nutri_cell(items, row):
    if items is None:
        return '<div style="height: 84px; border-radius: 10px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; display: flex; align-items: center; justify-content: center; font-size: 11px">—</div>'
    kcal = sum(i[2] for i in items)
    m = macros(kcal)
    target = TARGET * MEAL_SHARE[row]
    dev = (kcal - target) / target
    if dev > 0.15:
        bg, fg, tag = "%%TRAIN_SOFT%%", "%%TRAIN%%", f"+{round(dev * 100)} %"
    elif dev < -0.15:
        bg, fg, tag = "%%GROUND%%", "%%MUTED%%", f"{round(dev * 100)} %"
    else:
        bg, fg, tag = "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "on target"
    return (f'<div style="height: 84px; box-sizing: border-box; border-radius: 10px; background: {bg}; padding: 8px; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="display: flex; align-items: baseline; gap: 4px"><span style="{DISP}; font-size: 17px; font-weight: 600; color: %%INK%%">{kcal}</span><span style="font-size: 10px; color: %%MUTED%%">kcal</span><span style="margin-left: auto; font-size: 10px; font-weight: 700; color: {fg}">{tag}</span></span>'
            f'<span style="font-size: 11px; color: %%INK2%%">P {m["P"]} · C {m["C"]} · F {m["F"]}</span>'
            f'<span style="font-size: 11px; color: %%MUTED%%">Fib {m["Fib"]} g</span><span style="margin-top: auto">{split_bar(m)}</span></div>')


def view_toggle(mode):
    def b(label, on):
        st = "background: %%SURFACE%%; color: %%INK%%; box-shadow: 0 1px 3px rgba(0,0,0,0.12); font-weight: 600" if on else "background: transparent; color: %%MUTED%%; font-weight: 500"
        return f'<button aria-pressed="{"true" if on else "false"}" style="height: 30px; padding: 0 14px; border-radius: 8px; border: none; {st}; font-family: {SQ}; font-size: 13px">{label}</button>'
    return f'<div role="group" aria-label="View" style="display: flex; padding: 3px; border-radius: 10px; background: %%LINE%%">{b("Meals", mode == "meals")}{b("Nutrition", mode == "nutrition")}</div>'


def library_collapsed():
    return (f'<button aria-label="Open library" title="Open library" style="position: relative; z-index: 1; width: 52px; flex-shrink: 0; background: %%TRAY%%; border: none; border-right: 2px solid %%TRAY_EDGE%%; box-shadow: 6px 0 24px rgba(0,0,0,0.07); padding: 16px 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 14px; cursor: pointer; font-family: {SQ}">'
            f'<span style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("expand", 16)}</span>'
            f'<span style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: %%INK2%%">LIBRARY</span></button>')


def nutrition_legend():
    item = lambda bg, label: f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 12px; height: 12px; border-radius: 3px; background: {bg}; border: 1px solid %%LINE%%"></span>{label}</span>'
    return (f'<div style="display: flex; gap: 16px; font-size: 12px; color: %%MUTED%%">{item("%%NUTRI_SOFT%%", "Within 15 % of the meal’s share")}{item("%%TRAIN_SOFT%%", "Over")}{item("%%GROUND%%", "Under")}'
            f'<span style="margin-left: auto">Meal shares: breakfast 25 % · snack 10 % · lunch 35 % · dinner 30 % of the day</span></div>')


def editor_main(panel=False, mode="meals"):
    global NUTRI_MODE
    NUTRI_MODE = mode == "nutrition"
    meals = mode == "meals"
    ghost = "" if (panel or not meals) else ('<div style="position: absolute; left: 470px; top: 512px; width: 210px; transform: rotate(-3deg); display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 14px 30px rgba(0,0,0,0.22); pointer-events: none">'
                                             '<span style="width: 36px; height: 36px; border-radius: 10px; background: #F2C9B1"></span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 13px; font-weight: 600">Salmon, potatoes</span><span style="font-size: 11px; color: %%MUTED%%">610 kcal</span></span></div>')
    grid = week_grid(selected=("Lunch", 1) if panel else None, drop=("Lunch", 3) if (meals and not panel) else None)
    mm = macros(610)
    hover = "" if (panel or not meals) else (f'<div role="tooltip" style="position: absolute; left: 116px; top: 646px; padding: 8px 10px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2)"><b>Salmon, potatoes · 610 kcal</b><br>{mline(mm, True)} g</div>'
                                             f'<div role="tooltip" style="position: absolute; left: 330px; top: 196px; width: 170px; padding: 8px 10px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; line-height: 1.4; box-shadow: 0 8px 20px rgba(0,0,0,0.2)">Rest day — lighter carbs</div>')
    undo = f'<button aria-label="Undo" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("undo", 16)}</button>'
    legend = "" if meals else nutrition_legend()
    out = (f'<div style="position: relative; flex-grow: 1; min-width: 0; padding: 22px 24px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">'
           f'<div style="display: flex; align-items: center; gap: 12px"><span style="font-size: 13px; color: %%MUTED%%">Plan templates /</span><h1 style="margin: 0; {DISP}; font-size: 24px; font-weight: 600">Lean cut — 12 weeks</h1><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: %%MUTED%%">{ic("check", 13)}Saved</span>'
           f'<div style="margin-left: auto; display: flex; align-items: center; gap: 8px">{view_toggle(mode)}{undo}{btn("Save", "primary", "check")}</div></div>'
           f'{week_strip()}'
           f'{week_summary()}'
           f'{grid}{legend}{ghost}{hover}{meal_panel() if panel else ""}</div>')
    NUTRI_MODE = False
    return out


def editor(d, t, panel=False, mode="meals"):
    lib = library_collapsed() if mode == "nutrition" else library("Tue · Lunch" if panel else None)
    body = (f'<div style="position: relative; width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">'
            f'{rail(d)}{lib}{editor_main(panel, mode)}</div>')
    return page(f"Template editor {d}", W, H, body, t)


# ---- layout v3: bigger cards, scrolling meal area, pinned header/footer, week/day views
ROWS["Evening snack"] = [[I("Cottage cheese", 120)], None, [I("Cottage cheese", 120), I("Walnuts", 90)], [R("Protein shake", 160)], None, None, [I("Cottage cheese", 120)]]
MEAL_SHARE = {"Breakfast": 0.25, "Snack": 0.10, "Lunch": 0.30, "Dinner": 0.28, "Evening snack": 0.07}
CELL_H = 120


def cell(items, key, drop=False, selected=False):
    if items is None:
        if drop:
            return f'<div style="height: {CELL_H}px; border-radius: 12px; border: 1.5px dashed %%NUTRI%%; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 600">{ic("plus", 16)}Drop to add</div>'
        return f'<div style="height: {CELL_H}px; border-radius: 12px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; display: flex; align-items: center; justify-content: center; font-size: 12px">Empty</div>'
    kcal = sum(i[2] for i in items)
    m = macros(kcal)
    ring = "border: 2px solid %%INK%%; box-shadow: 0 4px 14px rgba(0,0,0,0.12);" if selected else "border: 1px solid %%LINE%%;"
    note = f'<span title="Has a note" style="position: absolute; top: 9px; right: 9px; display: flex; color: %%NUTRI_INK%%">{ic("note", 13)}</span>' if key in MEAL_NOTES else ""
    lines = ""
    for j, it in enumerate(items[:3]):
        weight = "600" if j == 0 else "400"
        col = "%%INK%%" if j == 0 else "%%INK2%%"
        pre = "" if j == 0 else "+ "
        lines += f'<span style="font-size: {13 if j == 0 else 12}px; font-weight: {weight}; color: {col}; line-height: 1.3; padding-right: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{pre}{it[0]}</span>'
    count = f' · {len(items)} items' if len(items) > 1 else ""
    return (f'<a href="#" style="position: relative; height: {CELL_H}px; box-sizing: border-box; border-radius: 12px; {ring} background: %%SURFACE%%; padding: 10px; display: flex; flex-direction: column; gap: 3px; color: %%INK%%; text-decoration: none">{note}{lines}'
            f'<span style="margin-top: auto; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{kcal} kcal<span style="font-weight: 400; color: %%MUTED%%">{count}</span></span>{split_bar(m, 4)}</a>')


def nutri_cell(items, row):
    if items is None:
        return f'<div style="height: {CELL_H}px; border-radius: 12px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; display: flex; align-items: center; justify-content: center; font-size: 12px">—</div>'
    kcal = sum(i[2] for i in items)
    m = macros(kcal)
    target = TARGET * MEAL_SHARE[row]
    dev = (kcal - target) / target
    if dev > 0.15:
        bg, fg, tag = "%%TRAIN_SOFT%%", "%%TRAIN%%", f"+{round(dev * 100)} %"
    elif dev < -0.15:
        bg, fg, tag = "%%GROUND%%", "%%MUTED%%", f"{round(dev * 100)} %"
    else:
        bg, fg, tag = "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "on target"
    return (f'<div style="height: {CELL_H}px; box-sizing: border-box; border-radius: 12px; background: {bg}; border: 1px solid %%LINE%%; padding: 10px; display: flex; flex-direction: column; gap: 3px">'
            f'<span style="display: flex; align-items: baseline; gap: 4px"><span style="{DISP}; font-size: 20px; font-weight: 600; color: %%INK%%">{kcal}</span><span style="font-size: 11px; color: %%MUTED%%">kcal</span></span>'
            f'<span style="font-size: 11px; font-weight: 700; color: {fg}">{tag}</span>'
            f'<span style="font-size: 12px; color: %%INK2%%">P {m["P"]} · C {m["C"]} · F {m["F"]}</span><span style="font-size: 11px; color: %%MUTED%%">Fib {m["Fib"]} g</span>'
            f'<span style="margin-top: auto">{split_bar(m, 4)}</span></div>')


COLS = "96px repeat(7, minmax(0, 1fr))"


def week_head():
    head = '<span></span>'
    for i, d in enumerate(DAYS):
        has = i in DAY_NOTES
        icol = "%%NUTRI_INK%%" if has else "%%MUTED%%"
        ibg = "background: %%NUTRI_SOFT%%;" if has else "opacity: 0.55;"
        label = "Day note" if has else f"Add note for {d}"
        head += (f'<div style="display: flex; align-items: center; justify-content: center; gap: 6px"><span style="font-size: 12px; font-weight: 600; color: %%INK2%%">{d}</span>'
                 f'<button aria-label="{label}" title="{DAY_NOTES.get(i, label)}" style="width: 22px; height: 22px; border-radius: 6px; border: none; {ibg} color: {icol}; display: flex; align-items: center; justify-content: center; padding: 0">{ic("note", 12)}</button></div>')
    totals = '<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; align-self: center">Day total</span>'
    for i in range(7):
        kc = sum(sum(x[2] for x in (ROWS[r][i] or [])) for r in ROWS)
        m = macros(kc)
        off = abs(kc - TARGET) / TARGET > 0.10
        col = "%%TRAIN%%" if off else "%%NUTRI%%"
        tcol = "%%TRAIN%%" if off else "%%INK%%"
        totals += (f'<div style="padding: 8px; border-radius: 10px; background: %%SURFACE%%; border: 1px solid %%LINE%%; display: flex; flex-direction: column; gap: 4px">'
                   f'<span style="font-size: 12px; font-weight: 700; color: {tcol}">{kc:,} <span style="font-weight: 400; color: %%MUTED%%">kcal</span></span>'
                   f'<div style="height: 4px; border-radius: 2px; background: %%LINE%%"><div style="width: {min(100, round(kc / TARGET * 100))}%; height: 4px; border-radius: 2px; background: {col}"></div></div>'
                   f'{split_bar(m)}<span style="font-size: 10px; line-height: 1.35; color: %%MUTED%%">P {m["P"]} · C {m["C"]} · F {m["F"]} · Fib {m["Fib"]}</span></div>')
    return f'<div style="display: grid; grid-template-columns: {COLS}; gap: 8px; padding-right: 14px">{head}{totals}</div>'


def week_rows(selected=None, drop=None):
    body = ""
    for row, meals in ROWS.items():
        body += f'<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; align-self: center">{MEAL_TYPE.get(row, row)}</span>'
        for i, m in enumerate(meals):
            body += nutri_cell(m, row) if NUTRI_MODE else cell(m, (row, i), drop == (row, i), selected == (row, i))
    return f'<div style="display: grid; grid-template-columns: {COLS}; gap: 8px">{body}</div>'


def scroll_area(inner, thumb_top=0, thumb_h=70):
    bar = (f'<div aria-hidden="true" style="position: absolute; top: 0; right: 0; bottom: 0; width: 6px; border-radius: 3px; background: %%LINE%%">'
           f'<div style="position: absolute; left: 0; right: 0; top: {thumb_top}%; height: {thumb_h}%; border-radius: 3px; background: %%MUTED%%; opacity: 0.6"></div></div>')
    return f'<div style="position: relative; flex-grow: 1; min-height: 0; overflow: hidden"><div style="padding-right: 14px">{inner}</div>{bar}</div>'


def pill_toggle(options, active, label):
    def b(x):
        on = x == active
        st = "background: %%SURFACE%%; color: %%INK%%; box-shadow: 0 1px 3px rgba(0,0,0,0.12); font-weight: 600" if on else "background: transparent; color: %%MUTED%%; font-weight: 500"
        return f'<button aria-pressed="{"true" if on else "false"}" style="height: 30px; padding: 0 14px; border-radius: 8px; border: none; {st}; font-family: {SQ}; font-size: 13px">{x}</button>'
    return f'<div role="group" aria-label="{label}" style="display: flex; padding: 3px; border-radius: 10px; background: %%LINE%%">{"".join(b(x) for x in options)}</div>'


def footer_legend():
    item = lambda bg, label: f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 12px; height: 12px; border-radius: 3px; background: {bg}; border: 1px solid %%LINE%%"></span>{label}</span>'
    return (f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 16px; height: 44px; margin: 0 -24px -22px; padding: 0 24px; border-top: 1px solid %%LINE%%; background: %%GROUND%%; font-size: 12px; color: %%MUTED%%">'
            f'{item("%%NUTRI_SOFT%%", "Within 15 % of the meal’s share")}{item("%%TRAIN_SOFT%%", "Over")}{item("%%GROUND%%", "Under")}'
            f'<span style="margin-left: auto">Meal shares: breakfast 25 % · snack 10 % · lunch 30 % · dinner 28 % · 2nd snack 7 % of the day</span></div>')


def title_row(mode, view):
    undo = f'<button aria-label="Undo" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("undo", 16)}</button>'
    return (f'<div style="flex-shrink: 0; margin: -22px -24px 2px; padding: 14px 24px; background: %%SURFACE%%; border-bottom: 1px solid %%LINE%%; display: flex; align-items: center; gap: 12px"><span style="font-size: 13px; color: %%MUTED%%">Plan templates /</span><h1 style="margin: 0; {DISP}; font-size: 24px; font-weight: 600">Lean cut — 12 weeks</h1><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: %%MUTED%%">{ic("check", 13)}Saved</span>'
            f'<div style="margin-left: auto; display: flex; align-items: center; gap: 8px">{pill_toggle(["Week", "Day"], view.capitalize(), "Range")}{pill_toggle(["Meals", "Nutrition"], mode.capitalize(), "View")}{undo}{btn("Save", "primary", "check")}</div></div>')


# ---- day view
def day_nav(sel=1, week=5, weeks=12):
    def arrow(icon, label):
        return f'<button aria-label="{label}" title="{label}" style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 20px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic(icon, 18)}</button>'
    dots = "".join(f'<span style="width: {16 if i == week - 1 else 6}px; height: 6px; border-radius: 3px; background: {"%%INK%%" if i == week - 1 else "%%LINE%%"}"></span>' for i in range(weeks))
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    days = ""
    for i in range(7):
        kc = sum(sum(x[2] for x in (ROWS[r][i] or [])) for r in ROWS)
        off = abs(kc - TARGET) / TARGET > 0.10
        on = i == sel
        st = "background: %%INK%%; color: %%SURFACE%%; border: 1px solid %%INK%%; font-weight: 700" if on else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%; font-weight: 600"
        dot = f'<span style="width: 6px; height: 6px; border-radius: 3px; background: {"%%TRAIN%%" if off else "%%NUTRI%%"}"></span>'
        days += (f'<a href="#" aria-label="{names[i]}, {kc} kcal{", has a note" if i in DAY_NOTES else ""}" aria-current="{"date" if on else "false"}" '
                 f'style="height: 40px; padding: 0 12px; box-sizing: border-box; border-radius: 20px; {st}; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px">{names[i][:3]}{dot}</a>')
    week_part = (f'<div style="display: flex; align-items: center; gap: 14px">{arrow("back", "Previous week")}'
                 f'<div style="display: flex; flex-direction: column; gap: 4px; min-width: 96px"><span style="{DISP}; font-size: 22px; font-weight: 600">Week {week}</span><span style="font-size: 12px; color: %%MUTED%%">of {weeks} weeks</span></div>'
                 f'{arrow("chevron", "Next week")}<span style="display: flex; gap: 4px; margin-left: 4px">{dots}</span></div>')
    legend = f'<span style="font-size: 11px; color: %%MUTED%%; display: flex; flex-direction: column; gap: 2px; text-align: right"><span>● on target</span><span style="color: %%TRAIN%%">● off target</span></span>'
    return (f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 16px">{week_part}'
            f'<nav aria-label="Days of week {week}" style="margin-left: auto; display: flex; align-items: center; gap: 6px">{days}</nav></div>')


def day_summary(i):
    kc = sum(sum(x[2] for x in (ROWS[r][i] or [])) for r in ROWS)
    m = macros(kc)
    def stat(label, v, unit, target, color):
        pct = min(100, round(v / target * 100))
        return (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 5px">'
                f'<span style="display: flex; align-items: baseline; gap: 6px; white-space: nowrap"><span style="align-self: center; width: 6px; height: 6px; border-radius: 3px; background: {color}"></span>'
                f'<span style="font-size: 12px; color: %%MUTED%%">{label}</span><span style="font-size: 13px; font-weight: 700">{v:,}</span><span style="font-size: 12px; color: %%MUTED%%">/ {target:,} {unit}</span></span>'
                f'<div style="height: 3px; border-radius: 2px; background: %%LINE%%"><div style="width: {pct}%; height: 3px; border-radius: 2px; background: {color}"></div></div></div>')
    note = (f'<button style="flex-shrink: 0; height: 28px; padding: 0 10px; border-radius: 8px; border: 1px dashed %%LINE%%; background: transparent; color: %%MUTED%%; font: 500 12px {SQ}; display: flex; align-items: center; gap: 6px">{ic("note", 13)}Add day note</button>')
    return (f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 22px; padding: 8px 14px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%">'
            f'{stat("kcal", kc, "", TARGET, "%%NUTRI%%")}{stat("Protein", m["P"], "g", TARGETS["P"], "%%PROT%%")}{stat("Carbs", m["C"], "g", TARGETS["C"], "%%CARB%%")}{stat("Fat", m["F"], "g", TARGETS["F"], "%%FAT%%")}{stat("Fiber", m["Fib"], "g", TARGETS["Fib"], "%%FIB%%")}{note}</div>')


THUMB = {"Greek yogurt bowl": "#F1F1EC", "Banana": "#F2E3A6", "Apple": "#E8C7A8", "Almonds": "#C99D77", "Chicken rice bowl": "#C9D9A8", "Greek yogurt": "#F1F1EC", "Beef stir-fry": "#D7A68E"}
AMOUNT = {"recipe": ("1", "portion"), "ingredient": ("150", "g")}


MEAL_TYPE = {"Evening snack": "Snack"}


def mtype(row):
    return MEAL_TYPE.get(row, row)


def day_icon_btn(icon, label, color="%%MUTED%%"):
    return f'<button aria-label="{label}" title="{label}" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: {color}; display: flex; align-items: center; justify-content: center">{ic(icon, 15)}</button>'


def day_meal(row, items, note=None, first=False):
    sep = "" if first else "border-top: 1px solid %%LINE%%;"
    grip = f'<span style="color: %%MUTED%%; display: flex; cursor: grab">{ic("grip", 14)}</span>'
    actions = f'<span style="margin-left: auto; display: flex; gap: 2px">{day_icon_btn("trash", f"Delete {mtype(row)} from Tuesday")}</span>'
    add_food = f'<a href="#" style="align-self: flex-start; margin-left: 46px; height: 26px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: %%MUTED%%; text-decoration: none">{ic("plus", 14)}Add food</a>'
    if items is None:
        return (f'<section style="{sep} padding: 14px 20px; display: flex; flex-direction: column; gap: 6px">'
                f'<div style="display: flex; align-items: center; gap: 10px">{grip}<span style="font-size: 15px; font-weight: 700">{mtype(row)}</span><span style="font-size: 12px; color: %%MUTED%%">nothing planned</span>{actions}</div>{note_field(None)}</section>')
    kcal = sum(i[2] for i in items)
    share = kcal / TARGET
    target = MEAL_SHARE[row]
    dev = (share - target) / target
    ok = abs(dev) <= 0.15
    pill_bg, pill_fg = ("%%NUTRI_SOFT%%", "%%NUTRI_INK%%") if ok else ("%%TRAIN_SOFT%%", "%%TRAIN%%")
    pill = f'<span title="Target {round(target * 100)} % of the day" style="height: 22px; padding: 0 8px; border-radius: 11px; background: {pill_bg}; color: {pill_fg}; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center">{round(share * 100)} % of day</span>'
    rows = ""
    for n, kind, k in items:
        a, u = AMOUNT[kind]
        rows += (f'<div style="display: grid; grid-template-columns: 34px 240px 104px 76px 120px minmax(0, 1fr) 28px; gap: 12px; align-items: center; padding: 3px 0">'
                 f'<span style="width: 34px; height: 34px; border-radius: 9px; background: {THUMB.get(n, "#E3D6B9")}"></span>'
                 f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{n}</span><span style="font-size: 11px; color: %%MUTED%%">{kind.capitalize()}</span></span>'
                 f'<span style="height: 32px; padding: 0 10px; box-sizing: border-box; border-radius: 8px; border: 1px solid %%LINE%%; display: flex; align-items: center; font-size: 13px; font-weight: 600">{a}<span style="margin-left: auto; font-weight: 400; font-size: 11px; color: %%MUTED%%">{u}</span></span>'
                 f'<span style="font-size: 13px; font-weight: 600; text-align: right">{k} kcal</span>'
                 f'<span title="{mline(macros(k), True)} g">{split_bar(macros(k), 4)}</span><span></span>'
                 f'<button aria-label="Remove {n}" style="width: 28px; height: 28px; border-radius: 14px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("x", 14)}</button></div>')
    note_html = note_field(note)
    return (f'<section style="{sep} padding: 10px 20px; display: flex; flex-direction: column; gap: 4px">'
            f'<div style="display: flex; align-items: center; gap: 10px">{grip}<span style="font-size: 15px; font-weight: 700">{mtype(row)}</span>'
            f'<span style="font-size: 14px; font-weight: 600">{kcal} kcal</span>{pill}{actions}</div>'
            f'<div style="margin-left: 24px; display: flex; flex-direction: column">{rows}</div>{note_html}</section>')


def note_field(note):
    txt = (f'<span style="color: %%INK%%">{note}</span>' if note else '<span style="color: %%MUTED%%">Note for the client — e.g. “Cook the rice the night before”</span>')
    return (f'<div style="margin-left: 24px; margin-bottom: 4px; min-height: 34px; box-sizing: border-box; padding: 7px 10px; border-radius: 9px; border: 1px solid %%LINE%%; background: %%GROUND%%; display: flex; align-items: center; gap: 8px; font-size: 13px">'
            f'<span style="display: flex; color: %%MUTED%%">{ic("note", 14)}</span>{txt}</div>')


def type_chip(x, on=False):
    st = "background: %%INK%%; color: %%SURFACE%%; border: 1px solid %%INK%%" if on else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%"
    return f'<button role="radio" aria-checked="{"true" if on else "false"}" style="height: 30px; padding: 0 12px; border-radius: 15px; {st}; font: 600 12px DM Sans, sans-serif; display: inline-flex; align-items: center; gap: 5px">{ic("check", 12) if on else ""}{x}</button>'


def new_meal_inline():
    return (f'<section style="border-top: 1px solid %%LINE%%; padding: 10px 20px; display: flex; flex-direction: column; gap: 6px; background: %%GROUND%%; box-shadow: inset 3px 0 0 %%INK%%">'
            f'<div style="display: flex; align-items: center; gap: 10px"><span style="color: %%MUTED%%; display: flex">{ic("grip", 14)}</span>'
            f'<span style="font-size: 13px; font-weight: 700">New meal — choose a type:</span>'
            f'<div role="radiogroup" aria-label="Meal type" style="display: flex; gap: 6px">{type_chip("Breakfast")}{type_chip("Snack", True)}{type_chip("Lunch")}{type_chip("Dinner")}</div>'
            f'<span style="margin-left: auto; font-size: 11px; color: %%MUTED%%">Highlight fades once you pick a type, add food or click away</span>'
            f'<span style="display: flex; gap: 2px">{day_icon_btn("trash", "Delete new meal")}</span></div>'
            f'{note_field(None)}</section>')


def insert_line():
    return ('<div style="position: relative; height: 0">'
            '<div style="position: absolute; left: 20px; right: 20px; top: -1px; height: 2px; background: %%MARKER%%"></div>'
            f'<a href="#" style="position: absolute; left: 50%; top: -13px; transform: translateX(-50%); height: 26px; padding: 0 12px; border-radius: 13px; background: %%MARKER%%; color: #FFFFFF; text-decoration: none; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 5px">{ic("plus", 13)}Insert meal here</a></div>')


def add_meal_bar():
    return (f'<div style="border-top: 1px solid %%LINE%%; padding: 12px 20px; display: flex; align-items: center; gap: 12px; background: %%GROUND%%">'
            f'<button style="height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; font: 700 13px DM Sans, sans-serif; display: flex; align-items: center; gap: 6px">{ic("plus", 15)}Add meal</button>'
            f'<span style="font-size: 12px; color: %%MUTED%%">Only Tuesday changes · hover between meals to insert one in between</span></div>')


def add_meal_drawer(position="after Snack"):
    chip = lambda x, on: (f'<button role="radio" aria-checked="{"true" if on else "false"}" style="flex-grow: 1; flex-basis: 0; height: 44px; border-radius: 12px; {"border: 2px solid %%INK%%; background: %%SURFACE%%; color: %%INK%%; font-weight: 700" if on else "border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; font-weight: 600"}; font-family: DM Sans, sans-serif; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px">{ic("check", 14) if on else ""}{x}</button>')
    return (f'<div style="position: absolute; inset: 0; z-index: 8; background: rgba(10,10,12,0.45)"></div>'
            f'<aside role="dialog" aria-label="Add meal" style="position: absolute; top: 0; right: 0; bottom: 0; z-index: 9; width: 460px; background: %%SURFACE%%; box-shadow: -12px 0 40px rgba(0,0,0,0.18); display: flex; flex-direction: column">'
            f'<div style="padding: 22px 24px; border-bottom: 1px solid %%LINE%%; display: flex; align-items: flex-start">'
            f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">Add meal</span><span style="font-size: 13px; color: %%MUTED%%">Tuesday · {position}</span></div>'
            f'<button aria-label="Close" style="margin-left: auto; width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("x", 18)}</button></div>'
            f'<div style="flex-grow: 1; padding: 22px 24px; display: flex; flex-direction: column; gap: 22px">'
            f'<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 600; color: %%INK2%%">Meal type <span style="color: %%DANGER%%">*</span></span>'
            f'<div role="radiogroup" aria-label="Meal type" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{chip("Breakfast", False)}{chip("Snack", True)}{chip("Lunch", False)}{chip("Dinner", False)}</div>'
            f'<span style="font-size: 12px; color: %%MUTED%%">Tuesday already has a Snack — a second one is fine.</span></div>'
            f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: %%INK2%%"><span>Note for the client <span style="font-weight: 400; color: %%MUTED%%">· optional</span></span>'
            f'<span style="min-height: 96px; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1.5px solid %%INK%%; font-size: 14px; font-weight: 400; line-height: 1.5; color: %%INK%%">Eat this before your afternoon training.<span style="display: inline-block; width: 1.5px; height: 16px; margin-left: 1px; vertical-align: -3px; background: %%INK%%"></span></span></label>'
            f'<div style="display: flex; gap: 8px; padding: 12px 14px; border-radius: 12px; background: %%GROUND%%; border: 1px solid %%LINE%%; font-size: 12px; line-height: 1.5; color: %%MUTED%%">{ic("info", 14)}<span>The meal is added empty. Fill it from the library on the left — drag a recipe or ingredient onto it.</span></div></div>'
            f'<div style="padding: 16px 24px; border-top: 1px solid %%LINE%%; display: flex; justify-content: flex-end; gap: 8px">{btn("Cancel", "outline", h=40)}{btn("Add meal", "primary", "plus", 40)}</div></aside>')


def day_view():
    i = 1
    names = list(ROWS)
    sections = ""
    for j, r in enumerate(names):
        sections += day_meal(r, ROWS[r][i], "Cook the rice the night before — it saves 15 minutes." if r == "Lunch" else None, first=(j == 0))
    sheet = f'<div style="border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">{sections}{add_meal_bar()}</div>'
    return f'{day_nav(i)}{day_summary(i)}{scroll_area(sheet, 0, 52)}'


def empty_week():
    chip = lambda x: f'<button style="height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; font: 600 13px {SQ}; display: inline-flex; align-items: center; gap: 6px">{ic("plus", 14)}{x}</button>'
    head = '<span></span>' + "".join(f'<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; text-align: center">{d}</span>' for d in DAYS)
    ghost_rows = "".join('<span></span>' + "".join('<div style="height: 64px; border-radius: 12px; border: 1.5px dashed %%LINE%%; opacity: 0.6"></div>' for _ in range(7)) for _ in range(2))
    panel = (f'<div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 640px; box-sizing: border-box; border-radius: 20px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 24px 60px rgba(0,0,0,0.14); padding: 28px 30px; display: flex; flex-direction: column; gap: 16px">'
             f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 44px; height: 44px; border-radius: 12px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; display: flex; align-items: center; justify-content: center">{ic("utensils", 22)}</span>'
             f'<div style="display: flex; flex-direction: column; gap: 3px"><span style="{DISP}; font-size: 22px; font-weight: 600">Which meals does a day have?</span><span style="font-size: 13px; color: %%MUTED%%">Each meal becomes a row of the week. Add a type twice for two snacks. You can reorder or remove them later.</span></div></div>'
             f'<button style="align-self: stretch; height: 52px; border-radius: 12px; border: 2px solid %%INK%%; background: %%SURFACE%%; color: %%INK%%; font: 600 14px {SQ}; display: flex; align-items: center; gap: 10px; padding: 0 16px">{ic("check", 16)}Breakfast · Snack · Lunch · Dinner<span style="margin-left: auto; font-size: 12px; font-weight: 500; color: %%MUTED%%">most common</span></button>'
             f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">OR ADD ONE BY ONE</span>'
             f'<div style="display: flex; flex-wrap: wrap; gap: 8px">{chip("Breakfast")}{chip("Snack")}{chip("Lunch")}{chip("Dinner")}</div>'
             f'<div style="display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid %%LINE%%; font-size: 13px; color: %%MUTED%%">{ic("copy", 15)}<span>Or <a href="#" style="font-weight: 700; color: %%INK%%">copy the meals from another template</a></span></div></div>')
    return (f'<div style="position: relative; flex-grow: 1; min-height: 0">'
            f'<div style="display: grid; grid-template-columns: 96px repeat(7, minmax(0, 1fr)); gap: 8px; opacity: 0.9">{head}{ghost_rows}</div>{panel}</div>')


def editor_main(panel=False, mode="meals", view="week", empty=False):
    global NUTRI_MODE
    NUTRI_MODE = mode == "nutrition"
    meals = mode == "meals"
    plain = meals and not panel and view == "week"
    ghost = "" if not plain else ('<div style="position: absolute; left: 500px; top: 612px; width: 210px; transform: rotate(-3deg); display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 14px 30px rgba(0,0,0,0.22); pointer-events: none">'
                                  '<span style="width: 36px; height: 36px; border-radius: 10px; background: #F2C9B1"></span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 13px; font-weight: 600">Salmon, potatoes</span><span style="font-size: 11px; color: %%MUTED%%">610 kcal</span></span></div>')
    mm = macros(610)
    hover = "" if not plain else (f'<div role="tooltip" style="position: absolute; left: 130px; top: 800px; padding: 8px 10px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2)"><b>Salmon, potatoes · 610 kcal</b><br>{mline(mm, True)} g</div>'
                                  f'<div role="tooltip" style="position: absolute; left: 340px; top: 192px; width: 170px; padding: 8px 10px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; line-height: 1.4; box-shadow: 0 8px 20px rgba(0,0,0,0.2)">Rest day — lighter carbs</div>')
    if empty:
        ghost = hover = ""
        content = f'{week_strip()}{empty_week()}'
    elif view == "day":
        content = day_view()
    else:
        rows = week_rows(selected=("Lunch", 1) if panel else None, drop=("Lunch", 3) if plain else None)
        content = f'{week_strip()}{week_summary()}{week_head()}{scroll_area(rows, 0, 72)}{"" if meals else footer_legend()}'
    panel_html = meal_panel().replace("left: 236px; top: 300px;", "left: 250px; top: 300px;") if panel else ""
    out = (f'<div style="position: relative; flex-grow: 1; min-width: 0; height: {H}px; padding: 22px 24px; box-sizing: border-box; background: %%GLOW%%; display: flex; flex-direction: column; gap: 14px">'
           f'{title_row(mode, view)}{content}{ghost}{hover}{panel_html}</div>')
    NUTRI_MODE = False
    return out


def editor(d, t, panel=False, mode="meals", view="week", empty=False, add_meal=False):
    lib = library_collapsed() if mode == "nutrition" else library("Tue · Lunch" if panel else None)
    body = (f'<div style="position: relative; width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">'
            f'{rail(d)}{lib}{editor_main(panel, mode, view, empty)}{add_meal_drawer() if add_meal else ""}</div>')
    return page(f"Template editor {d}", W, H, body, t)


for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = ""
    DARK_ON = t["DARK"]
    for name, fn in (("PageTemplates", templates_list), ("PageTemplateNew", new_template_drawer),
                     ("PageTemplateEditor", lambda d, t: editor(d, t)), ("PageTemplateMeal", lambda d, t: editor(d, t, True)),
                     ("PageTemplateNutrition", lambda d, t: editor(d, t, mode="nutrition")),
                     ("PageTemplateDay", lambda d, t: editor(d, t, view="day")),
                     ("PageTemplateEditorEmpty", lambda d, t: editor(d, t, empty=True)),
                     ("PageTemplateDayAddMeal", lambda d, t: editor(d, t, view="day", add_meal=True))):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(fn(d, t))
print("ok")
