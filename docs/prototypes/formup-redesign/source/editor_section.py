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
        body += f'<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; align-self: center">{row}</span>'
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


LIB = [(n, f"{k} kcal · " + mline(macros(k), True), c) for n, k, c in [
    ("Chicken rice bowl", 640, "#C9D9A8"), ("Salmon, potatoes, greens", 610, "#F2C9B1"), ("Oat bowl with berries", 420, "#D8C8E6"),
    ("Turkey wrap", 520, "#E9D9C7"), ("Lentil curry", 560, "#E7B48F"), ("Greek yogurt, honey", 180, "#F1F1EC"),
    ("Tuna salad", 430, "#BFD3D8"), ("Beef stir-fry", 590, "#D7A68E"), ("Tofu noodle bowl", 540, "#E3D6B9")]]


def lib_card(n, s, c):
    return (f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; cursor: grab">'
            f'<span style="display: flex; color: %%MUTED%%">{ic("grip", 14)}</span><span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: {c}"></span>'
            f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{n}</span><span style="font-size: 10.5px; color: %%MUTED%%; white-space: nowrap">{s}</span>{split_bar(macros(int(s.split(" ")[0])))}</span>'
            f'<button aria-label="Add {n}" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("plus", 14)}</button></div>')


def lib_tab(x, on):
    st = "background: %%INK%%; color: %%SURFACE%%; border: none" if on else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%"
    return f'<button style="height: 32px; padding: 0 14px; border-radius: 16px; {st}; font: 600 13px {SQ}">{x}</button>'


def library(adding=None):
    cards = "".join(lib_card(*x) for x in LIB)
    if adding:
        hint = f'<div style="padding: 9px 12px; border-radius: 10px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 12px; font-weight: 600">+ adds to {adding}</div>'
    else:
        hint = '<div style="font-size: 12px; line-height: 1.4; color: %%MUTED%%">Drag onto a meal, or select a meal and press +. A meal can hold several recipes and ingredients.</div>'
    filt = f'<button aria-label="Filters" style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("sliders", 16)}</button>'
    return (f'<aside aria-label="Library" style="width: 320px; flex-shrink: 0; background: %%GROUND%%; border-right: 1px solid %%LINE%%; padding: 18px 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; overflow: hidden">'
            f'<div style="display: flex; align-items: center; gap: 8px">{lib_tab("Recipes", True)}{lib_tab("Ingredients", False)}<button aria-label="Collapse library" title="Collapse library" style="margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("collapse", 14)}</button></div>'
            f'<div style="display: flex; gap: 8px">{search("Search recipes…", 240)}{filt}</div>{hint}'
            f'<div style="display: flex; flex-direction: column; gap: 8px">{cards}</div></aside>')


def rail(d):
    items = [("Clients", "users"), ("Inbox", "chat"), ("Recipes", "book"), ("Ingredients", "leaf"), ("Plan templates", "calendar")]
    out = ""
    for label, icon in items:
        on = label == "Plan templates"
        marker = '<span style="position: absolute; left: -12px; top: 10px; bottom: 10px; width: 3px; border-radius: 2px; background: %%MARKER%%"></span>' if on else ""
        bg = "%%SIDEBAR_ACTIVE%%" if on else "transparent"
        col = "%%SIDEBAR_TEXT%%" if on else "%%SIDEBAR_MUTED%%"
        out += f'<a href="#" aria-label="{label}" title="{label}" style="position: relative; width: 40px; height: 40px; border-radius: 10px; background: {bg}; color: {col}; display: flex; align-items: center; justify-content: center">{marker}{ic(icon, 18)}</a>'
    return (f'<nav aria-label="Main navigation, collapsed" style="width: 64px; flex-shrink: 0; background: %%SIDEBAR%%; padding: 18px 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6px">'
            f'<button aria-label="Expand navigation" style="width: 40px; height: 40px; border-radius: 10px; border: none; background: transparent; color: %%SIDEBAR_TEXT%%; display: flex; align-items: center; justify-content: center; margin-bottom: 14px">{ic("panel", 18)}</button>{out}'
            f'<span style="margin-top: auto; width: 34px; height: 34px; border-radius: 17px; background: %%SIDEBAR_ACTIVE%%; color: %%SIDEBAR_TEXT%%; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center">MK</span></nav>')


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
    def ico(icon, label):
        return f'<button aria-label="{label}" title="{label}" style="width: 36px; height: 36px; border-radius: 10px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic(icon, 17)}</button>'
    return (f'<aside aria-label="Library, collapsed" style="width: 52px; flex-shrink: 0; background: %%GROUND%%; border-right: 1px solid %%LINE%%; padding: 16px 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6px">'
            f'<button aria-label="Open library" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center; margin-bottom: 8px">{ic("expand", 16)}</button>'
            f'{ico("book", "Recipes")}{ico("leaf", "Ingredients")}{ico("search", "Search library")}'
            f'<span style="margin-top: 12px; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: %%MUTED%%">LIBRARY</span></aside>')


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
            f'<span style="margin-top: auto; font-size: 12px; font-weight: 600">{kcal} kcal<span style="font-weight: 400; color: %%MUTED%%">{count}</span></span>{split_bar(m, 4)}</a>')


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
        body += f'<span style="font-size: 12px; font-weight: 600; color: %%MUTED%%; align-self: center">{row}</span>'
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
            f'<span style="margin-left: auto">Meal shares: breakfast 25 % · snack 10 % · lunch 30 % · dinner 28 % · evening 7 % of the day</span></div>')


def title_row(mode, view):
    undo = f'<button aria-label="Undo" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("undo", 16)}</button>'
    return (f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 12px"><span style="font-size: 13px; color: %%MUTED%%">Plan templates /</span><h1 style="margin: 0; {DISP}; font-size: 24px; font-weight: 600">Lean cut — 12 weeks</h1><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: %%MUTED%%">{ic("check", 13)}Saved</span>'
            f'<div style="margin-left: auto; display: flex; align-items: center; gap: 8px">{pill_toggle(["Week", "Day"], view.capitalize(), "Range")}{pill_toggle(["Meals", "Nutrition"], mode.capitalize(), "View")}{undo}{btn("Save", "primary", "check")}</div></div>')


# ---- day view
def day_nav():
    def arrow(icon, label):
        return f'<button aria-label="{label}" style="width: 40px; height: 40px; border-radius: 20px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic(icon, 18)}</button>'
    dots = "".join(f'<span style="width: {18 if i == 1 else 6}px; height: 6px; border-radius: 3px; background: {"%%INK%%" if i == 1 else "%%LINE%%"}"></span>' for i in range(7))
    return (f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 14px">{arrow("back", "Previous day")}'
            f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">Tuesday</span><span style="font-size: 12px; color: %%MUTED%%">Week 5 · day 2 of 7</span></div>'
            f'{arrow("chevron", "Next day")}<span style="display: flex; gap: 4px; margin-left: 6px">{dots}</span></div>')


def day_summary(i):
    kc = sum(sum(x[2] for x in (ROWS[r][i] or [])) for r in ROWS)
    m = macros(kc)
    def stat(label, v, unit, target, color):
        pct = min(100, round(v / target * 100))
        return (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 4px"><span style="display: flex; align-items: center; gap: 5px; font-size: 11px; color: %%MUTED%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {color}"></span>{label}</span>'
                f'<span style="font-size: 14px; font-weight: 600">{v:,}<span style="font-weight: 400; color: %%MUTED%%"> / {target:,} {unit}</span></span>'
                f'<div style="height: 4px; border-radius: 2px; background: %%LINE%%"><div style="width: {pct}%; height: 4px; border-radius: 2px; background: {color}"></div></div></div>')
    note = (f'<button style="flex-shrink: 0; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px dashed %%LINE%%; background: transparent; color: %%MUTED%%; font: 500 12px {SQ}; display: flex; align-items: center; gap: 6px">{ic("note", 13)}Add day note</button>')
    return (f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 18px; padding: 12px 16px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%">'
            f'{stat("kcal", kc, "", TARGET, "%%NUTRI%%")}{stat("Protein", m["P"], "g", TARGETS["P"], "%%PROT%%")}{stat("Carbs", m["C"], "g", TARGETS["C"], "%%CARB%%")}{stat("Fat", m["F"], "g", TARGETS["F"], "%%FAT%%")}{stat("Fiber", m["Fib"], "g", TARGETS["Fib"], "%%FIB%%")}{note}</div>')


THUMB = {"Greek yogurt bowl": "#F1F1EC", "Banana": "#F2E3A6", "Apple": "#E8C7A8", "Almonds": "#C99D77", "Chicken rice bowl": "#C9D9A8", "Greek yogurt": "#F1F1EC", "Beef stir-fry": "#D7A68E"}
AMOUNT = {"recipe": ("1", "portion"), "ingredient": ("150", "g")}


def day_meal(row, items, note=None):
    if items is None:
        return (f'<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; padding: 14px 16px; display: flex; align-items: center; gap: 12px"><span style="font-size: 14px; font-weight: 600">{row}</span>'
                f'<span style="margin-left: auto; flex-grow: 1; max-width: 520px; height: 44px; border-radius: 10px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px">{ic("plus", 13)}Drag a recipe or ingredient here</span></div>')
    kcal = sum(i[2] for i in items)
    m = macros(kcal)
    rows = ""
    for n, kind, k in items:
        a, u = AMOUNT[kind]
        rows += (f'<div style="display: grid; grid-template-columns: 34px minmax(0, 1fr) 90px 80px 230px 28px; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid %%LINE%%">'
                 f'<span style="width: 34px; height: 34px; border-radius: 9px; background: {THUMB.get(n, "#E3D6B9")}"></span>'
                 f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 14px; font-weight: 500">{n}</span><span style="font-size: 11px; color: %%MUTED%%">{kind.capitalize()}</span></span>'
                 f'<span style="height: 32px; border-radius: 8px; border: 1px solid %%LINE%%; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 13px; font-weight: 600">{a}<span style="font-weight: 400; font-size: 11px; color: %%MUTED%%">{u}</span></span>'
                 f'<span style="font-size: 13px; font-weight: 600; text-align: right">{k} kcal</span><span style="font-size: 12px; color: %%MUTED%%">{mline(macros(k), True)} g</span>'
                 f'<button aria-label="Remove {n}" style="width: 28px; height: 28px; border-radius: 14px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("x", 14)}</button></div>')
    note_html = (f'<div style="display: flex; gap: 6px; padding: 8px 10px; border-radius: 10px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 12px">{ic("note", 12)}{note}</div>' if note
                 else f'<button style="align-self: flex-start; height: 28px; padding: 0 10px; border-radius: 8px; border: 1px dashed %%LINE%%; background: transparent; color: %%MUTED%%; font: 500 12px {SQ}; display: flex; align-items: center; gap: 5px">{ic("note", 12)}Add meal note</button>')
    return (f'<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center; gap: 12px"><span style="font-size: 15px; font-weight: 600">{row}</span><span style="font-size: 13px; font-weight: 600">{kcal} kcal</span><span style="font-size: 12px; color: %%MUTED%%">{mline(m, True)} g</span><span style="width: 120px">{split_bar(m, 4)}</span>'
            f'<span style="margin-left: auto; display: flex; gap: 6px">{btn("Copy to…", "ghost", "copy", 30)}</span></div>'
            f'<div>{rows}</div>'
            f'<div style="height: 38px; border-radius: 10px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px">{ic("plus", 13)}Drag more recipes or ingredients here</div>{note_html}</div>')


def day_view():
    i = 1
    meals = "".join(day_meal(r, ROWS[r][i], "Cook the rice the night before — it saves 15 minutes." if r == "Lunch" else None) for r in ROWS)
    return f'{day_nav()}{day_summary(i)}{scroll_area(f"<div style=\'display: flex; flex-direction: column; gap: 10px\'>{meals}</div>", 0, 38)}'


def editor_main(panel=False, mode="meals", view="week"):
    global NUTRI_MODE
    NUTRI_MODE = mode == "nutrition"
    meals = mode == "meals"
    plain = meals and not panel and view == "week"
    ghost = "" if not plain else ('<div style="position: absolute; left: 500px; top: 612px; width: 210px; transform: rotate(-3deg); display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 14px 30px rgba(0,0,0,0.22); pointer-events: none">'
                                  '<span style="width: 36px; height: 36px; border-radius: 10px; background: #F2C9B1"></span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 13px; font-weight: 600">Salmon, potatoes</span><span style="font-size: 11px; color: %%MUTED%%">610 kcal</span></span></div>')
    mm = macros(610)
    hover = "" if not plain else (f'<div role="tooltip" style="position: absolute; left: 130px; top: 800px; padding: 8px 10px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2)"><b>Salmon, potatoes · 610 kcal</b><br>{mline(mm, True)} g</div>'
                                  f'<div role="tooltip" style="position: absolute; left: 340px; top: 192px; width: 170px; padding: 8px 10px; border-radius: 10px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; line-height: 1.4; box-shadow: 0 8px 20px rgba(0,0,0,0.2)">Rest day — lighter carbs</div>')
    if view == "day":
        content = day_view()
    else:
        rows = week_rows(selected=("Lunch", 1) if panel else None, drop=("Lunch", 3) if plain else None)
        content = f'{week_strip()}{week_summary()}{week_head()}{scroll_area(rows, 0, 72)}{"" if meals else footer_legend()}'
    panel_html = meal_panel().replace("left: 236px; top: 300px;", "left: 250px; top: 300px;") if panel else ""
    out = (f'<div style="position: relative; flex-grow: 1; min-width: 0; height: {H}px; padding: 22px 24px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">'
           f'{title_row(mode, view)}{content}{ghost}{hover}{panel_html}</div>')
    NUTRI_MODE = False
    return out


def editor(d, t, panel=False, mode="meals", view="week"):
    lib = library_collapsed() if mode == "nutrition" else library("Tue · Lunch" if panel else None)
    body = (f'<div style="position: relative; width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">'
            f'{rail(d)}{lib}{editor_main(panel, mode, view)}</div>')
    return page(f"Template editor {d}", W, H, body, t)


