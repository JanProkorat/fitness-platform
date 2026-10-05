"""Web sign-in: four alternatives for the left half (the sign-in form on the right stays as it is)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen2.py")).read().split("# ---------------------------------------------------------------- canvas")[0]
exec(_src)

LW = W - 440


# ---------------------------------------------------------------- shared right half (unchanged form)
def signin_aside():
    inp = lambda label, ph, tail="": f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%">{label}<span style="height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; font-size: 14px; color: %%MUTED%%">{ph}{tail}</span></label>'
    lang = lambda l, on: f'<button style="height: 28px; padding: 0 9px; border-radius: 6px; border: 1px solid {"%%INK%%" if on else "%%LINE%%"}; background: {"%%INK%%" if on else "transparent"}; color: {"%%SURFACE%%" if on else "%%MUTED%%"}; font: 600 11px \'DM Sans\', sans-serif">{l}</button>'
    return f'''<aside style="width: 440px; flex-shrink: 0; background: %%SURFACE%%; border-left: 1px solid %%LINE%%; box-sizing: border-box">
<div style="height: {H}px; padding: 40px 44px 32px; box-sizing: border-box; display: flex; flex-direction: column">
<h2 style="margin: 0; {DISP}; font-size: 22px; font-weight: 500; line-height: 1.3; color: %%INK2%%">Join our community of coaches and nutritionists</h2>
<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 26px; font-weight: 600">Welcome back</span><span style="font-size: 13px; color: %%MUTED%%">Sign in to the coach portal.</span></div>
{inp("Email", "coach@example.com")}
{inp("Password", "••••••••", '<span style="margin-left: auto; font-size: 12px; font-weight: 600; color: %%INK2%%">Show</span>')}
<div style="display: flex; align-items: center; font-size: 13px"><span style="display: flex; align-items: center; gap: 8px; color: %%INK2%%">{checkbox(True, "Keep me signed in")}Keep me signed in</span><a href="#" style="margin-left: auto; font-weight: 600; color: %%INK%%">Forgot password?</a></div>
<button style="height: 46px; border-radius: 12px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font: 700 15px 'DM Sans', sans-serif">Sign in</button>
<div style="display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.14em; color: %%MUTED%%"><span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span>OR<span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{btn("Google", "disabled", h=42, extra="; justify-content: center")}{btn("Apple", "disabled", "apple", 42, "; justify-content: center")}</div>
<div style="border-radius: 12px; background: %%GROUND%%; border: 1px solid %%LINE%%; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; line-height: 1.5; color: %%MUTED%%"><span><span style="font-weight: 700; color: %%INK%%">Looking for a coach or nutritionist?</span> Download our mobile app and join today.</span><div style="display: flex; gap: 8px">{btn("App Store", "outline", "apple", 32)}{btn("Google Play", "outline", "play", 32)}</div></div>
<span style="font-size: 13px; color: %%MUTED%%">No account yet? <a href="#" style="font-weight: 700; color: %%INK%%">Create a coach account</a></span>
</div>
<div style="display: flex; gap: 6px">{lang("CS", False)}{lang("EN", True)}{lang("DE", False)}</div>
</div>
</aside>'''


def frame(d, t, left, title):
    body = f'<div style="width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">{left}{signin_aside()}</div>'
    return page(f"{title} {d}", W, H, body, t)


def left_wrap(d, inner, extra_style="", show_logo=True):
    return (f'<div style="position: relative; width: {LW}px; flex-shrink: 0; height: {H}px; padding: 40px 64px 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px; {extra_style}">'
            + (f'<div>{logo(d, bool(DARK_ON), 22)}</div>' if show_logo else '') + f'{inner}</div>')


def foot():
    return '<div style="margin-top: auto; display: flex; font-size: 12px; color: %%MUTED%%"><span>© 2026 Form Up</span><span style="margin-left: auto">Coach portal · Client app for iOS and Android</span></div>'


def split(h=4):
    return (f'<div style="display: flex; gap: 2px; height: {h}px"><span style="flex: 25; border-radius: 2px; background: %%PROT%%"></span>'
            f'<span style="flex: 45; border-radius: 2px; background: %%CARB%%"></span><span style="flex: 30; border-radius: 2px; background: %%FAT%%"></span></div>')


# ---------------------------------------------------------------- 1 · coach and client side by side
MINI = {
    "Breakfast": [("Oat bowl", 420), ("Yogurt bowl", 380), ("Oat bowl", 420), ("Egg toast", 460)],
    "Snack": [("Apple, almonds", 210), ("Protein shake", 160), ("Yogurt, honey", 160), ("Apple, almonds", 210)],
    "Lunch": [("Lentil curry", 560), ("Tuna salad", 590), ("Lentil curry", 560), ("Chicken bowl", 640)],
    "Dinner": [("Salmon, potatoes", 610), ("Beef stir-fry", 590), ("Tofu noodles", 540), ("Beef stir-fry", 590)],
}


def mini_editor():
    head = '<span></span>' + "".join(f'<span style="font-size: 11px; font-weight: 600; color: %%MUTED%%; text-align: center">{x}</span>' for x in ("Mon", "Tue", "Wed", "Thu"))
    body = ""
    for row, cells in MINI.items():
        body += f'<span style="font-size: 11px; font-weight: 600; color: %%MUTED%%; align-self: center">{row}</span>'
        for i, (n, k) in enumerate(cells):
            hot = row == "Lunch" and i == 3
            ring = "border: 2px solid %%MARKER%%; box-shadow: 0 6px 18px rgba(210,52,42,0.25)" if hot else "border: 1px solid %%LINE%%"
            body += (f'<div style="height: 64px; box-sizing: border-box; border-radius: 10px; {ring}; background: %%SURFACE%%; padding: 8px; display: flex; flex-direction: column; gap: 3px">'
                     f'<span style="font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{n}</span>'
                     f'<span style="font-size: 10px; color: %%MUTED%%">{k} kcal</span><span style="margin-top: auto">{split(3)}</span></div>')
    return (f'<div style="position: absolute; left: 0; top: 54px; width: 560px; border-radius: 16px; border: 1px solid %%LINE%%; background: %%GROUND%%; box-shadow: 0 24px 60px rgba(0,0,0,0.14); overflow: hidden">'
            f'<div style="height: 40px; padding: 0 16px; border-bottom: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; gap: 6px">'
            + "".join(f'<span style="width: 9px; height: 9px; border-radius: 5px; background: %%LINE%%"></span>' for _ in range(3))
            + f'<span style="margin-left: 12px; font-size: 12px; font-weight: 600">Lean cut — 12 weeks</span><span style="font-size: 12px; color: %%MUTED%%">· Week 5</span>'
            f'<span style="margin-left: auto; padding: 3px 8px; border-radius: 6px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 10px; font-weight: 700; letter-spacing: 0.06em">PUBLISHED</span></div>'
            f'<div style="padding: 14px 16px 16px; display: grid; grid-template-columns: 70px repeat(4, minmax(0, 1fr)); gap: 8px">{head}{body}</div></div>')


def phone_today():
    dark = bool(DARK_ON)
    glass = "rgba(255,255,255,0.08)" if dark else "rgba(255,255,255,0.72)"
    wash = ("radial-gradient(260px 220px at 0% 0%, rgba(242,140,56,0.35), transparent 70%), radial-gradient(260px 260px at 100% 40%, rgba(140,193,82,0.28), transparent 70%), #0F0F10"
            if dark else "radial-gradient(260px 220px at 0% 0%, #FFE2C8, transparent 70%), radial-gradient(260px 260px at 100% 40%, #DDF0C8, transparent 70%), #F4F3EF")
    ink, muted = ("#F4F2EE", "#9A958D") if dark else ("#141414", "#6B6863")

    def row(meal, name, k, done, hot=False):
        mark = (f'<span style="width: 20px; height: 20px; border-radius: 10px; background: %%NUTRI%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.6")}</span>'
                if done else f'<span style="width: 18px; height: 18px; border-radius: 10px; border: 1.5px solid {muted}"></span>')
        ring = "border: 2px solid %%MARKER%%;" if hot else "border: 2px solid transparent;"
        return (f'<div style="height: 46px; box-sizing: border-box; padding: 0 10px; border-radius: 12px; {ring} display: flex; align-items: center; gap: 10px">{mark}'
                f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 10px; color: {muted}">{meal}</span><span style="font-size: 12px; font-weight: 600; color: {ink}; white-space: nowrap">{name}</span></span>'
                f'<span style="margin-left: auto; font-size: 11px; color: {muted}">{k}</span></div>')
    rows = row("Breakfast", "Egg toast", 460, True) + row("Snack", "Apple, almonds", 210, True) + row("Lunch", "Chicken bowl", 640, False, True) + row("Dinner", "Beef stir-fry", 590, False)
    return (f'<div style="position: absolute; left: 600px; top: 0; width: 270px; height: 500px; box-sizing: border-box; border-radius: 46px; border: 9px solid {"#2A2A2D" if dark else "#141414"}; background: {wash}; box-shadow: 0 30px 70px rgba(0,0,0,0.25); overflow: hidden; padding: 14px 14px; display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: {ink}; padding: 0 8px"><span>9:41</span><span style="width: 70px; height: 20px; border-radius: 10px; background: #000"></span><span>100%</span></div>'
            f'<div style="padding: 6px 6px 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Thursday, 2 Oct</span><span style="{DISP}; font-size: 21px; font-weight: 600; color: {ink}">Good morning, Petra</span></div>'
            f'<div style="border-radius: 20px; background: {glass}; border: 1px solid rgba(255,255,255,0.4); padding: 10px 6px 6px; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="padding: 0 10px 6px; font-size: 12px; font-weight: 700; color: {ink}; display: flex">Today’s meals<span style="margin-left: auto; font-weight: 500; color: {muted}">2 of 4</span></span>{rows}</div>'
            f'<div style="border-radius: 20px; background: {glass}; border: 1px solid rgba(255,255,255,0.4); padding: 12px 14px; display: flex; align-items: center; gap: 10px">'
            f'<span style="width: 34px; height: 34px; border-radius: 10px; background: %%TRAIN_SOFT%%; color: %%TRAIN%%; display: flex; align-items: center; justify-content: center">{ic("dumbbell", 18)}</span>'
            f'<span style="display: flex; flex-direction: column"><span style="font-size: 12px; font-weight: 600; color: {ink}">Upper body A</span><span style="font-size: 11px; color: {muted}">45 min · 6 exercises</span></span>'
            f'<span style="margin-left: auto; padding: 6px 10px; border-radius: 999px; background: %%TRAIN%%; color: #FFFFFF; font-size: 11px; font-weight: 700">Start</span></div></div>')


def left_side_by_side(d):
    connector = ('<svg width="872" height="600" style="position: absolute; left: 0; top: 0; pointer-events: none" aria-hidden="true">'
                 '<path d="M552 316C580 316 588 300 618 300" fill="none" stroke="%%MARKER%%" stroke-width="2" stroke-dasharray="4 4"></path>'
                 '<circle cx="552" cy="316" r="4" fill="%%MARKER%%"></circle></svg>')
    stage = f'<div style="position: relative; height: 560px">{mini_editor()}{phone_today()}{connector}</div>'
    inner = (f'<div style="display: flex; flex-direction: column; gap: 10px"><h1 style="margin: 0; {DISP}; font-size: 42px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em">Plan it on the web.<br><span style="color: %%MARKER%%">They live it on their phone.</span></h1>'
             f'<p style="margin: 0; font-size: 15px; color: %%MUTED%%">Change Thursday’s lunch in the portal — it’s on your client’s phone the moment you publish.</p></div>{stage}{foot()}')
    return left_wrap(d, inner)


# ---------------------------------------------------------------- 2 · a client's week
def left_timeline(d):
    def card(inner):
        return f'<div style="flex-grow: 1; border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; padding: 12px 14px; display: flex; align-items: center; gap: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.05)">{inner}</div>'

    def tile(icon, bg, fg):
        return f'<span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">{ic(icon, 18)}</span>'

    def text(a, b):
        return f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">{a}</span><span style="font-size: 12px; color: %%MUTED%%">{b}</span></span>'

    thumbs = "".join(f'<span style="width: 34px; height: 44px; border-radius: 7px; background: {c}"></span>' for c in ("#D9C2AE", "#C9B29E", "#BFA48E"))
    steps = [
        ("Mon", "You", "%%INK%%", card(tile("calendar", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%") + text("You publish week 5", "Meal plan and 3 training sessions")
                                         + '<span style="margin-left: auto; display: flex; gap: 6px"><span style="padding: 4px 8px; border-radius: 6px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 11px; font-weight: 700">Nutrition</span><span style="padding: 4px 8px; border-radius: 6px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; font-size: 11px; font-weight: 700">Training</span></span>')),
        ("Tue", "Petra", "%%TRAIN%%", card(tile("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN%%") + text("Petra finishes Upper body A", "42 min · 18 sets · felt strong")
                                            + f'<span style="margin-left: auto; width: 26px; height: 26px; border-radius: 13px; background: %%TRAIN%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="2.6")}</span>')),
        ("Thu", "Petra", "%%NUTRI%%", card(tile("utensils", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%") + text("Lunch logged — Chicken rice bowl", "640 kcal · day at 1,480 of 2,100")
                                            + f'<span style="margin-left: auto; width: 120px">{split(5)}</span>')),
        ("Sun", "Petra", "%%MARKER%%", card(tile("activity", "%%GROUND%%", "%%INK2%%") + text("Weekly check-in arrives", "68.4 kg · −0.6 kg · energy 4 of 5")
                                             + f'<span style="margin-left: auto; display: flex; gap: 4px">{thumbs}</span>')),
        ("Mon", "You", "%%INK%%", card(tile("chat", "%%GROUND%%", "%%INK2%%") + text("You reply and adjust week 6", "“Great week — I’ve added a fourth session.”"))),
    ]
    rows = ""
    for i, (day, who, color, c) in enumerate(steps):
        line = "" if i == len(steps) - 1 else '<span style="position: absolute; left: 50%; top: 26px; bottom: -22px; width: 2px; margin-left: -1px; background: %%LINE%%"></span>'
        rows += (f'<div style="display: grid; grid-template-columns: 64px 28px minmax(0, 1fr); gap: 12px; align-items: center">'
                 f'<span style="display: flex; flex-direction: column; align-items: flex-end"><span style="font-size: 14px; font-weight: 700">{day}</span><span style="font-size: 11px; color: %%MUTED%%">{who}</span></span>'
                 f'<span style="position: relative; height: 100%; display: flex; align-items: center; justify-content: center"><span style="position: relative; z-index: 1; width: 14px; height: 14px; border-radius: 7px; background: {color}; box-shadow: 0 0 0 4px %%GROUND%%"></span>{line}</span>{c}</div>')
    inner = (f'<div style="display: flex; flex-direction: column; gap: 10px; padding-top: 10px"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">ONE WEEK WITH A CLIENT</span>'
             f'<h1 style="margin: 0; {DISP}; font-size: 42px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em">You plan. They follow.<br><span style="color: %%MARKER%%">You both see it work.</span></h1></div>'
             f'<div style="display: flex; flex-direction: column; gap: 18px; max-width: 760px; padding-top: 8px">{rows}</div>{foot()}')
    return left_wrap(d, inner)


# ---------------------------------------------------------------- 3 · brand graphic
GLYPHS = {
    "F": (64, ["M0 3H64", "M3 100V48H56"]),
    "O": (100, ["M3 50A47 47 0 1 0 97 50A47 47 0 1 0 3 50"]),
    "R": (70, ["M3 100V3H42A24 24 0 0 1 42 51H3", "M36 51L68 100"]),
    "M": (90, ["M3 100V3L45 90L87 3V100"]),
    "U": (72, ["M3 0V64A33 33 0 0 0 69 64V0"]),
    "P": (68, ["M3 100V3H42A24 24 0 0 1 42 51H3"]),
}


def thin_word(word, color, x, sw=4):
    out = ""
    for ch in word:
        w, p = GLYPHS[ch]
        out += f'<path d="{" ".join(p)}" transform="translate({x} 0)" fill="none" stroke="{color}" stroke-width="{sw}" stroke-miterlimit="10"></path>'
        x += w + 26
    return out, x - 26


def left_brand(d):
    a, x = thin_word("FORM", "%%INK%%", 0)
    b, x = thin_word("UP", "%%MARKER%%", x + 60)
    line = ('<path d="M0 236H560" fill="none" stroke="%%INK%%" stroke-width="2.5"></path>'
            '<path d="M560 236L700 220L842 26" fill="none" stroke="%%MARKER%%" stroke-width="2.5" stroke-linejoin="round"></path>'
            '<path d="M824 32L842 26L847 44" fill="none" stroke="%%MARKER%%" stroke-width="2.5"></path>'
            '<circle cx="700" cy="220" r="4.5" fill="%%MARKER%%"></circle>')
    art = f'<svg width="872" height="250" viewBox="-2 -2 874 252" aria-hidden="true"><g transform="translate(0 110)">{a}{b}</g>{line}</svg>'
    dot = lambda c, l: f'<span style="display: inline-flex; align-items: center; gap: 8px"><span style="width: 7px; height: 7px; border-radius: 4px; background: {c}"></span>{l}</span>'
    inner = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 30px">{art}'
             f'<span style="{DISP}; font-size: 22px; font-weight: 300; letter-spacing: 0.02em; color: %%INK2%%">Plan it. Track it. Move up.</span>'
             f'<div style="display: flex; gap: 22px; font-size: 13px; color: %%MUTED%%">{dot("%%NUTRI%%", "Meal plans")}{dot("%%TRAIN%%", "Training plans")}{dot("%%MARKER%%", "Weekly check-ins")}</div></div>{foot()}')
    return left_wrap(d, inner, show_logo=False)


# ---------------------------------------------------------------- 4 · full-bleed photo
def left_photo(d):
    photo = ("radial-gradient(520px 600px at 72% 38%, rgba(214,150,96,0.55), transparent 70%), radial-gradient(380px 380px at 30% 80%, rgba(120,70,40,0.45), transparent 70%), "
             "linear-gradient(160deg, #2B211B 0%, #141110 55%, #0B0B0C 100%)")
    shade = "linear-gradient(90deg, rgba(10,10,11,0.82) 0%, rgba(10,10,11,0.35) 60%, rgba(10,10,11,0.15) 100%)"
    toast = (f'<div style="position: absolute; right: 56px; top: 330px; width: 300px; border-radius: 18px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22); backdrop-filter: blur(14px); padding: 14px 16px; display: flex; align-items: center; gap: 12px; color: #F4F2EE">'
             f'<span style="width: 34px; height: 34px; border-radius: 17px; background: %%TRAIN%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 16, sw="2.6")}</span>'
             f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 600">Petra finished Upper body A</span><span style="font-size: 11px; color: rgba(244,242,238,0.7)">just now · 42 min · new best on bench</span></span></div>')
    note = ('<span style="position: absolute; right: 24px; bottom: 64px; padding: 6px 10px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.35); font-size: 11px; color: rgba(255,255,255,0.65)">'
            'Placeholder — photo of an athlete mid-lift, warm side light</span>')
    word = logo(d, True, 22)
    inner = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 18px; padding-bottom: 70px; color: #F4F2EE">'
             f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: rgba(244,242,238,0.7)">FOR COACHES AND NUTRITIONISTS</span>'
             f'<h1 style="margin: 0; {DISP}; font-size: 64px; line-height: 1.02; font-weight: 600; letter-spacing: -0.02em">Your clients.<br>Moving up.</h1>'
             f'<svg width="360" height="40" viewBox="0 0 360 40" aria-hidden="true"><path d="M0 34H220" stroke="#F4F2EE" stroke-width="2" fill="none"></path><path d="M220 34L300 26L340 4" stroke="%%MARKER%%" stroke-width="2" fill="none"></path></svg>'
             f'<p style="margin: 0; max-width: 470px; font-size: 16px; line-height: 1.55; color: rgba(244,242,238,0.8)">Meal plans, training and weekly check-ins in one place — on the web for you, on the phone for them.</p></div>'
             '<div style="display: flex; font-size: 12px; color: rgba(244,242,238,0.6)"><span>© 2026 Form Up</span><span style="margin-left: auto">Coach portal · Client app for iOS and Android</span></div>')
    return (f'<div style="position: relative; width: {LW}px; flex-shrink: 0; height: {H}px; padding: 40px 64px 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px; background: {shade}, {photo}">'
            f'<div>{word}</div>{toast}{note}{inner}</div>')


VARIANTS = [
    ("PageLogin1", "Login 1", left_side_by_side),
    ("PageLogin2", "Login 2", left_timeline),
    ("PageLogin3", "Login 3", left_brand),
    ("PageLogin4", "Login 4", left_photo),
]
for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = t["BOLD"]
    DARK_ON = t["DARK"]
    for name, title, fn in VARIANTS:
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(frame(d, t, fn(d), title))
print("ok")
