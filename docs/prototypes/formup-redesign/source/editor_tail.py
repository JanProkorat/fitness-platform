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
           f'<div style="margin-left: auto; display: flex; align-items: center; gap: 8px">{view_toggle(mode)}{undo}{btn("Preview as client", "outline", "eye")}</div></div>'
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


