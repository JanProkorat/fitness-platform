def day_icon_btn(icon, label, color="%%MUTED%%"):
    return f'<button aria-label="{label}" title="{label}" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: {color}; display: flex; align-items: center; justify-content: center">{ic(icon, 15)}</button>'


def day_meal(row, items, note=None, first=False):
    sep = "" if first else "border-top: 1px solid %%LINE%%;"
    grip = f'<span style="color: %%MUTED%%; display: flex; cursor: grab">{ic("grip", 14)}</span>'
    actions = f'<span style="margin-left: auto; display: flex; gap: 2px">{day_icon_btn("note", "Add meal note")}{day_icon_btn("trash", f"Delete {row} from Tuesday")}</span>'
    add_food = f'<a href="#" style="align-self: flex-start; margin-left: 46px; height: 30px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: %%MUTED%%; text-decoration: none">{ic("plus", 14)}Add food</a>'
    if items is None:
        return (f'<section style="{sep} padding: 14px 20px; display: flex; flex-direction: column; gap: 6px">'
                f'<div style="display: flex; align-items: center; gap: 10px">{grip}<span style="font-size: 15px; font-weight: 700">{row}</span><span style="font-size: 12px; color: %%MUTED%%">nothing planned</span>{actions}</div>{add_food}</section>')
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
        rows += (f'<div style="display: grid; grid-template-columns: 34px 240px 104px 76px 120px minmax(0, 1fr) 28px; gap: 12px; align-items: center; padding: 6px 0">'
                 f'<span style="width: 34px; height: 34px; border-radius: 9px; background: {THUMB.get(n, "#E3D6B9")}"></span>'
                 f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{n}</span><span style="font-size: 11px; color: %%MUTED%%">{kind.capitalize()}</span></span>'
                 f'<span style="height: 32px; padding: 0 10px; box-sizing: border-box; border-radius: 8px; border: 1px solid %%LINE%%; display: flex; align-items: center; font-size: 13px; font-weight: 600">{a}<span style="margin-left: auto; font-weight: 400; font-size: 11px; color: %%MUTED%%">{u}</span></span>'
                 f'<span style="font-size: 13px; font-weight: 600; text-align: right">{k} kcal</span>'
                 f'<span title="{mline(macros(k), True)} g">{split_bar(macros(k), 4)}</span><span></span>'
                 f'<button aria-label="Remove {n}" style="width: 28px; height: 28px; border-radius: 14px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("x", 14)}</button></div>')
    note_html = (f'<div style="margin-left: 24px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-style: italic; color: %%INK2%%">{ic("note", 12)}{note}</div>' if note else "")
    return (f'<section style="{sep} padding: 14px 20px; display: flex; flex-direction: column; gap: 6px">'
            f'<div style="display: flex; align-items: center; gap: 10px">{grip}<span style="font-size: 15px; font-weight: 700">{row}</span>'
            f'<span style="font-size: 14px; font-weight: 600">{kcal} kcal</span>{pill}{actions}</div>'
            f'{note_html}<div style="margin-left: 24px; display: flex; flex-direction: column">{rows}</div>{add_food}</section>')


def insert_line():
    return ('<div style="position: relative; height: 0">'
            '<div style="position: absolute; left: 20px; right: 20px; top: -1px; height: 2px; background: %%MARKER%%"></div>'
            f'<a href="#" style="position: absolute; left: 50%; top: -13px; transform: translateX(-50%); height: 26px; padding: 0 12px; border-radius: 13px; background: %%MARKER%%; color: #FFFFFF; text-decoration: none; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 5px">{ic("plus", 13)}Insert meal here</a></div>')


def add_meal_bar():
    chip = lambda x: f'<button style="height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; font: 600 12px DM Sans, sans-serif">{x}</button>'
    return (f'<div style="border-top: 1px solid %%LINE%%; padding: 14px 20px; display: flex; align-items: center; gap: 8px; background: %%GROUND%%; border-radius: 0 0 16px 16px">'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700">{ic("plus", 15)}Add meal to Tuesday</span>'
            f'<span style="margin-left: 8px; display: flex; gap: 6px">{chip("Snack")}{chip("Evening snack")}{chip("Pre-workout")}{chip("Custom…")}</span>'
            f'<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Only Tuesday changes</span></div>')


def day_view():
    i = 1
    names = list(ROWS)
    sections = ""
    for j, r in enumerate(names):
        if r == "Lunch":
            sections += insert_line()
        sections += day_meal(r, ROWS[r][i], "Cook the rice the night before — it saves 15 minutes." if r == "Lunch" else None, first=(j == 0))
    sheet = f'<div style="border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">{sections}{add_meal_bar()}</div>'
    return f'{day_nav(i)}{day_summary(i)}{scroll_area(sheet, 0, 52)}'


