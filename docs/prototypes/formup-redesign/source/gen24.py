"""Web entry page v2: a landing page with a live product demo; sign-in moves to the top bar and opens a dialog."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
__file__ = os.path.join(HERE, "gen23.py")
exec(open(__file__).read().split("VARIANTS = [")[0])

PATHS.update({
    "grip": '<circle cx="9" cy="6" r="1.2"></circle><circle cx="15" cy="6" r="1.2"></circle><circle cx="9" cy="12" r="1.2"></circle><circle cx="15" cy="12" r="1.2"></circle><circle cx="9" cy="18" r="1.2"></circle><circle cx="15" cy="18" r="1.2"></circle>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path>',
    "sliders": '<path d="M4 7h10"></path><path d="M18 7h2"></path><circle cx="16" cy="7" r="2"></circle><path d="M4 17h4"></path><path d="M12 17h8"></path><circle cx="10" cy="17" r="2"></circle>',
    "minus": '<path d="M5 12h14"></path>',
    "undo": '<path d="M9 14L4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 0 10h-3"></path>',
})
HOME_H = 4010
PAD = 64


def wash():
    if DARK_ON:
        return ("radial-gradient(700px 520px at 78% 30%, rgba(242,140,56,0.20), transparent 70%), "
                "radial-gradient(620px 520px at 98% 90%, rgba(140,193,82,0.16), transparent 70%), "
                "radial-gradient(520px 420px at 0% 0%, rgba(229,72,61,0.10), transparent 70%), %%GROUND%%")
    return ("radial-gradient(700px 520px at 78% 30%, #FFE7D3, transparent 70%), "
            "radial-gradient(620px 520px at 98% 90%, #E4F2D3, transparent 70%), "
            "radial-gradient(520px 420px at 0% 0%, #FDE4E1, transparent 70%), %%GROUND%%")


# ---------------------------------------------------------------- top bar
def topbar(d):
    link = lambda l: f'<a href="#" style="font-size: 14px; font-weight: 500; color: %%INK2%%; text-decoration: none">{l}</a>'
    return (f'<header style="height: 76px; padding: 0 {PAD}px; display: flex; align-items: center; gap: 36px">'
            f'<div>{logo(d, bool(DARK_ON), 20)}</div>'
            f'<nav style="display: flex; gap: 28px; margin-left: 24px">{link("How it works")}{link("For coaches")}{link("For nutritionists")}{link("Mobile app")}</nav>'
            f'<div style="margin-left: auto; display: flex; align-items: center; gap: 10px">'
            f'<a href="#" style="height: 40px; padding: 0 16px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; text-decoration: none; font-size: 14px; font-weight: 600; display: flex; align-items: center">Sign in</a>'
            f'<a href="#" style="height: 40px; padding: 0 18px; border-radius: 10px; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; text-decoration: none; font-size: 14px; font-weight: 700; display: flex; align-items: center">Create account</a>'
            f'</div></header>')


# ---------------------------------------------------------------- hero stage (frozen at "Publish")
def notif_banner():
    return ('<div style="position: absolute; left: 612px; top: 52px; width: 246px; box-sizing: border-box; border-radius: 16px; padding: 10px 12px; '
            'background: #1E1E20; color: #F4F2EE; box-shadow: 0 12px 30px rgba(0,0,0,0.3); display: flex; gap: 10px; align-items: flex-start">'
            '<span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 7px; background: #141414; border: 1px solid #333; display: flex; align-items: center; justify-content: center; '
            'font: 600 9px Outfit, sans-serif; color: #E5483D">FU</span>'
            '<span style="display: flex; flex-direction: column; gap: 2px; font-size: 11px; line-height: 1.35"><span style="display: flex; font-weight: 700">Form Up<span style="margin-left: auto; font-weight: 400; opacity: 0.6">now</span></span>'
            '<span>Jan updated Thursday’s lunch — Chicken bowl, 640 kcal</span></span></div>')


def checkin_toast():
    thumbs = "".join(f'<span style="width: 26px; height: 34px; border-radius: 6px; background: {c}"></span>' for c in ("#D9C2AE", "#C9B29E", "#BFA48E"))
    return ('<div style="position: absolute; left: 24px; top: 470px; width: 330px; box-sizing: border-box; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; '
            'box-shadow: 0 18px 40px rgba(0,0,0,0.16); padding: 12px 14px; display: flex; align-items: center; gap: 12px">'
            f'<span style="width: 34px; height: 34px; border-radius: 17px; background: %%MARKER%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("activity", 17)}</span>'
            '<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 700">Petra sent her check-in</span><span style="font-size: 11px; color: %%MUTED%%">68.4 kg · −0.6 kg this week · energy 4/5</span></span>'
            f'<span style="margin-left: auto; display: flex; gap: 4px">{thumbs}</span></div>')


def steps_bar(active=1):
    labels = [("Build", "Drag a recipe into the day"), ("Publish", "One click — it’s on their phone"), ("They follow", "Meals and workouts ticked off"), ("You see it", "Check-ins come to you")]
    out = ""
    for i, (a, b) in enumerate(labels):
        on = i == active
        fill = "100%" if i < active else ("55%" if on else "0%")
        out += (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 6px">'
                f'<div style="height: 3px; border-radius: 2px; background: %%LINE%%"><div style="width: {fill}; height: 3px; border-radius: 2px; background: {"%%MARKER%%" if on else "%%INK%%"}"></div></div>'
                f'<span style="font-size: 13px; font-weight: 700; color: {"%%INK%%" if i <= active else "%%MUTED%%"}">{i + 1} · {a}</span>'
                f'<span style="font-size: 12px; color: %%MUTED%%">{b}</span></div>')
    return f'<div style="display: flex; gap: 18px; width: 766px">{out}</div>'


def hero_stage():
    connector = ('<svg width="872" height="600" style="position: absolute; left: 0; top: 0; pointer-events: none" aria-hidden="true">'
                 '<path d="M552 316C580 316 588 300 618 300" fill="none" stroke="%%MARKER%%" stroke-width="2" stroke-dasharray="4 4"></path>'
                 '<circle cx="552" cy="316" r="4" fill="%%MARKER%%"></circle></svg>')
    inner = f'<div style="position: relative; width: 872px; height: 560px; transform: scale(0.88); transform-origin: 0 0">{mini_editor()}{phone_today()}{connector}{notif_banner()}{checkin_toast()}</div>'
    return f'<div style="display: flex; flex-direction: column; gap: 22px"><div style="width: 768px; height: 494px">{inner}</div>{steps_bar(1)}</div>'


def hero(d):
    note = f'<span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: %%MUTED%%">{ic("users", 15)}Web portal for planning, mobile app for you and your clients.</span>'
    left = (f'<div style="width: 470px; flex-shrink: 0; display: flex; flex-direction: column; gap: 22px; padding-top: 34px">'
            f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">FOR PERSONAL TRAINERS AND NUTRITIONISTS</span>'
            f'<h1 style="margin: 0; {DISP}; font-size: 56px; line-height: 1.04; font-weight: 600; letter-spacing: -0.025em">Your clients, out of spreadsheets <span style="color: %%MARKER%%">and WhatsApp.</span></h1>'
            f'<p style="margin: 0; font-size: 17px; line-height: 1.6; color: %%INK2%%">Build meal and training plans on the web. Your clients follow them on their phone, tick off every meal and workout, and send you a check-in each week.</p>'
            f'<div style="display: flex; gap: 10px; padding-top: 6px">'
            f'<a href="#" style="height: 50px; padding: 0 24px; border-radius: 12px; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; text-decoration: none; font-size: 15px; font-weight: 700; display: flex; align-items: center">Create account</a>'
            f'<a href="#" style="height: 50px; padding: 0 20px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; text-decoration: none; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px">{ic("play", 14)}See it in action</a></div>'
            f'{note}</div>')
    return f'<section style="height: 724px; padding: 24px {PAD}px 0; box-sizing: border-box; display: flex; gap: 46px">{left}{hero_stage()}</section>'


# ---------------------------------------------------------------- how it works: the four frames of the demo loop
def vignette_build():
    cell = lambda n, k: f'<div style="height: 54px; border-radius: 9px; border: 1px solid %%LINE%%; background: %%SURFACE%%; padding: 7px 9px; box-sizing: border-box; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 600">{n}</span><span style="font-size: 10px; color: %%MUTED%%">{k} kcal</span></div>'
    drop = '<div style="height: 54px; border-radius: 9px; border: 1.5px dashed %%NUTRI%%; background: %%NUTRI_SOFT%%"></div>'
    ghost = ('<div style="position: absolute; left: 118px; top: 74px; width: 140px; transform: rotate(-4deg); border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 12px 26px rgba(0,0,0,0.2); padding: 8px 10px; display: flex; gap: 8px; align-items: center">'
             '<span style="width: 26px; height: 26px; border-radius: 7px; background: #F2C9B1"></span><span style="display: flex; flex-direction: column"><span style="font-size: 11px; font-weight: 700">Chicken bowl</span><span style="font-size: 10px; color: %%MUTED%%">640 kcal</span></span></div>')
    cursor = '<svg width="18" height="22" viewBox="0 0 18 22" style="position: absolute; left: 236px; top: 112px" aria-hidden="true"><path d="M2 2L2 18L6.5 13.5L9.5 20L12 19L9 12.5L15 12.5Z" fill="#141414" stroke="#FFFFFF" stroke-width="1.4"></path></svg>'
    return f'<div style="position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">{cell("Oat bowl", 420)}{cell("Egg toast", 460)}{cell("Lentil curry", 560)}{drop}{ghost}{cursor}</div>'


def vignette_publish():
    return ('<div style="display: flex; align-items: center; gap: 14px">'
            '<div style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1"><span style="font-size: 11px; color: %%MUTED%%">Week 5 · 7 days ready</span>'
            '<span style="height: 40px; border-radius: 10px; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Publish week 5</span></div>'
            f'<span style="color: %%MARKER%%">{ic("chevron", 20)}</span>'
            '<div style="width: 78px; height: 118px; border-radius: 18px; border: 4px solid %%INK%%; box-sizing: border-box; padding: 8px 6px; display: flex; flex-direction: column; gap: 5px">'
            '<span style="height: 20px; border-radius: 6px; background: %%MARKER%%"></span><span style="height: 8px; border-radius: 3px; background: %%LINE%%"></span>'
            '<span style="height: 8px; border-radius: 3px; background: %%LINE%%; width: 70%"></span><span style="height: 8px; border-radius: 3px; background: %%LINE%%"></span></div></div>')


def vignette_follow():
    row = lambda m, n, k, done: (f'<div style="display: flex; align-items: center; gap: 9px; padding: 7px 0; border-top: 1px solid %%LINE%%">'
                                 + (f'<span style="width: 18px; height: 18px; border-radius: 9px; background: %%NUTRI%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 11, sw="2.8")}</span>' if done
                                    else '<span style="width: 16px; height: 16px; border-radius: 9px; border: 1.5px solid %%MUTED%%"></span>')
                                 + f'<span style="display: flex; flex-direction: column"><span style="font-size: 10px; color: %%MUTED%%">{m}</span><span style="font-size: 12px; font-weight: 600">{n}</span></span><span style="margin-left: auto; font-size: 11px; color: %%MUTED%%">{k}</span></div>')
    return (f'<div style="display: flex; flex-direction: column">{row("Breakfast", "Egg toast", 460, True)}{row("Lunch", "Chicken bowl", 640, True)}{row("Dinner", "Beef stir-fry", 590, False)}'
            f'<div style="display: flex; align-items: center; gap: 8px; padding-top: 8px; font-size: 11px; color: %%MUTED%%"><span style="flex-grow: 1">{split(4)}</span>1,100 / 2,100 kcal</div></div>')


def vignette_checkin():
    thumbs = "".join(f'<span style="flex-grow: 1; height: 58px; border-radius: 8px; background: {c}"></span>' for c in ("#D9C2AE", "#C9B29E", "#BFA48E"))
    return ('<div style="display: flex; flex-direction: column; gap: 10px">'
            '<div style="display: flex; align-items: baseline; gap: 8px"><span style="font-family: Outfit, sans-serif; font-size: 26px; font-weight: 600">68.4</span><span style="font-size: 12px; color: %%MUTED%%">kg</span>'
            '<span style="margin-left: auto; padding: 3px 8px; border-radius: 6px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 11px; font-weight: 700">−0.6 kg</span></div>'
            f'<div style="display: flex; gap: 6px">{thumbs}</div>'
            '<span style="font-size: 11px; color: %%MUTED%%">Energy 4/5 · sleep 7 h · “Legs felt heavy on Friday.”</span></div>')


def how_it_works():
    cards = [("1", "Build", "Drag recipes and exercises into the week. Macros add up as you go.", vignette_build()),
             ("2", "Publish", "Finished weeks go to your client’s phone in one click. Drafts stay hidden.", vignette_publish()),
             ("3", "They follow", "Your client ticks off meals and workouts. You see it as it happens.", vignette_follow()),
             ("4", "You see it", "Every Sunday the check-in arrives: weight, photos and how the week felt.", vignette_checkin())]
    out = ""
    for n, title, text, vis in cards:
        out += (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 14px">'
                f'<div style="height: 196px; box-sizing: border-box; border-radius: 18px; border: 1px solid %%LINE%%; background: %%GROUND%%; padding: 20px; display: flex; flex-direction: column; justify-content: center">{vis}</div>'
                f'<div style="display: flex; align-items: baseline; gap: 10px"><span style="{DISP}; font-size: 15px; font-weight: 600; color: %%MARKER%%">{n}</span><span style="{DISP}; font-size: 20px; font-weight: 600">{title}</span></div>'
                f'<span style="font-size: 14px; line-height: 1.55; color: %%MUTED%%">{text}</span></div>')
    return (f'<section style="padding: 80px {PAD}px; background: %%SURFACE%%; border-top: 1px solid %%LINE%%; border-bottom: 1px solid %%LINE%%; display: flex; flex-direction: column; gap: 36px">'
            f'<div style="display: flex; flex-direction: column; gap: 10px"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">HOW IT WORKS</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 38px; font-weight: 600; letter-spacing: -0.015em">One week with a client, in four moments</h2></div>'
            f'<div style="display: flex; gap: 22px">{out}</div></section>')


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
    ghost = ('<div style="position: absolute; left: 330px; top: 128px; width: 190px; transform: rotate(-3deg); display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 14px 30px rgba(0,0,0,0.22)">'
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
    shop = ('<div style="position: absolute; left: -36px; top: calc(100% - 34px); width: 250px; box-sizing: border-box; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 18px 40px rgba(0,0,0,0.18); padding: 12px 14px; display: flex; flex-direction: column">'
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


def audience(eyebrow, color, title, intro, points, visual, reverse=False, bg="transparent", pad_bottom=96):
    text = (f'<div style="width: 420px; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px">'
            f'<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.16em; color: {color}">{eyebrow}</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 38px; line-height: 1.1; font-weight: 600; letter-spacing: -0.015em">{title}</h2>'
            f'<p style="margin: 0; font-size: 16px; line-height: 1.6; color: %%INK2%%">{intro}</p>'
            f'<div style="display: flex; flex-direction: column; gap: 16px; padding-top: 6px">{points}</div></div>')
    vis = f'<div style="flex-grow: 1; display: flex; justify-content: center">{visual}</div>'
    parts = vis + text if reverse else text + vis
    return f'<section style="padding: 96px {PAD}px {pad_bottom}px; background: {bg}; display: flex; align-items: center; gap: 64px">{parts}</section>'


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
                    "Recipes, ingredients and targets in one place. Your client gets the plan and a shopping list for the week.", pts, nutri_visual(), reverse=True, bg="%%SURFACE%%", pad_bottom=200)


def phone_coach_clients():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    row = lambda n, c, status, tone: (f'<div style="display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-top: 1px solid rgba(127,127,127,0.18)">'
                                      f'<span style="width: 32px; height: 32px; border-radius: 16px; background: {c}"></span>'
                                      f'<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 13px; font-weight: 600">{n}</span><span style="font-size: 11px; color: {tone}">{status}</span></span></div>')
    inner = (f'<div style="padding: 4px 6px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Coach · 12 clients</span><span style="{DISP}; font-size: 20px; font-weight: 600">Clients</span></div>'
             + glass_card(f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: %%MARKER%%">NEEDS YOU · 2</span>'
                          + row("Petra N.", "#C9B29E", "Check-in waiting", "%%MARKER%%") + row("Tomáš K.", "#B7C4CF", "Missed 2 meals", "%%TRAIN%%"), "10px 12px")
             + glass_card(f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: {muted}">ON TRACK</span>'
                          + row("Eva M.", "#C6C9B0", "Workout done · 52 min", "%%NUTRI%%") + row("Lukáš P.", "#D7A68E", "All meals today", "%%NUTRI%%"), "10px 12px"))
    return phone_shell(inner)


def phone_coach_review():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    pts = [(0, 40), (34, 34), (68, 30), (102, 26), (136, 20), (170, 14)]
    poly = " ".join(f"{x},{y}" for x, y in pts)
    graph = (f'<svg width="190" height="48" viewBox="0 0 190 48" aria-hidden="true"><polyline points="{poly}" fill="none" stroke="%%NUTRI%%" stroke-width="2.5" stroke-linejoin="round"></polyline>'
             + "".join(f'<circle cx="{x}" cy="{y}" r="2.6" fill="%%NUTRI%%"></circle>' for x, y in pts) + '</svg>')
    thumbs = "".join(f'<span style="flex-grow: 1; height: 54px; border-radius: 9px; background: {c}"></span>' for c in ("#D9C2AE", "#C9B29E", "#BFA48E"))
    inner = (f'<div style="padding: 4px 6px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Petra N. · week 5</span><span style="{DISP}; font-size: 20px; font-weight: 600">Check-in</span></div>'
             + glass_card(f'<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 24px; font-weight: 600">68.4</span><span style="font-size: 12px; color: {muted}">kg</span><span style="margin-left: auto; font-size: 11px; font-weight: 700; color: %%NUTRI%%">−2.1 in 6 weeks</span></div>{graph}', "10px 12px")
             + glass_card(f'<div style="display: flex; gap: 6px">{thumbs}</div><span style="display: block; padding-top: 8px; font-size: 11px; color: {muted}">“Legs felt heavy on Friday.” · energy 4/5</span>', "10px 12px")
             + f'<div style="margin-top: auto; display: flex; gap: 8px"><span style="flex-grow: 1; height: 40px; border-radius: 20px; border: 1px solid rgba(127,127,127,0.3); padding: 0 14px; display: flex; align-items: center; font-size: 12px; color: {muted}">Reply to Petra…</span>'
             f'<span style="width: 40px; height: 40px; border-radius: 20px; background: %%MARKER%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("arrowup", 16)}</span></div>')
    return phone_shell(inner, extra="; margin-top: 50px")


def phone_checkin_low():
    return phone_checkin().replace("margin-top: 80px", "margin-top: 50px")


def app_group(label, sub, phones, color, text="#FFFFFF"):
    return (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 18px">'
            f'<div style="display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="padding: 5px 12px; border-radius: 999px; background: {color}; color: {text}; font-size: 12px; font-weight: 700; letter-spacing: 0.06em">{label}</span>'
            f'<span style="font-size: 13px; color: %%MUTED%%">{sub}</span></div>'
            f'<div style="display: flex; gap: 26px; align-items: flex-start">{phones}</div></div>')


def client_app():
    head = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center">'
            f'<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.16em; color: %%MARKER%%">THE MOBILE APP</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 38px; font-weight: 600; letter-spacing: -0.015em">One app for your clients — and for you</h2>'
            f'<p style="margin: 0; max-width: 680px; font-size: 16px; line-height: 1.6; color: %%INK2%%">For your clients, the app is where everything happens: today’s meals and workouts, the chat with you and the Sunday check-in. '
            f'You get the same app with a coach view — see who needs you, review check-ins and reply from anywhere.</p>'
            f'<div style="display: flex; gap: 10px">{btn("App Store", "outline", "apple", 40)}{btn("Google Play", "outline", "play", 40)}</div></div>')
    clients = app_group("YOUR CLIENTS", "Their main tool, every day", phone_today_static() + phone_checkin_low(), "%%INK%%", "%%SURFACE%%")
    coach = app_group("YOU", "Your clients in your pocket", phone_coach_clients() + phone_coach_review(), "%%MARKER%%")
    return (f'<section style="padding: 96px {PAD}px 90px; display: flex; flex-direction: column; align-items: center; gap: 48px">{head}'
            f'<div style="display: flex; gap: 56px; align-items: flex-start">{clients}<span style="width: 1px; align-self: stretch; background: %%LINE%%"></span>{coach}</div></section>')


# ---------------------------------------------------------------- benefits + community band + footer
def benefits():
    item = lambda icon, bg, fg, t, b: (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; gap: 16px">'
                                       f'<span style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">{ic(icon, 21)}</span>'
                                       f'<span style="display: flex; flex-direction: column; gap: 6px"><span style="{DISP}; font-size: 19px; font-weight: 600">{t}</span><span style="font-size: 14px; line-height: 1.55; color: %%MUTED%%">{b}</span></span></div>')
    return (f'<section style="padding: 80px {PAD}px 40px; display: flex; gap: 40px">'
            f'{item("leaf", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Nutrition and training together", "A nutritionist and a trainer can work on the same client — each in their own plan.")}'
            f'{item("calendar", "%%TRAIN_SOFT%%", "%%TRAIN%%", "Reuse what works", "Save a week, a meal or a session as a template and use it for the next client.")}'
            f'{item("chat", "%%DANGER_SOFT%%", "%%MARKER%%", "One place to talk", "Chat with clients in the app — no more lost messages in WhatsApp.")}</section>')


def community_band():
    return (f'<section style="padding: 0 {PAD}px">'
            f'<div style="border-radius: 24px; background: %%SIDEBAR%%; border: 1px solid %%LINE%%; padding: 48px 52px; display: flex; align-items: center; gap: 32px">'
            f'<div style="display: flex; flex-direction: column; gap: 10px"><span style="{DISP}; font-size: 34px; font-weight: 600; color: %%SIDEBAR_TEXT%%">Join our community of coaches and nutritionists</span>'
            f'<span style="font-size: 15px; color: %%SIDEBAR_MUTED%%">Set up your account, invite your first client and build their first week this afternoon.</span></div>'
            f'<a href="#" style="margin-left: auto; height: 52px; padding: 0 26px; border-radius: 12px; background: %%MARKER%%; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; display: flex; align-items: center; white-space: nowrap">Create account</a></div></section>')


def site_footer():
    return (f'<footer style="padding: 36px {PAD}px; display: flex; align-items: center; gap: 24px; font-size: 13px; color: %%MUTED%%">'
            f'<span>© 2026 Form Up</span><span style="margin-left: auto">Get the Form Up app:</span>{btn("App Store", "outline", "apple", 34)}{btn("Google Play", "outline", "play", 34)}'
            f'<span style="display: flex; gap: 6px; margin-left: 12px">' + "".join(f'<span style="padding: 4px 8px; border-radius: 6px; border: 1px solid %%LINE%%; font-size: 11px; font-weight: 600; {"background: %%INK%%; color: %%SURFACE%%;" if l == "EN" else ""}">{l}</span>' for l in ("CS", "EN", "DE")) + '</span></footer>')


def home(d, t):
    top = f'<div style="background: {wash()}">{topbar(d)}{hero(d)}</div>'
    body = f'<div style="width: {W}px; height: {HOME_H}px; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">{top}{how_it_works()}{for_coaches()}{for_nutritionists()}{client_app()}{community_band()}{site_footer()}</div>'
    return page(f"Home {d}", W, HOME_H, body, t)


# ---------------------------------------------------------------- sign-in dialog over the first screen
def signin_dialog(d, t):
    inp = lambda label, ph, tail="": f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%">{label}<span style="height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; font-size: 14px; color: %%MUTED%%">{ph}{tail}</span></label>'
    dialog = f'''<div role="dialog" aria-label="Sign in" style="position: absolute; left: 50%; top: 104px; width: 440px; margin-left: -220px; box-sizing: border-box; border-radius: 20px; background: %%SURFACE%%; border: 1px solid %%LINE%%; box-shadow: 0 30px 80px rgba(0,0,0,0.35); padding: 28px 32px; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; align-items: flex-start"><div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 26px; font-weight: 600">Welcome back</span><span style="font-size: 13px; color: %%MUTED%%">Sign in to the coach portal.</span></div>
<button aria-label="Close" style="margin-left: auto; width: 34px; height: 34px; border-radius: 17px; border: none; background: %%GROUND%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("x", 16)}</button></div>
{inp("Email", "coach@example.com")}
{inp("Password", "••••••••", '<span style="margin-left: auto; font-size: 12px; font-weight: 600; color: %%INK2%%">Show</span>')}
<div style="display: flex; align-items: center; font-size: 13px"><span style="display: flex; align-items: center; gap: 8px; color: %%INK2%%">{checkbox(True, "Keep me signed in")}Keep me signed in</span><a href="#" style="margin-left: auto; font-weight: 600; color: %%INK%%">Forgot password?</a></div>
<button style="height: 46px; border-radius: 12px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font: 700 15px 'DM Sans', sans-serif">Sign in</button>
<div style="display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.14em; color: %%MUTED%%"><span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span>OR<span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{btn("Google", "disabled", h=42, extra="; justify-content: center")}{btn("Apple", "disabled", "apple", 42, "; justify-content: center")}</div>
<span style="font-size: 13px; color: %%MUTED%%; text-align: center">New to Form Up? <a href="#" style="font-weight: 700; color: %%INK%%">Create account</a></span>
</div>'''
    scrim = '<div style="position: absolute; inset: 0; background: rgba(10,10,11,0.45); backdrop-filter: blur(3px)"></div>'
    first = f'<div style="background: {wash()}">{topbar(d)}{hero(d)}</div>'
    body = f'<div style="position: relative; width: {W}px; height: {H}px; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">{first}{scrim}{dialog}</div>'
    return page(f"Home sign in {d}", W, H, body, t)


for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = t["BOLD"]
    DARK_ON = t["DARK"]
    for name, fn in (("PageHome", home), ("PageHomeSignIn", signin_dialog)):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(fn(d, t))
print("ok")
