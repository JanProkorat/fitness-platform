# ---------------------------------------------------------------- audience sections (top-bar anchors)
def window(title, sub, inner, w, extra=""):
    dots = "".join('<span style="width: 9px; height: 9px; border-radius: 5px; background: %%LINE%%"></span>' for _ in range(3))
    return (f'<div style="width: {w}px; border-radius: 16px; border: 1px solid %%LINE%%; background: %%GROUND%%; box-shadow: 0 24px 60px rgba(0,0,0,0.12); overflow: hidden{extra}">'
            f'<div style="height: 40px; padding: 0 16px; border-bottom: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; gap: 6px">{dots}'
            f'<span style="margin-left: 12px; font-size: 12px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></div>{inner}</div>')


def coach_visual():
    thumbs = [("Bench press", "Chest", "#C9B29E"), ("Barbell row", "Back", "#B7C4CF"), ("Face pull", "Shoulders", "#D7A68E"), ("Pull-up", "Back", "#C6C9B0")]
    lib = "".join(f'<div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%">'
                  f'<span style="width: 40px; height: 32px; border-radius: 7px; background: {c}; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("play", 12)}</span>'
                  f'<span style="display: flex; flex-direction: column"><span style="font-size: 12px; font-weight: 600">{n}</span><span style="font-size: 10px; color: %%MUTED%%">{m}</span></span></div>'
                  for n, m, c in thumbs)
    rows = [("Bench press", "4 × 8", "60 kg", "2 min"), ("Barbell row", "4 × 10", "50 kg", "90 s"), ("Overhead press", "3 × 8", "35 kg", "90 s"), ("Pull-up", "3 × max", "body", "2 min")]
    session = ""
    for i, (n, sr, kg, rest) in enumerate(rows):
        if i == 2:
            session += '<div style="height: 2px; border-radius: 1px; background: %%MARKER%%; margin: -3px 0"></div>'
        session += (f'<div style="display: grid; grid-template-columns: 18px minmax(0, 1fr) 64px 56px 48px; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%">'
                    f'<span style="color: %%MUTED%%">{ic("grip", 14)}</span><span style="font-size: 13px; font-weight: 600">{n}</span>'
                    f'<span style="font-size: 12px; font-weight: 600">{sr}</span><span style="font-size: 12px; color: %%INK2%%">{kg}</span><span style="font-size: 11px; color: %%MUTED%%">{rest}</span></div>')
    ghost = ('<div style="position: absolute; left: 236px; top: 214px; width: 190px; transform: rotate(-3deg); display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 14px 30px rgba(0,0,0,0.22)">'
             '<span style="width: 40px; height: 32px; border-radius: 7px; background: #D7A68E"></span><span style="display: flex; flex-direction: column"><span style="font-size: 12px; font-weight: 700">Face pull</span><span style="font-size: 10px; color: %%MUTED%%">3 × 15</span></span></div>')
    inner = (f'<div style="position: relative; display: flex; gap: 14px; padding: 14px">'
             f'<div style="width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px"><span style="height: 32px; border-radius: 8px; border: 1px solid %%LINE%%; background: %%SURFACE%%; padding: 0 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; color: %%MUTED%%">{ic("search", 13)}Exercise library</span>{lib}</div>'
             f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px"><span style="font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: %%MUTED%%">BLOCK A · STRENGTH</span>{session}</div>{ghost}</div>')
    live = ('<div style="position: absolute; right: -24px; bottom: -34px; width: 290px; box-sizing: border-box; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 18px 40px rgba(0,0,0,0.18); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px">'
            '<span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: %%MARKER%%"><span style="width: 7px; height: 7px; border-radius: 4px; background: %%MARKER%%"></span>LIVE · PETRA IS TRAINING</span>'
            '<span style="font-size: 13px; font-weight: 600">Bench press · set 3 of 4</span>'
            f'<span style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: %%MUTED%%">60 kg × 8 reps<span style="margin-left: auto; width: 22px; height: 22px; border-radius: 11px; background: %%TRAIN%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.6")}</span></span></div>')
    return f'<div style="position: relative">{window("Upper body A", "· Session template", inner, 700)}{live}</div>'


def nutri_visual():
    days = ["Mon", "Tue", "Wed", "Thu"]
    data = {"Breakfast": [(420, "ok"), (480, "ok"), (420, "ok"), (690, "over")],
            "Lunch": [(640, "ok"), (590, "ok"), (430, "under"), (640, "ok")],
            "Dinner": [(610, "ok"), (820, "over"), (540, "ok"), (590, "ok")]}
    style = {"ok": ("%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "on target"), "over": ("%%TRAIN_SOFT%%", "%%TRAIN%%", "+22 %"), "under": ("%%GROUND%%", "%%MUTED%%", "−18 %")}
    head = '<span></span>' + "".join(f'<span style="font-size: 11px; font-weight: 600; color: %%MUTED%%; text-align: center">{d}</span>' for d in days)
    totals = '<span style="font-size: 11px; font-weight: 600; color: %%MUTED%%; align-self: center">Day</span>'
    for i in range(4):
        kc = sum(data[r][i][0] for r in data) + 400
        off = abs(kc - 2100) / 2100 > 0.1
        totals += (f'<div style="padding: 7px 8px; border-radius: 9px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; flex-direction: column; gap: 4px">'
                   f'<span style="font-size: 12px; font-weight: 700; color: {"%%TRAIN%%" if off else "%%INK%%"}">{kc:,} kcal</span>'
                   f'<div style="height: 4px; border-radius: 2px; background: %%LINE%%"><div style="width: {min(100, round(kc / 21))}%; height: 4px; border-radius: 2px; background: {"%%TRAIN%%" if off else "%%NUTRI%%"}"></div></div></div>')
    body = ""
    for row, cells in data.items():
        body += f'<span style="font-size: 11px; font-weight: 600; color: %%MUTED%%; align-self: center">{row}</span>'
        for k, s in cells:
            bg, fg, tag = style[s]
            body += (f'<div style="height: 66px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; background: {bg}; padding: 8px; display: flex; flex-direction: column; gap: 2px">'
                     f'<span style="display: flex; align-items: baseline; gap: 3px"><span style="font-size: 16px; font-weight: 600">{k}</span><span style="font-size: 10px; color: %%MUTED%%">kcal</span></span>'
                     f'<span style="font-size: 10px; font-weight: 700; color: {fg}">{tag}</span><span style="margin-top: auto">{split(3)}</span></div>')
    grid = f'<div style="padding: 14px 16px 16px; display: grid; grid-template-columns: 70px repeat(4, minmax(0, 1fr)); gap: 8px">{head}{totals}{body}</div>'
    item = lambda n, q, done: (f'<div style="display: flex; align-items: center; gap: 9px; padding: 6px 0; border-top: 1px solid %%LINE%%">'
                               + (f'<span style="width: 16px; height: 16px; border-radius: 4px; background: %%NUTRI%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 10, sw="2.8")}</span>' if done
                                  else '<span style="width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid %%MUTED%%"></span>')
                               + f'<span style="font-size: 12px; {"text-decoration: line-through; color: %%MUTED%%" if done else ""}">{n}</span><span style="margin-left: auto; font-size: 11px; color: %%MUTED%%">{q}</span></div>')
    shop = ('<div style="position: absolute; left: -30px; bottom: -40px; width: 250px; box-sizing: border-box; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 18px 40px rgba(0,0,0,0.18); padding: 12px 14px; display: flex; flex-direction: column">'
            '<span style="font-size: 13px; font-weight: 700; padding-bottom: 6px">Shopping list · Week 5</span>'
            f'{item("Chicken breast", "900 g", True)}{item("Basmati rice", "500 g", True)}{item("Greek yogurt", "1.2 kg", False)}{item("Blueberries", "400 g", False)}</div>')
    targets = ('<div style="position: absolute; right: -20px; top: -26px; display: flex; gap: 6px; padding: 8px 10px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 12px 28px rgba(0,0,0,0.14); font-size: 11px; font-weight: 600">'
               + "".join(f'<span style="display: inline-flex; align-items: center; gap: 5px"><span style="width: 7px; height: 7px; border-radius: 4px; background: {c}"></span>{l}</span>'
                         for c, l in (("%%NUTRI%%", "2,100 kcal"), ("%%PROT%%", "P 150"), ("%%CARB%%", "C 220"), ("%%FAT%%", "F 70"), ("%%FIB%%", "Fib 30")))
               + '</div>')
    return f'<div style="position: relative">{window("Lean cut — 12 weeks", "· Week 5 · Nutrition view", grid, 640)}{shop}{targets}</div>'


def phone_shell(inner, w=250, h=500, extra=""):
    dark = bool(DARK_ON)
    wash = ("radial-gradient(240px 200px at 0% 0%, rgba(242,140,56,0.30), transparent 70%), radial-gradient(240px 240px at 100% 50%, rgba(140,193,82,0.24), transparent 70%), #0F0F10"
            if dark else "radial-gradient(240px 200px at 0% 0%, #FFE2C8, transparent 70%), radial-gradient(240px 240px at 100% 50%, #DDF0C8, transparent 70%), #F4F3EF")
    ink = "#F4F2EE" if dark else "#141414"
    return (f'<div style="position: relative; width: {w}px; height: {h}px; flex-shrink: 0; box-sizing: border-box; border-radius: 44px; border: 9px solid {"#2A2A2D" if dark else "#141414"}; background: {wash}; box-shadow: 0 30px 70px rgba(0,0,0,0.22); overflow: hidden; padding: 14px; display: flex; flex-direction: column; gap: 12px; color: {ink}{extra}">'
            f'<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; padding: 0 8px"><span>9:41</span><span style="width: 64px; height: 18px; border-radius: 9px; background: #000"></span><span>100%</span></div>{inner}</div>')


def glass_card(inner, pad="12px 14px"):
    g = "rgba(255,255,255,0.08)" if DARK_ON else "rgba(255,255,255,0.75)"
    return f'<div style="border-radius: 18px; background: {g}; border: 1px solid rgba(255,255,255,0.4); padding: {pad}">{inner}</div>'


def phone_chat():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    other = "rgba(255,255,255,0.1)" if DARK_ON else "#FFFFFF"
    bub = lambda t, mine: (f'<div style="align-self: {"flex-end" if mine else "flex-start"}; max-width: 78%; padding: 8px 11px; border-radius: 14px; font-size: 12px; line-height: 1.4; '
                           f'background: {"%%MARKER%%" if mine else other}; color: {"#FFFFFF" if mine else "inherit"}">{t}</div>')
    inner = (f'<div style="display: flex; align-items: center; gap: 10px; padding: 4px 6px"><span style="width: 34px; height: 34px; border-radius: 17px; background: #C9B29E"></span>'
             f'<span style="display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 700">Jan · coach</span><span style="font-size: 11px; color: {muted}">online</span></span></div>'
             f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px; padding: 6px 2px">'
             f'{bub("Legs felt heavy on Friday — should I skip squats?", True)}'
             f'{bub("Keep them, drop to 3 sets. I’ve updated Friday’s session.", False)}'
             f'<span style="align-self: center; font-size: 10px; color: {muted}">Session updated · Lower body B</span>'
             f'{bub("Perfect, thanks! 💪", True)}</div>'
             f'<div style="height: 38px; border-radius: 19px; border: 1px solid rgba(127,127,127,0.3); padding: 0 14px; display: flex; align-items: center; font-size: 12px; color: {muted}">Message</div>')
    return phone_shell(inner, extra="; margin-top: 40px")


def phone_checkin():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    thumbs = "".join(f'<span style="flex-grow: 1; height: 64px; border-radius: 10px; background: {c}"></span>' for c in ("#D9C2AE", "#C9B29E", "#BFA48E"))
    mood = "".join(f'<span style="flex-grow: 1; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; '
                   f'{"background: %%MARKER%%; color: #FFFFFF" if i == 4 else "border: 1px solid rgba(127,127,127,0.3)"}">{i}</span>' for i in range(1, 6))
    inner = (f'<div style="padding: 4px 6px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Sunday · week 5</span><span style="{DISP}; font-size: 20px; font-weight: 600">Weekly check-in</span></div>'
             + glass_card(f'<span style="font-size: 11px; color: {muted}">Weight</span><div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 28px; font-weight: 600">68.4</span><span style="font-size: 12px; color: {muted}">kg</span><span style="margin-left: auto; font-size: 11px; font-weight: 700; color: %%NUTRI%%">−0.6</span></div>')
             + glass_card(f'<span style="font-size: 11px; color: {muted}">Progress photos</span><div style="display: flex; gap: 6px; padding-top: 6px">{thumbs}</div>')
             + glass_card(f'<span style="font-size: 11px; color: {muted}">Energy this week</span><div style="display: flex; gap: 5px; padding-top: 6px">{mood}</div>')
             + '<span style="margin-top: auto; height: 40px; border-radius: 20px; background: %%MARKER%%; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Send to Jan</span>')
    return phone_shell(inner, extra="; margin-top: 80px")


def phone_today_static():
    return phone_today().replace("position: absolute; left: 600px; top: 0; width: 270px; height: 500px", "position: relative; flex-shrink: 0; width: 250px; height: 500px")


def client_visual():
    return f'<div style="display: flex; gap: 34px; align-items: flex-start; justify-content: center">{phone_today_static()}{phone_chat()}{phone_checkin()}</div>'


def point(icon, bg, fg, t, b):
    return (f'<div style="display: flex; gap: 14px"><span style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 11px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">{ic(icon, 18)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 16px; font-weight: 700">{t}</span><span style="font-size: 14px; line-height: 1.5; color: %%MUTED%%">{b}</span></span></div>')


def audience(eyebrow, color, title, intro, points, visual, reverse=False, bg="transparent"):
    text = (f'<div style="width: 420px; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px">'
            f'<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.16em; color: {color}">{eyebrow}</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 38px; line-height: 1.1; font-weight: 600; letter-spacing: -0.015em">{title}</h2>'
            f'<p style="margin: 0; font-size: 16px; line-height: 1.6; color: %%INK2%%">{intro}</p>'
            f'<div style="display: flex; flex-direction: column; gap: 16px; padding-top: 6px">{points}</div></div>')
    vis = f'<div style="flex-grow: 1; display: flex; justify-content: center">{visual}</div>'
    parts = vis + text if reverse else text + vis
    return f'<section style="padding: 96px {PAD}px; background: {bg}; display: flex; align-items: center; gap: 64px">{parts}</section>'


def for_coaches():
    pts = (point("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN%%", "Build sessions by dragging", "Pick exercises from the library — each with a video — and set sets, reps, weight and rest.")
           + point("copy", "%%TRAIN_SOFT%%", "%%TRAIN%%", "Templates you reuse", "Save a session or a whole plan and give it to the next client in one click.")
           + point("activity", "%%DANGER_SOFT%%", "%%MARKER%%", "Watch it happen", "Your client logs every set during the workout. You see what they lifted, and how it felt."))
    return audience("FOR COACHES", "%%TRAIN%%", "Training plans your clients actually follow",
                    "Plan the week in the portal. On the gym floor, your client has every exercise, video and weight on their phone.", pts, coach_visual())


def for_nutritionists():
    pts = (point("calendar", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Meal plans by the week", "Fill the week from your recipes and ingredients. Publish only the weeks that are finished.")
           + point("sliders", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Macros at a glance", "Every meal shows if it is on target, over or under — before your client ever sees it.")
           + point("users", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Work alongside the trainer", "A client can have a nutritionist and a coach. Each of you owns your own plan."))
    return audience("FOR NUTRITIONISTS", "%%NUTRI%%", "Meal plans that add up",
                    "Recipes, ingredients and targets in one place. Your client gets the plan and a shopping list for the week.", pts, nutri_visual(), reverse=True, bg="%%SURFACE%%")


def client_app():
    head = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center">'
            f'<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.16em; color: %%MARKER%%">THE CLIENT APP</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 38px; font-weight: 600; letter-spacing: -0.015em">What your client gets</h2>'
            f'<p style="margin: 0; max-width: 620px; font-size: 16px; line-height: 1.6; color: %%INK2%%">A calm app for iOS and Android: today’s meals and workouts to tick off, a chat with you, and a short check-in every Sunday.</p>'
            f'<div style="display: flex; gap: 10px">{btn("App Store", "outline", "apple", 40)}{btn("Google Play", "outline", "play", 40)}</div></div>')
    caps = "".join(f'<span style="width: 250px; text-align: center; font-size: 13px; color: %%MUTED%%">{c}</span>' for c in ("Today: meals and workouts", "Chat with the coach", "Sunday check-in"))
    return (f'<section style="padding: 96px {PAD}px 80px; display: flex; flex-direction: column; align-items: center; gap: 48px">{head}{client_visual()}'
            f'<div style="display: flex; gap: 34px; margin-top: -24px">{caps}</div></section>')
