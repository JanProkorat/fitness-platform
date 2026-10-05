"""Web: a client's nutrition plan in the editor — from a template, the start-over dialog, and blank."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen20.py")).read().split("\nfor d, t in DIRS.items():")[0]
_src = _src.replace('on = label == "Plan templates"', 'on = label == "Clients"')
exec(_src)
PATHS.setdefault("alert", '<path d="M12 4l9 16H3z"></path><path d="M12 10v4"></path><path d="M12 17v.1"></path>')
PATHS.setdefault("refresh", '<path d="M19 8a7.5 7.5 0 1 0 1 5"></path><path d="M19 3.5V8h-4.5"></path>')

WEEK_STATE = {1: "pub", 2: "pub", 3: "draft", 4: "draft", 5: "draft", 6: "draft", 7: "draft", 8: "draft"}


def client_top(blank=False):
    tpl = ("" if blank else
           f'<button style="height: 32px; padding: 0 10px; border-radius: 16px; border: 1px solid %%LINE%%; background: %%GROUND%%; color: %%INK2%%; font: 600 12px DM Sans, sans-serif; display: flex; align-items: center; gap: 6px">{ic("calendar", 13)}From template: Lean cut — 12 weeks{ic("chevdown", 13)}</button>')
    status = '<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center">DRAFT · client sees nothing yet</span>' if blank else \
             '<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center">2/12 PUBLISHED</span>'
    publish = btn("Publish week 1", "disabled", "check", 38) if blank else btn("Publish week 3", "primary", "check", 38)
    undo = f'<button aria-label="Undo" style="width: 38px; height: 38px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("undo", 16)}</button>'
    eye = f'<button aria-label="Preview as client" title="Preview as client" style="width: 38px; height: 38px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("eye", 16)}</button>'
    return (f'<div style="flex-shrink: 0; margin: -22px -24px 0; padding: 12px 24px; background: %%SURFACE%%; border-bottom: 1px solid %%LINE%%; display: flex; align-items: center; gap: 10px">'
            f'<a href="#" aria-label="Back to Eva" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("back", 17)}</a>'
            f'{avatar("ES", 34, "%%INK%%", "%%SURFACE%%")}'
            f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%; white-space: nowrap">Eva Svobodová / Nutrition</span><h1 style="margin: 0; {DISP}; font-size: 21px; font-weight: 600; white-space: nowrap">{"New meal plan" if blank else "Lean cut — 12 weeks"}</h1></div>'
            f'{tpl}{status}<span style="margin-left: auto; display: flex; gap: 8px">{undo}{eye}{publish}</span></div>')


def setup_strip(blank=False, warn=True):
    def cell(label, inner, w=None):
        return f'<div style="display: flex; flex-direction: column; gap: 4px; {"width: " + str(w) + "px;" if w else ""}"><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: %%MUTED%%">{label}</span>{inner}</div>'
    date = (f'<span style="height: 34px; padding: 0 10px; box-sizing: border-box; border-radius: 9px; border: 1.5px solid %%INK%%; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700">{ic("calendar", 14)}Mon 6 Oct 2026{ic("chevdown", 13)}</span>')
    ends = f'<span style="font-size: 13px; color: %%INK2%%; height: 34px; display: flex; align-items: center">Sun {"28 Dec" if not blank else "12 Oct"} · {"12 weeks" if not blank else "1 week so far"}</span>'
    tgt = (f'<span style="height: 34px; display: flex; align-items: center; gap: 8px; font-size: 13px"><b>2,100 kcal</b><span style="color: %%MUTED%%">Eva’s target</span>'
           + ('' if blank else f'<span style="color: %%NUTRI_INK%%; font-weight: 700; display: flex; align-items: center; gap: 4px">{ic("check", 13)}plan avg 2,060</span>') + '</span>')
    alert = ('' if (blank or not warn) else
             f'<a href="#" style="margin-left: auto; align-self: center; height: 36px; padding: 0 12px; border-radius: 10px; background: %%DANGER_SOFT%%; color: %%MARKER%%; text-decoration: none; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 7px">{ic("alert", 15)}2 meals contain lactose — Eva is intolerant<span style="font-weight: 600; text-decoration: underline">Show</span></a>')
    return (f'<div style="flex-shrink: 0; display: flex; align-items: flex-end; gap: 26px; padding: 12px 16px; border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%">'
            f'{cell("STARTS", date)}{cell("ENDS", ends)}{cell("DAILY TARGET", tgt)}{alert}</div>'
            + ('' if not blank else '<span style="margin-top: -8px; font-size: 12px; color: %%MUTED%%">Plans start on a Monday. Each week is published separately — Eva sees a week only after you publish it.</span>'))


def client_week_strip(blank=False):
    def arrow(icon, label):
        return f'<button aria-label="{label}" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic(icon, 15)}</button>'
    weeks = ""
    dates = ["6 Oct", "13 Oct", "20 Oct", "27 Oct", "3 Nov", "10 Nov", "17 Nov"]
    rng = range(1, 2) if blank else range(1, 8)
    for w in rng:
        on = w == (1 if blank else 3)
        state = "empty" if blank else WEEK_STATE[w]
        dot = {"pub": '<span style="width: 7px; height: 7px; border-radius: 4px; background: %%NUTRI%%"></span>',
               "draft": '<span style="width: 7px; height: 7px; box-sizing: border-box; border-radius: 4px; border: 1.5px solid %%TRAIN%%"></span>',
               "empty": '<span style="width: 7px; height: 7px; box-sizing: border-box; border-radius: 4px; border: 1.5px dashed %%MUTED%%"></span>'}[state]
        st = "background: %%INK%%; color: %%SURFACE%%" if on else "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%"
        weeks += (f'<a href="#" style="flex-shrink: 0; height: 40px; padding: 0 12px; border-radius: 12px; {st}; text-decoration: none; display: flex; align-items: center; gap: 8px; box-sizing: border-box">{dot}'
                  f'<span style="display: flex; flex-direction: column; line-height: 1.15"><span style="font-size: 13px; font-weight: 700">Week {w}</span><span style="font-size: 10px; opacity: 0.75">{dates[w - 1]}</span></span></a>')
    add = f'<button aria-label="Add week" style="height: 40px; padding: 0 12px; flex-shrink: 0; border-radius: 12px; border: 1px dashed %%LINE%%; background: transparent; color: %%MUTED%%; font: 600 12px DM Sans, sans-serif; display: flex; align-items: center; gap: 6px">{ic("plus", 14)}Add week</button>'
    leg = lambda dot, l: f'<span style="display: inline-flex; align-items: center; gap: 5px">{dot}{l}</span>'
    legend = (f'<span style="margin-left: auto; display: flex; gap: 12px; font-size: 11px; color: %%MUTED%%">'
              + leg('<span style="width: 7px; height: 7px; border-radius: 4px; background: %%NUTRI%%"></span>', "Published")
              + leg('<span style="width: 7px; height: 7px; box-sizing: border-box; border-radius: 4px; border: 1.5px solid %%TRAIN%%"></span>', "Draft")
              + leg('<span style="width: 7px; height: 7px; box-sizing: border-box; border-radius: 4px; border: 1.5px dashed %%MUTED%%"></span>', "Empty") + '</span>')
    return f'<div style="flex-shrink: 0; display: flex; align-items: center; gap: 8px">{arrow("back", "Earlier weeks")}{weeks}{"" if not blank else add}{"" if blank else arrow("chevron", "Later weeks")}{legend}</div>'


def template_menu():
    item = lambda icon, t, s, danger=False: (f'<a href="#" style="display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; text-decoration: none; color: {"%%MARKER%%" if danger else "%%INK%%"}">'
                                             f'<span style="display: flex; padding-top: 1px">{ic(icon, 16)}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 600">{t}</span><span style="font-size: 11px; color: %%MUTED%%">{s}</span></span></a>')
    return (f'<div role="menu" style="position: absolute; left: 384px; top: 58px; z-index: 5; width: 300px; padding: 6px; border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 18px 40px rgba(0,0,0,0.18)">'
            f'<span style="display: block; padding: 8px 12px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: %%MUTED%%">THIS PLAN STARTED FROM A TEMPLATE</span>'
            + item("eye", "Open the template", "See the original — edits here don’t change it")
            + item("refresh", "Replace with another template", "Draft weeks get the new meals")
            + item("trash", "Clear all meals and start blank", "Keeps the start date and weeks", True) + '</div>')


def start_over_dialog():
    opt = lambda title, sub, on: (f'<div style="display: flex; gap: 12px; padding: 14px; border-radius: 12px; border: {"2px solid %%INK%%" if on else "1px solid %%LINE%%"}">'
                                  f'<span style="width: 18px; height: 18px; flex-shrink: 0; box-sizing: border-box; border-radius: 9px; {"border: 5px solid %%INK%%" if on else "border: 1.5px solid %%MUTED%%"}"></span>'
                                  f'<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">{title}</span><span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">{sub}</span></span></div>')
    return (f'<div style="position: absolute; inset: 0; z-index: 6; background: rgba(10,10,12,0.45)"></div>'
            f'<div role="dialog" aria-label="Start over" style="position: absolute; left: 50%; top: 150px; z-index: 7; width: 520px; margin-left: -150px; box-sizing: border-box; border-radius: 20px; background: %%SURFACE%%; box-shadow: 0 30px 80px rgba(0,0,0,0.35); padding: 26px 28px; display: flex; flex-direction: column; gap: 16px">'
            f'<div style="display: flex; align-items: flex-start; gap: 12px"><span style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; background: %%DANGER_SOFT%%; color: %%MARKER%%; display: flex; align-items: center; justify-content: center">{ic("refresh", 19)}</span>'
            f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">Start over?</span><span style="font-size: 13px; line-height: 1.5; color: %%MUTED%%">Weeks 1–2 are already published, so Eva keeps seeing them. Only the 10 draft weeks change.</span></div></div>'
            + opt("Clear the meals in draft weeks", "Keeps the start date, the weeks and the meal rows. You fill the days yourself.", True)
            + opt("Replace with another template", "Draft weeks get the meals of the template you choose next.", False)
            + f'<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: %%INK2%%">{checkbox(False, "Also unpublish weeks 1–2")}Also unpublish weeks 1–2 and start from week 1</label>'
            + f'<div style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px">{btn("Cancel", "outline", h=40)}<button style="height: 40px; padding: 0 16px; border-radius: 10px; border: none; background: %%MARKER%%; color: #FFFFFF; font: 700 13px DM Sans, sans-serif">Clear draft weeks</button></div></div>')


GOAL_DOT = {"Lose fat": "%%TRAIN%%", "Build muscle": "%%PROT%%", "Maintain": "%%NUTRI%%"}


def tray_tabs(active, warn_dot=True):
    t = lambda key, label, badge="": (f'<a href="#" role="tab" aria-selected="{"true" if key == active else "false"}" style="flex-grow: 1; flex-basis: 0; height: 34px; border-radius: 9px; text-decoration: none; font-size: 13px; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 6px; '
                                      f'{"background: %%TRAY_CARD%%; color: %%INK%%; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.08)" if key == active else "color: %%MUTED%%; font-weight: 600"}">{label}{badge}</a>')
    warn = '<span style="width: 7px; height: 7px; border-radius: 4px; background: %%MARKER%%"></span>' if warn_dot else ''
    return f'<div role="tablist" aria-label="Side panel" style="flex-grow: 1; display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: %%LINE%%">{t("library", "Library")}{t("info", "Plan info", warn)}</div>'


def template_card(name, goal, weeks, kcal, why, best=False):
    ring = "border: 2px solid %%NUTRI%%" if best else "border: 1px solid %%LINE%%"
    pill = f'<span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: %%INK2%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {GOAL_DOT[goal]}"></span>{goal}</span>'
    tag = '<span style="margin-left: auto; height: 20px; padding: 0 7px; border-radius: 6px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; display: inline-flex; align-items: center">BEST MATCH</span>' if best else ""
    return (f'<div style="border-radius: 12px; {ring}; background: %%TRAY_CARD%%; padding: 11px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="color: %%MUTED%%; display: flex">{ic("grip", 13)}</span><span style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{name}</span>{tag}</div>'
            f'<div style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: %%MUTED%%">{pill}<span>{weeks} wks · {kcal} kcal</span></div>'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 11px; color: %%MUTED%%">{why}</span>'
            f'<button style="margin-left: auto; height: 26px; padding: 0 10px; border-radius: 8px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK%%; font: 600 11px DM Sans, sans-serif">Use</button></div></div>')


def library_tab(sub):
    chip = lambda x, on: f'<button style="height: 30px; padding: 0 12px; border-radius: 15px; {"background: %%INK%%; color: %%SURFACE%%; border: none" if on else "background: %%TRAY_CARD%%; color: %%INK2%%; border: 1px solid %%LINE%%"}; font: 600 12px DM Sans, sans-serif">{x}</button>'
    head = f'<div style="display: flex; gap: 6px">{chip("Recipes", sub == "recipes")}{chip("Ingredients", False)}{chip("Templates", sub == "templates")}</div>'
    if sub == "templates":
        srch = search("Search templates…", 268).replace("background: %%SURFACE%%", "background: %%TRAY_CARD%%")
        hint = '<span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">Matched to Eva — goal Lose fat, 2,100 kcal, no lactose. Drag onto the week or press Use.</span>'
        cards = (template_card("Lean cut — 12 weeks", "Lose fat", 12, "2,100", "✓ goal · ✓ kcal · ✓ lactose-free", True)
                 + template_card("Cut — 4 weeks", "Lose fat", 4, "2,100", "✓ goal · ✓ kcal · ✓ lactose-free")
                 + template_card("Vegetarian cut", "Lose fat", 6, "1,950", "✓ goal · ~ kcal −7 %")
                 + '<span style="padding-top: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">OTHER GOALS</span>'
                 + template_card("Maintenance — busy week", "Maintain", 2, "2,300", "goal differs")
                 + template_card("Lean bulk — 8 weeks", "Build muscle", 8, "2,850", "goal differs"))
        return f'{head}{srch}{hint}<div style="display: flex; flex-direction: column; gap: 7px">{cards}</div>'
    srch = search("Search recipes…", 268).replace("background: %%SURFACE%%", "background: %%TRAY_CARD%%")
    hint = '<div style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">Drag onto a meal, or select a meal and press +.</div>'
    return f'{head}{srch}{hint}<div style="display: flex; flex-direction: column; gap: 7px">{"".join(lib_card(*x) for x in LIB[:7])}</div>'


def info_tab(blank=False):
    lbl = lambda x, req=False: f'<span style="font-size: 12px; font-weight: 600; color: %%INK2%%">{x}{" <span style=\"color: %%DANGER%%\">*</span>" if req else ""}</span>'
    box = lambda v, suffix="", strong=False: (f'<span style="height: 38px; padding: 0 11px; box-sizing: border-box; border-radius: 9px; border: {"1.5px solid %%INK%%" if strong else "1px solid %%LINE%%"}; background: %%TRAY_CARD%%; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; white-space: nowrap">{v}<span style="margin-left: auto; font-weight: 400; color: %%MUTED%%; display: flex">{suffix}</span></span>')
    f = lambda label, inner, req=False: f'<div style="display: flex; flex-direction: column; gap: 5px">{lbl(label, req)}{inner}</div>'
    two = lambda a, b: f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{a}{b}</div>'
    sec = lambda t: f'<span style="padding-top: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">{t}</span>'
    warn = ('' if blank else
            f'<div style="display: flex; gap: 8px; padding: 10px 12px; border-radius: 10px; background: %%DANGER_SOFT%%; color: %%MARKER%%; font-size: 12px; line-height: 1.45"><span style="display: flex; padding-top: 1px">{ic("alert", 14)}</span><span><b>2 meals contain lactose</b> — Eva is intolerant. <u>Show them</u></span></div>')
    src = ('' if blank else f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: %%MUTED%%">{ic("calendar", 13)}Started from template <b style="color: %%INK2%%">Lean cut — 12 weeks</b></div>')
    return (f'{warn}'
            f'{f("Plan name", box("New meal plan" if blank else "Lean cut — 12 weeks"), True)}'
            f'{sec("DATES")}'
            f'{two(f("Starts", box(ic("calendar", 14) + "Mon 6 Oct", ic("chevdown", 13), True), True), f("Ends", box("Sun 12 Oct" if blank else "Sun 28 Dec")))}'
            f'<span style="font-size: 11px; line-height: 1.45; color: %%MUTED%%">Plans start on a Monday. {"1 week so far" if blank else "12 weeks"} — add or remove weeks in the week strip.</span>'
            f'{sec("DAILY TARGET")}'
            f'{two(f("Calories", box("2,100", "kcal")), f("Fiber", box("30", "g")))}'
            f'<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px">{f("Protein", box("150", "g"))}{f("Carbs", box("220", "g"))}{f("Fat", box("70", "g"))}</div>'
            f'<span style="font-size: 11px; color: %%MUTED%%">Copied from Eva’s profile · <u>reset to profile</u></span>'
            f'{sec("PUBLISHING")}'
            f'<span style="font-size: 12px; line-height: 1.5; color: %%INK2%%">Each week is published on its own. Eva sees a week only after you publish it.</span>'
            f'{src}')


def label_strip(active, open_, warn=True):
    def lab(key, text, dot=False):
        on = key == active and open_
        st = "background: %%TRAY_CARD%%; color: %%INK%%; box-shadow: 0 1px 4px rgba(0,0,0,0.10)" if on else "background: transparent; color: %%MUTED%%"
        bar = '<span style="position: absolute; left: -6px; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: %%INK%%"></span>' if on else ""
        d = '<span style="width: 7px; height: 7px; border-radius: 4px; background: %%MARKER%%; margin-bottom: 4px"></span>' if dot else ""
        return (f'<a href="#" role="tab" aria-selected="{"true" if on else "false"}" title="{text.title()}" style="position: relative; width: 28px; padding: 10px 0; border-radius: 8px; {st}; text-decoration: none; display: flex; flex-direction: column; align-items: center">{d}'
                f'<span style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; font-weight: 700; letter-spacing: 0.14em">{text}</span>{bar}</a>')
    toggle = (f'<button aria-label="{"Close panel" if open_ else "Open panel"}" style="width: 28px; height: 28px; border-radius: 8px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK%%; display: flex; align-items: center; justify-content: center; margin-bottom: 4px">{ic("collapse" if open_ else "expand", 14)}</button>')
    edge = ("border-left: 1px solid %%LINE%%; " if open_ else "") + "border-right: 2px solid %%TRAY_EDGE%%; box-shadow: 6px 0 24px rgba(0,0,0,0.07);"
    return (f'<nav role="tablist" aria-label="Side panel" style="position: relative; z-index: 2; width: 40px; flex-shrink: 0; background: %%TRAY%%; {edge} padding: 14px 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 8px">'
            f'{toggle}{lab("info", "PLAN INFO", warn)}{lab("library", "LIBRARY")}</nav>')


def client_tray(tab, sub="recipes", blank=False):
    inner = library_tab(sub) if tab == "library" else info_tab(blank)
    title = "LIBRARY" if tab == "library" else "PLAN INFO"
    panel = (f'<aside aria-label="{title.title()}" style="position: relative; z-index: 1; width: 300px; flex-shrink: 0; background: %%TRAY%%; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 11px; overflow: hidden">'
             f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: %%INK2%%; padding: 4px 0 2px">{title}</span>{inner}</aside>')
    return panel + label_strip(tab, True, not blank)


def client_top2(blank=False, view="week"):
    status = ('<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center">DRAFT</span>' if blank else
              '<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center">2/12 PUBLISHED</span>')
    dates = f'<span style="font-size: 12px; color: %%MUTED%%; white-space: nowrap">Mon 6 Oct – Sun {"12 Oct" if blank else "28 Dec"}</span>'
    publish = btn("Publish week 1", "disabled", "check", 38) if blank else btn("Publish week 3", "primary", "check", 38)
    sq = lambda icon, label: f'<button aria-label="{label}" title="{label}" style="width: 38px; height: 38px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic(icon, 16)}</button>'
    return (f'<div style="flex-shrink: 0; margin: -22px -24px 0; padding: 12px 24px; background: %%SURFACE%%; border-bottom: 1px solid %%LINE%%; display: flex; align-items: center; gap: 12px">'
            f'<a href="#" aria-label="Back to Eva" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("back", 17)}</a>'
            f'{avatar("ES", 34, "%%INK%%", "%%SURFACE%%")}'
            f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%; white-space: nowrap">Eva Svobodová / Nutrition</span><h1 style="margin: 0; {DISP}; font-size: 21px; font-weight: 600; white-space: nowrap">{"New meal plan" if blank else "Lean cut — 12 weeks"}</h1></div>'
            f'{status}<span style="margin-left: auto; display: flex; gap: 8px">{pill_toggle(["Week", "Day"], view.capitalize(), "Range")}{pill_toggle(["Meals", "Nutrition"], "Meals", "View")}{sq("undo", "Undo")}{sq("eye", "Preview as client")}{publish}</span></div>')


def override_dialog():
    return (f'<div style="position: absolute; inset: 0; z-index: 6; background: rgba(10,10,12,0.45)"></div>'
            f'<div role="dialog" aria-label="Replace plan content" style="position: absolute; left: 50%; top: 160px; z-index: 7; width: 520px; margin-left: -260px; box-sizing: border-box; border-radius: 20px; background: %%SURFACE%%; box-shadow: 0 30px 80px rgba(0,0,0,0.35); padding: 26px 28px; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="display: flex; align-items: flex-start; gap: 12px"><span style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; background: %%DANGER_SOFT%%; color: %%MARKER%%; display: flex; align-items: center; justify-content: center">{ic("refresh", 19)}</span>'
            f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">Use “Cut — 4 weeks” instead?</span>'
            f'<span style="font-size: 13px; line-height: 1.5; color: %%MUTED%%">This plan already has meals. The template will replace them.</span></div></div>'
            f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 12px; background: %%GROUND%%; border: 1px solid %%LINE%%; font-size: 13px; line-height: 1.45">'
            f'<span style="display: flex; gap: 8px"><span style="color: %%MARKER%%">●</span><span><b>Weeks 3–12</b> (drafts) get the template’s meals.</span></span>'
            f'<span style="display: flex; gap: 8px"><span style="color: %%NUTRI%%">●</span><span><b>Weeks 1–2</b> are published — Eva keeps them unchanged.</span></span>'
            f'<span style="display: flex; gap: 8px"><span style="color: %%MUTED%%">●</span><span>The template has 4 weeks; the plan shortens to <b>6 weeks</b>, ending Sun 16 Nov.</span></span></div>'
            f'<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: %%INK2%%">{checkbox(False, "Keep plan length")}Keep 12 weeks — repeat the template to fill them</label>'
            f'<div style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px">{btn("Cancel", "outline", h=40)}<button style="height: 40px; padding: 0 16px; border-radius: 10px; border: none; background: %%MARKER%%; color: #FFFFFF; font: 700 13px DM Sans, sans-serif">Replace draft weeks</button></div></div>')


def client_main(mode):
    blank = mode == "blank"
    if mode in ("day", "dayadd"):
        sections = ""
        for j, r in enumerate(ROWS):
            sections += day_meal(r, ROWS[r][1], "Cook the rice the night before — it saves 15 minutes." if r == "Lunch" else None, first=(j == 0))
        sheet = f'<div style="border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">{sections}{add_meal_bar()}</div>'
        return (f'<div style="position: relative; flex-grow: 1; min-width: 0; height: {H}px; padding: 22px 24px; box-sizing: border-box; background: %%GLOW%%; display: flex; flex-direction: column; gap: 14px">'
                f'{client_top2(False, "day")}{day_nav(1, week=3)}{day_summary(1)}{scroll_area(sheet, 0, 52)}</div>')
    if blank:
        content = f'{client_week_strip(True)}{empty_week()}'
    else:
        content = f'{client_week_strip()}{week_head()}{scroll_area(week_rows(), 0, 72)}'
    extra = override_dialog() if mode == "override" else ""
    return (f'<div style="position: relative; flex-grow: 1; min-width: 0; height: {H}px; padding: 22px 24px; box-sizing: border-box; background: %%GLOW%%; display: flex; flex-direction: column; gap: 14px">'
            f'{client_top2(blank)}{content}{extra}</div>')


def client_editor(d, t, mode, add_meal=False):
    tray = {"templates": client_tray("library", "templates"), "override": client_tray("library", "templates"),
            "info": client_tray("info"), "blank": client_tray("library", "templates", blank=True),
            "closed": label_strip("library", False), "day": client_tray("library", "recipes"), "dayadd": client_tray("library", "recipes")}[mode]
    body = (f'<div style="position: relative; width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">'
            f'{rail(d)}{tray}{client_main(mode)}{add_meal_drawer() if add_meal else ""}</div>')
    return page(f"Client plan editor {d}", W, H, body, t)


for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = ""
    DARK_ON = t["DARK"]
    for name, mode in (("PageClientPlanEditor", "templates"), ("PageClientPlanStartOver", "override"), ("PageClientPlanInfo", "info"), ("PageClientPlanBlank", "blank"), ("PageClientPlanClosed", "closed"), ("PageClientPlanDay", "day"), ("PageClientPlanDayAddMeal", "dayadd")):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(client_editor(d, t, mode, mode == "dayadd"))
print("ok")
