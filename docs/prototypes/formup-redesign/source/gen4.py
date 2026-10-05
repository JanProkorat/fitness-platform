import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen3.py")).read().split("# ---------------------------------------------------------------- canvas")[0]
exec(_src)
PATHS.update({
    "camera": '<path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z"></path><circle cx="12" cy="13.2" r="3.4"></circle>',
    "minus": '<path d="M5 12h14"></path>',
    "mail": '<rect x="3.5" y="5.5" width="17" height="13" rx="2"></rect><path d="M4 7l8 6 8-6"></path>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>',
    "apple": '<path d="M15.5 4c-.3 1.6-1.6 2.9-3.1 2.8.1-1.5 1.5-2.8 3.1-2.8z"></path><path d="M17.5 12.8c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-1 2.3-2 .7-1 1-2 1-2.1 0 0-1.6-.6-1.6-3.2z"></path>',
    "g": '<path d="M20 12.2c0-.6 0-1.1-.1-1.7H12v3.3h4.5a3.9 3.9 0 0 1-1.7 2.5v2.1h2.7c1.6-1.5 2.5-3.6 2.5-6.2z"></path><path d="M12 20.5c2.3 0 4.2-.8 5.5-2.1l-2.7-2.1c-.7.5-1.7.8-2.8.8-2.2 0-4-1.5-4.7-3.4H4.6v2.2A8.5 8.5 0 0 0 12 20.5z"></path><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.1H4.6a8.5 8.5 0 0 0 0 7.8z"></path><path d="M12 6.9c1.2 0 2.4.4 3.3 1.3l2.4-2.4A8.5 8.5 0 0 0 4.6 8.1l2.7 2.2C8 8.4 9.8 6.9 12 6.9z"></path>',
})

BTN = "height: 56px; border-radius: 28px; border: none; font: 800 16px 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%"
PRIMARY = f"{BTN}; background: %%INK%%; color: %%BG%%"


def field(lbl, value, icon=None, ph=False, tail=""):
    i = f'<span style="display: flex; color: %%MUTED%%">{ic(icon, 19)}</span>' if icon else ""
    col = "%%MUTED%%" if ph else "%%INK%%"
    return f'''<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: %%INK2%%">{lbl}
<span style="height: 52px; padding: 0 16px; border-radius: 18px; background: %%INPUT_BG%%; border: 1px solid %%LINE%%; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500; color: {col}">{i}{value}{tail}</span></label>'''


def logo_for(mode, size):
    return logo("B", mode == "Dark", size)


def bottom_bar(inner):
    return f'<div style="position: absolute; left: 14px; right: 14px; bottom: 26px; padding: 6px; border-radius: 34px; {GL}; display: flex; gap: 8px">{inner}</div>'


def top_bar(back=True, middle="", right=""):
    b = gbtn("back", "Back") if back else ""
    return f'<div style="position: absolute; top: 30px; left: 16px; right: 16px; display: flex; align-items: center; gap: 10px">{b}<div style="flex-grow: 1; display: flex; justify-content: center">{middle}</div>{right}</div>'


# ---------------------------------------------------------------- Login
def login(mode, t):
    body = f'''<div style="position: absolute; top: 96px; left: 0; right: 0; padding: 0 22px; display: flex; flex-direction: column; gap: 14px">
<div style="padding-bottom: 18px">{logo_for(mode, 26)}</div>
<h1 style="margin: 0 0 10px; {DISP}; font-size: 36px; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em">Train and eat with your coach.</h1>
{field("Email", "eva.svobodova@email.cz", "mail")}
{field("Password", "••••••••••", "lock", tail='<span style="margin-left: auto; font-size: 13px; font-weight: 700; color: %%INK2%%">Show</span>')}
<a href="#" style="align-self: flex-end; font-size: 13px; font-weight: 700; color: %%INK%%">Forgot password?</a>
<button style="{PRIMARY}">Sign in</button>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<button style="{BTN}; background: %%CARD%%; border: 1px solid %%LINE%%; color: %%INK%%; height: 50px">{ic("apple", 18)}Apple</button>
<button style="{BTN}; background: %%CARD%%; border: 1px solid %%LINE%%; color: %%INK%%; height: 50px">{ic("g", 18)}Google</button>
</div>
<span style="align-self: center; font-size: 14px; color: %%MUTED%%">New here? <a href="#" style="font-weight: 800; color: %%RED%%">Create account</a></span>
</div>'''
    return screen("Login glass", body, t, mode)


# ---------------------------------------------------------------- Register
def register(mode, t):
    rule = lambda txt, ok: f'<span style="display: flex; align-items: center; gap: 7px; font-size: 13px; color: {"%%INK%%" if ok else "%%MUTED%%"}"><span style="width: 18px; height: 18px; border-radius: 9px; {"background: %%NUTRI%%; color: %%ON%%" if ok else "border: 1.5px solid %%LINE%%"}; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="3") if ok else ""}</span>{txt}</span>'
    body = f'''{top_bar(middle=f'<span style="height: 44px; padding: 0 16px; border-radius: 22px; {GL}; display: flex; align-items: center">{logo_for(mode, 14)}</span>', right='<span style="width: 44px"></span>')}
<div style="position: absolute; top: 96px; left: 0; right: 0; padding: 0 22px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 6px"><h1 style="margin: 0; {DISP}; font-size: 32px; font-weight: 700; letter-spacing: -0.02em">Create account</h1><span style="font-size: 15px; color: %%MUTED%%">Takes a minute. Your coach connects with you after.</span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{field("First name", "Eva")}{field("Last name", "Svobodová")}</div>
{field("Email", "eva.svobodova@email.cz", "mail")}
{field("Password", "••••••••", "lock", tail='<span style="margin-left: auto; font-size: 13px; font-weight: 700; color: %%INK2%%">Show</span>')}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px">{rule("At least 8 characters", True)}{rule("Uppercase letter", False)}{rule("Lowercase letter", True)}{rule("Digit", False)}</div>
<label style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.45; color: %%INK2%%"><span style="width: 22px; height: 22px; flex-shrink: 0; border-radius: 7px; background: %%INK%%; color: %%BG%%; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="3")}</span>I agree to the processing of my personal data and to the terms of use.</label>
</div>
{bottom_bar(f'<button style="{PRIMARY}; height: 58px">Create account</button>')}
<span style="position: absolute; left: 0; right: 0; bottom: 108px; text-align: center; font-size: 14px; color: %%MUTED%%">Already have an account? <a href="#" style="font-weight: 800; color: %%RED%%">Sign in</a></span>'''
    return screen("Register glass", body, t, mode)


# ---------------------------------------------------------------- Onboarding
def progress_pill(step, total):
    segs = "".join(f'<span style="width: 22px; height: 6px; border-radius: 3px; background: {"%%INK%%" if i < step else "%%TRACK%%"}"></span>' for i in range(total))
    return f'<span style="height: 44px; padding: 0 16px; border-radius: 22px; {GL}; display: flex; align-items: center; gap: 5px">{segs}</span>'


def onboarding_goal(mode, t):
    opts = [("Lose fat", "Lean out while keeping strength", "%%NUTRI%%", "leaf", True),
            ("Build muscle", "Add size with a structured plan", "%%TRAIN%%", "dumbbell", False),
            ("Get stronger", "Lift heavier, week by week", "%%TRAIN%%", "dumbbell", False),
            ("Eat better", "Simple meals that fit your day", "%%NUTRI%%", "leaf", False),
            ("Move more", "Build a habit you can keep", "%%RED%%", "clock", False)]
    cards = ""
    for title, sub, col, icon, sel in opts:
        if sel:
            st, subc, mark = "background: %%INK%%; color: %%BG%%; border: 2px solid %%INK%%", "%%BG%%", f'<span style="width: 28px; height: 28px; border-radius: 14px; background: %%BG%%; color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("check", 16, sw="3")}</span>'
        else:
            st, subc, mark = f"{CARD}", "%%MUTED%%", '<span style="width: 24px; height: 24px; border-radius: 14px; border: 2px solid %%LINE%%"></span>'
        cards += f'''<button aria-pressed="{"true" if sel else "false"}" style="display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 24px; {st}; text-align: left; font-family: 'DM Sans', sans-serif">
<span style="width: 46px; height: 46px; flex-shrink: 0; border-radius: 15px; background: {col}; color: {"#FFFFFF" if col == "%%RED%%" else "%%ON%%"}; display: flex; align-items: center; justify-content: center">{ic(icon, 22, sw="2")}</span>
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 17px; font-weight: 800">{title}</span><span style="font-size: 13px; color: {subc}; opacity: 0.85">{sub}</span></span>
<span style="margin-left: auto">{mark}</span></button>'''
    body = f'''{top_bar(middle=progress_pill(2, 6), right='<a href="#" style="height: 44px; padding: 0 4px; display: flex; align-items: center; font-size: 14px; font-weight: 700; color: %%MUTED%%">Skip</a>')}
<div style="position: absolute; top: 100px; left: 0; right: 0; padding: 0 18px; display: flex; flex-direction: column; gap: 10px">
<span style="font-size: 13px; font-weight: 800; letter-spacing: 0.12em; color: %%RED%%">STEP 2 OF 6</span>
<h1 style="margin: 0 0 4px; {DISP}; font-size: 32px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">What's your main goal?</h1>
<span style="font-size: 15px; color: %%MUTED%%; padding-bottom: 6px">Your coach uses this to build your first plan.</span>
{cards}
</div>
{bottom_bar(f'<button style="{PRIMARY}; height: 58px">Continue</button>')}'''
    return screen("Onboarding goal glass", body, t, mode)


def onboarding_body(mode, t):
    def stepper(lbl, value, unit, sub):
        b = lambda icon, l: f'<button aria-label="{l}" style="width: 52px; height: 52px; border-radius: 26px; border: none; background: %%PILL%%; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 22, sw="2.4")}</button>'
        return f'''<div style="border-radius: 26px; {CARD}; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px">
<span style="font-size: 13px; font-weight: 700; color: %%MUTED%%">{lbl}</span>
<div style="display: flex; align-items: center; gap: 12px">{b("minus", "Decrease " + lbl)}<div style="flex-grow: 1; display: flex; align-items: baseline; justify-content: center; gap: 6px"><span style="{DISP}; font-size: 40px; font-weight: 700; letter-spacing: -0.02em">{value}</span><span style="font-size: 17px; font-weight: 700; color: %%MUTED%%">{unit}</span></div>{b("plus", "Increase " + lbl)}</div>
<span style="align-self: center; font-size: 12px; color: %%MUTED%%">{sub}</span></div>'''
    seg = lambda xs, on: "".join(f'<button style="flex-grow: 1; height: 44px; border-radius: 22px; border: none; {"background: %%INK%%; color: %%BG%%" if x == on else "background: transparent; color: %%INK2%%"}; font: 700 15px \'DM Sans\', sans-serif">{x}</button>' for x in xs)
    act = "".join(f'<button aria-pressed="{"true" if i == 3 else "false"}" style="flex-grow: 1; height: 48px; border-radius: 16px; border: none; {"background: %%TRAIN%%; color: %%ON%%" if i == 3 else "background: %%PILL%%; color: %%INK%%"}; font: 800 17px \'DM Sans\', sans-serif">{i}</button>' for i in range(1, 6))
    body = f'''{top_bar(middle=progress_pill(3, 6), right='<a href="#" style="height: 44px; padding: 0 4px; display: flex; align-items: center; font-size: 14px; font-weight: 700; color: %%MUTED%%">Skip</a>')}
<div style="position: absolute; top: 100px; left: 0; right: 0; padding: 0 18px; display: flex; flex-direction: column; gap: 12px">
<span style="font-size: 13px; font-weight: 800; letter-spacing: 0.12em; color: %%RED%%">STEP 3 OF 6</span>
<h1 style="margin: 0; {DISP}; font-size: 32px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">A few basics</h1>
<div style="padding: 5px; border-radius: 27px; {GL}; display: flex">{seg(["Female", "Male"], "Female")}</div>
{stepper("Height", "168", "cm", "Hold to change faster")}
{stepper("Current weight", "73.0", "kg", "Your coach sees this as your starting point")}
<div style="border-radius: 26px; {CARD}; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex"><span style="font-size: 13px; font-weight: 700; color: %%MUTED%%">How active are you?</span><span style="margin-left: auto; font-size: 13px; font-weight: 800; color: %%TRAIN_TEXT%%">Moderately</span></div>
<div style="display: flex; gap: 6px">{act}</div>
<div style="display: flex; font-size: 12px; color: %%MUTED%%"><span>Desk job</span><span style="margin-left: auto">Very active</span></div>
</div>
</div>
{bottom_bar(f'<button style="{PRIMARY}; height: 58px">Continue</button>')}'''
    return screen("Onboarding basics glass", body, t, mode)


# ---------------------------------------------------------------- Check-in
def checkin(mode, t):
    def scale(lbl, val, desc, color):
        dots = "".join(f'<button aria-label="{lbl} {i}" style="flex-grow: 1; height: 40px; border-radius: 14px; border: none; {f"background: {color}; color: %%ON%%" if i == val else "background: %%PILL%%; color: %%INK2%%"}; font: 800 15px \'DM Sans\', sans-serif">{i}</button>' for i in range(1, 6))
        return f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid %%LINE%%"><div style="display: flex; font-size: 15px"><span style="font-weight: 700">{lbl}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{desc}</span></div><div style="display: flex; gap: 6px">{dots}</div></div>'
    photo = lambda lbl, filled: (f'<div style="flex-grow: 1; height: 96px; border-radius: 20px; background: linear-gradient(160deg, #D9B9A0, #B98E73); color: #141414; display: flex; align-items: flex-end; padding: 8px 10px; box-sizing: border-box; font-size: 12px; font-weight: 800">{lbl}</div>'
                                 if filled else f'<button style="flex-grow: 1; height: 96px; border-radius: 20px; border: 2px dashed %%LINE%%; background: transparent; color: %%MUTED%%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font: 700 12px \'DM Sans\', sans-serif">{ic("camera", 22)}{lbl}</button>')
    b = lambda icon, l: f'<button aria-label="{l}" style="width: 46px; height: 46px; border-radius: 23px; border: none; background: %%PILL%%; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 20, sw="2.4")}</button>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: 88px; display: flex; flex-direction: column; gap: 12px">
<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; font-weight: 800; letter-spacing: 0.12em; color: %%RED%%">WEEK 6 · DUE SUNDAY</span><h1 style="margin: 0; {DISP}; font-size: 34px; font-weight: 700; letter-spacing: -0.02em">Weekly check-in</h1></div>
<div style="margin: 0 16px; border-radius: 26px; background: %%RED%%; color: #FFFFFF; padding: 16px 18px; display: flex; align-items: center; gap: 12px">
{b("minus", "Decrease weight").replace("%%PILL%%", "rgba(255,255,255,0.2)").replace("color: %%INK%%", "color: #FFFFFF")}
<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 2px"><span style="font-size: 12px; font-weight: 800; letter-spacing: 0.12em">WEIGHT THIS MORNING</span><span style="{DISP}; font-size: 40px; font-weight: 700; letter-spacing: -0.02em">72.4 <span style="font-size: 18px">kg</span></span><span style="font-size: 13px; font-weight: 600">−0.6 kg vs last week</span></div>
{b("plus", "Increase weight").replace("%%PILL%%", "rgba(255,255,255,0.2)").replace("color: %%INK%%", "color: #FFFFFF")}
</div>
<div style="margin: 0 16px; border-radius: 26px; {CARD}; padding: 6px 18px 8px">
<div style="padding: 10px 0 6px; {DISP}; font-size: 18px; font-weight: 700">How was your week?</div>
{scale("Energy", 4, "Good", "%%TRAIN%%")}{scale("Sleep", 2, "Short nights", "%%TRAIN%%")}{scale("Hunger", 3, "Okay", "%%NUTRI%%")}
</div>
<div style="margin: 0 16px; border-radius: 26px; {CARD}; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex"><span style="{DISP}; font-size: 18px; font-weight: 700">Progress photos</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">1 of 3</span></div>
<div style="display: flex; gap: 8px">{photo("Front", True)}{photo("Side", False)}{photo("Back", False)}</div>
</div>
</div>
{top_bar(right=gbtn("x", "Close") if "x" in PATHS else "")}
{bottom_bar(f'<button style="{BTN}; height: 58px; background: %%INK%%; color: %%BG%%">Send to Martin{ic("arrowup", 18, sw="2.6")}</button>')}'''
    return screen("Check-in glass", body, t, mode)


PATHS.setdefault("x", '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>')

NEW = [("Login", login), ("Register", register), ("OnboardingGoal", onboarding_goal), ("OnboardingBasics", onboarding_body), ("CheckIn", checkin)]
row_y = {"Light": 0, "Dark": 844 + 120 + 300}
out = {"boards": {}, "notes": {}}
for mode, t in MODES.items():
    x = 4 * 470
    for label_, fn in NEW:
        fname = f"Glass{label_}{mode}.dc.html"
        with open(os.path.join(HERE, "project", fname), "w") as f:
            f.write(fn(mode, t))
        out["boards"][fname] = {"x": x, "y": row_y[mode], "w": 390, "h": 844, "title": f"{mode} · {label_}", "page": "glass"}
        x += 470
    out["notes"][f"glass{mode}"] = x - 80
json.dump(out, open(os.path.join(HERE, "new_boards.json"), "w"), indent=1)
print("\n".join(out["boards"]))
