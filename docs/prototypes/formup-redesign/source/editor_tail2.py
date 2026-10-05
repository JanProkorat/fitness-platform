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
