GOAL_DOT = {"Lose fat": "%%TRAIN%%", "Build muscle": "%%PROT%%", "Maintain": "%%NUTRI%%"}


def tray_tabs(active):
    t = lambda key, label, badge="": (f'<a href="#" role="tab" aria-selected="{"true" if key == active else "false"}" style="flex-grow: 1; flex-basis: 0; height: 34px; border-radius: 9px; text-decoration: none; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; '
                                      f'{"background: %%TRAY_CARD%%; color: %%INK%%; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.08)" if key == active else "color: %%MUTED%%; font-weight: 600"}">{label}{badge}</a>')
    warn = '<span style="width: 7px; height: 7px; border-radius: 4px; background: %%MARKER%%"></span>'
    return f'<div role="tablist" aria-label="Side panel" style="display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: %%LINE%%">{t("library", ic("book", 14) + "Library")}{t("info", ic("info", 14) + "Plan info", warn)}</div>'


def template_card(name, goal, weeks, kcal, why, best=False):
    ring = "border: 2px solid %%NUTRI%%" if best else "border: 1px solid %%LINE%%"
    pill = f'<span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: %%INK2%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {GOAL_DOT[goal]}"></span>{goal}</span>'
    tag = '<span style="margin-left: auto; height: 20px; padding: 0 7px; border-radius: 6px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; display: inline-flex; align-items: center">BEST MATCH</span>' if best else ""
    return (f'<div style="border-radius: 12px; {ring}; background: %%TRAY_CARD%%; padding: 11px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="color: %%MUTED%%; display: flex">{ic("grip", 13)}</span><span style="font-size: 13px; font-weight: 700">{name}</span>{tag}</div>'
            f'<div style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: %%MUTED%%">{pill}<span>{weeks} wks · {kcal} kcal</span></div>'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 11px; color: %%MUTED%%">{why}</span>'
            f'<button style="margin-left: auto; height: 26px; padding: 0 10px; border-radius: 8px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK%%; font: 600 11px DM Sans, sans-serif">Use</button></div></div>')


def library_tab(sub):
    chip = lambda x, on: f'<button style="height: 30px; padding: 0 12px; border-radius: 15px; {"background: %%INK%%; color: %%SURFACE%%; border: none" if on else "background: %%TRAY_CARD%%; color: %%INK2%%; border: 1px solid %%LINE%%"}; font: 600 12px DM Sans, sans-serif">{x}</button>'
    head = f'<div style="display: flex; gap: 6px">{chip("Recipes", sub == "recipes")}{chip("Ingredients", False)}{chip("Templates", sub == "templates")}</div>'
    if sub == "templates":
        srch = search("Search templates…", 288).replace("background: %%SURFACE%%", "background: %%TRAY_CARD%%")
        hint = '<span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">Matched to Eva — goal Lose fat, 2,100 kcal, no lactose. Drag onto the week or press Use.</span>'
        cards = (template_card("Lean cut — 12 weeks", "Lose fat", 12, "2,100", "✓ goal · ✓ kcal · ✓ lactose-free", True)
                 + template_card("Cut — 4 weeks", "Lose fat", 4, "2,100", "✓ goal · ✓ kcal · ✓ lactose-free")
                 + template_card("Vegetarian cut", "Lose fat", 6, "1,950", "✓ goal · ~ kcal −7 %")
                 + '<span style="padding-top: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">OTHER GOALS</span>'
                 + template_card("Maintenance — busy week", "Maintain", 2, "2,300", "goal differs")
                 + template_card("Lean bulk — 8 weeks", "Build muscle", 8, "2,850", "goal differs"))
        return f'{head}{srch}{hint}<div style="display: flex; flex-direction: column; gap: 7px">{cards}</div>'
    srch = search("Search recipes…", 288).replace("background: %%SURFACE%%", "background: %%TRAY_CARD%%")
    hint = '<div style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">Drag onto a meal, or select a meal and press +.</div>'
    return f'{head}{srch}{hint}<div style="display: flex; flex-direction: column; gap: 7px">{"".join(lib_card(*x) for x in LIB[:7])}</div>'


def info_tab(blank=False):
    lbl = lambda x, req=False: f'<span style="font-size: 12px; font-weight: 600; color: %%INK2%%">{x}{" <span style=\"color: %%DANGER%%\">*</span>" if req else ""}</span>'
    box = lambda v, suffix="", strong=False: (f'<span style="height: 38px; padding: 0 11px; box-sizing: border-box; border-radius: 9px; border: {"1.5px solid %%INK%%" if strong else "1px solid %%LINE%%"}; background: %%TRAY_CARD%%; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600">{v}<span style="margin-left: auto; font-weight: 400; color: %%MUTED%%; display: flex">{suffix}</span></span>')
    f = lambda label, inner, req=False: f'<div style="display: flex; flex-direction: column; gap: 5px">{lbl(label, req)}{inner}</div>'
    two = lambda a, b: f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{a}{b}</div>'
    sec = lambda t: f'<span style="padding-top: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">{t}</span>'
    warn = ('' if blank else
            f'<div style="display: flex; gap: 8px; padding: 10px 12px; border-radius: 10px; background: %%DANGER_SOFT%%; color: %%MARKER%%; font-size: 12px; line-height: 1.45"><span style="display: flex; padding-top: 1px">{ic("alert", 14)}</span><span><b>2 meals contain lactose</b> — Eva is intolerant. <u>Show them</u></span></div>')
    src = ('' if blank else f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: %%MUTED%%">{ic("calendar", 13)}Started from template <b style="color: %%INK2%%">Lean cut — 12 weeks</b></div>')
    return (f'{warn}'
            f'{f("Plan name", box("New meal plan" if blank else "Lean cut — 12 weeks"), True)}'
            f'{sec("DATES")}'
            f'{two(f("Starts", box(ic("calendar", 14) + "Mon 6 Oct", ic("chevdown", 13), True), True), f("Ends", box("Sun 12 Oct" if blank else "Sun 28 Dec", "computed")))}'
            f'<span style="font-size: 11px; line-height: 1.45; color: %%MUTED%%">Plans start on a Monday. {"1 week so far" if blank else "12 weeks"} — add or remove weeks in the week strip.</span>'
            f'{sec("DAILY TARGET")}'
            f'{two(f("Calories", box("2,100", "kcal")), f("Fiber", box("30", "g")))}'
            f'<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px">{f("Protein", box("150", "g"))}{f("Carbs", box("220", "g"))}{f("Fat", box("70", "g"))}</div>'
            f'<span style="font-size: 11px; color: %%MUTED%%">Copied from Eva’s profile · <u>reset to profile</u></span>'
            f'{sec("PUBLISHING")}'
            f'<span style="font-size: 12px; line-height: 1.5; color: %%INK2%%">Each week is published on its own. Eva sees a week only after you publish it.</span>'
            f'{src}')


def client_tray(tab, sub="recipes", blank=False):
    inner = library_tab(sub) if tab == "library" else info_tab(blank)
    return (f'<aside aria-label="Side panel" style="position: relative; z-index: 1; width: 320px; flex-shrink: 0; background: %%TRAY%%; border-right: 2px solid %%TRAY_EDGE%%; box-shadow: 6px 0 24px rgba(0,0,0,0.07); padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 11px; overflow: hidden">'
            f'<div style="display: flex; align-items: center; gap: 8px">{tray_tabs(tab)}<button aria-label="Collapse panel" style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("collapse", 14)}</button></div>'
            f'{inner}</aside>')


def client_top2(blank=False):
    status = ('<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center">DRAFT · Eva sees nothing yet</span>' if blank else
              '<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center">2 OF 12 WEEKS PUBLISHED</span>')
    dates = f'<span style="font-size: 12px; color: %%MUTED%%; white-space: nowrap">Mon 6 Oct – Sun {"12 Oct" if blank else "28 Dec"}</span>'
    publish = btn("Publish week 1", "disabled", "check", 38) if blank else btn("Publish week 3", "primary", "check", 38)
    sq = lambda icon, label: f'<button aria-label="{label}" title="{label}" style="width: 38px; height: 38px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic(icon, 16)}</button>'
    return (f'<div style="flex-shrink: 0; margin: -22px -24px 0; padding: 12px 24px; background: %%SURFACE%%; border-bottom: 1px solid %%LINE%%; display: flex; align-items: center; gap: 12px">'
            f'<a href="#" aria-label="Back to Eva" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("back", 17)}</a>'
            f'{avatar("ES", 34, "%%INK%%", "%%SURFACE%%")}'
            f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%; white-space: nowrap">Eva Svobodová / Nutrition</span><h1 style="margin: 0; {DISP}; font-size: 21px; font-weight: 600; white-space: nowrap">{"New meal plan" if blank else "Lean cut — 12 weeks"}</h1></div>'
            f'{status}{dates}<span style="margin-left: auto; display: flex; gap: 8px">{sq("undo", "Undo")}{sq("eye", "Preview as client")}{publish}</span></div>')


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
    if blank:
        content = f'{client_week_strip(True)}{empty_week()}'
    else:
        content = f'{client_week_strip()}{week_head()}{scroll_area(week_rows(), 0, 72)}'
    extra = override_dialog() if mode == "override" else ""
    return (f'<div style="position: relative; flex-grow: 1; min-width: 0; height: {H}px; padding: 22px 24px; box-sizing: border-box; background: %%GLOW%%; display: flex; flex-direction: column; gap: 14px">'
            f'{client_top2(blank)}{content}{extra}</div>')


def client_editor(d, t, mode):
    tray = {"templates": client_tray("library", "templates"), "override": client_tray("library", "templates"),
            "info": client_tray("info"), "blank": client_tray("library", "templates", blank=True)}[mode]
    body = (f'<div style="position: relative; width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">'
            f'{rail(d)}{tray}{client_main(mode)}</div>')
    return page(f"Client plan editor {d}", W, H, body, t)


for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = ""
    DARK_ON = t["DARK"]
    for name, mode in (("PageClientPlanEditor", "templates"), ("PageClientPlanStartOver", "override"), ("PageClientPlanInfo", "info"), ("PageClientPlanBlank", "blank")):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(client_editor(d, t, mode))
print("ok")
