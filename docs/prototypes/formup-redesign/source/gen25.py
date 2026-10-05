"""Web registration: step 1 (account) and step 3 (invite your first client)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
__file__ = os.path.join(HERE, "gen24.py")
exec(open(__file__).read().split("\nfor d, t in DIRS.items():")[0])


def field(label, ph, tail="", hint=""):
    h = f'<span style="font-size: 12px; font-weight: 400; color: %%MUTED%%">{hint}</span>' if hint else ""
    return (f'<label style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%">{label}'
            f'<span style="height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; font-size: 14px; color: %%MUTED%%">{ph}{tail}</span>{h}</label>')


def reg_topbar(d, signin=True):
    return (f'<header style="height: 76px; padding: 0 {PAD}px; display: flex; align-items: center">{logo(d, bool(DARK_ON), 20)}'
            + (f'<span style="margin-left: auto; font-size: 14px; color: %%MUTED%%">Already have an account? <a href="#" style="font-weight: 700; color: %%INK%%">Sign in</a></span>' if signin else '') + '</header>')


def stepper(active):
    steps = ["Account", "Verify email", "Your profile"]
    out = ""
    for i, s in enumerate(steps):
        done, on = i < active, i == active
        dot = (f'<span style="width: 26px; height: 26px; border-radius: 13px; background: %%INK%%; color: %%SURFACE%%; display: flex; align-items: center; justify-content: center">{ic("check", 13, sw="2.6")}</span>' if done
               else f'<span style="width: 26px; height: 26px; box-sizing: border-box; border-radius: 13px; {"background: %%MARKER%%; color: #FFFFFF" if on else "border: 1.5px solid %%LINE%%; color: %%MUTED%%"}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700">{i + 1}</span>')
        out += f'<span style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: {700 if on else 500}; color: {"%%INK%%" if (on or done) else "%%MUTED%%"}">{dot}{s}</span>'
        if i < len(steps) - 1:
            out += f'<span style="flex-grow: 1; height: 2px; border-radius: 1px; background: {"%%INK%%" if done else "%%LINE%%"}"></span>'
    return f'<div style="display: flex; align-items: center; gap: 12px">{out}</div>'


def role_card(icon, title, sub, on, color, soft):
    ring = f"border: 2px solid {color}; background: {soft}" if on else "border: 1px solid %%LINE%%; background: %%SURFACE%%"
    radio = (f'<span style="margin-left: auto; width: 18px; height: 18px; box-sizing: border-box; border-radius: 9px; border: 5px solid {color}; background: #FFFFFF"></span>' if on
             else '<span style="margin-left: auto; width: 18px; height: 18px; box-sizing: border-box; border-radius: 9px; border: 1.5px solid %%MUTED%%"></span>')
    return (f'<div role="radio" aria-checked="{"true" if on else "false"}" style="flex-grow: 1; flex-basis: 0; box-sizing: border-box; border-radius: 14px; {ring}; padding: 14px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center"><span style="width: 34px; height: 34px; border-radius: 10px; background: {soft}; color: {color}; display: flex; align-items: center; justify-content: center">{ic(icon, 18)}</span>{radio}</div>'
            f'<span style="font-size: 15px; font-weight: 700">{title}</span><span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">{sub}</span></div>')


def form_step1():
    pw_meter = ('<div style="display: flex; gap: 4px; padding-top: 2px">' + "".join(f'<span style="flex-grow: 1; height: 4px; border-radius: 2px; background: {c}"></span>' for c in ("%%NUTRI%%", "%%NUTRI%%", "%%NUTRI%%", "%%LINE%%")) + '</div>')
    return (f'<div style="width: 540px; box-sizing: border-box; border-radius: 22px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 24px 60px rgba(0,0,0,0.10); padding: 32px 36px; display: flex; flex-direction: column; gap: 18px">'
            f'{stepper(0)}'
            f'<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 6px"><h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">Join our community</h1>'
            f'<span style="font-size: 14px; color: %%MUTED%%">Create your coach account. It takes a minute.</span></div>'
            f'<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 500; color: %%INK2%%">I work as</span>'
            f'<div role="radiogroup" style="display: flex; gap: 10px">{role_card("dumbbell", "Personal trainer", "Training plans, sessions and live workouts", True, "%%TRAIN%%", "%%TRAIN_SOFT%%")}'
            f'{role_card("leaf", "Nutritionist", "Meal plans, recipes and nutrition targets", False, "%%NUTRI%%", "%%NUTRI_SOFT%%")}</div></div>'
            f'<div style="display: flex; gap: 12px">{field("First name", "Jan")}{field("Last name", "Novák")}</div>'
            f'{field("Email", "jan@coaching.cz")}'
            f'<div style="display: flex; flex-direction: column; gap: 6px">{field("Password", "••••••••••", chr(10).join([]) + "<span style=\"margin-left: auto; font-size: 12px; font-weight: 600; color: %%INK2%%\">Show</span>")}{pw_meter}<span style="font-size: 12px; color: %%MUTED%%">Strong · at least 8 characters with a number</span></div>'
            f'<span style="display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.45; color: %%INK2%%">{checkbox(True, "Accept terms")}<span>I agree to the <a href="#" style="font-weight: 600; color: %%INK%%">Terms</a> and the <a href="#" style="font-weight: 600; color: %%INK%%">Privacy policy</a>.</span></span>'
            f'<button style="height: 48px; border-radius: 12px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font: 700 15px \'DM Sans\', sans-serif">Create account</button>'
            f'<div style="display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.14em; color: %%MUTED%%"><span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span>OR<span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span></div>'
            f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{btn("Continue with Google", "outline", h=42, extra="; justify-content: center")}{btn("Continue with Apple", "outline", "apple", 42, "; justify-content: center")}</div></div>')


def journey():
    items = [("check", "Create your account", "Name, email and what you do.", "now"),
             ("users", "Set up your profile", "Photo, specialties and a short bio — so clients can find you in the app.", "todo"),
             ("chat", "Invite your first client", "Send an invite by email. They join with the Form Up app.", "todo"),
             ("calendar", "Build their first week", "Start from a template or from scratch, then publish.", "todo")]
    rows = ""
    for i, (icon, t, b, state) in enumerate(items):
        col = {"now": "%%MARKER%%", "todo": "%%MUTED%%"}[state]
        badge = (f'<span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 18px; background: %%MARKER%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("check", 16, sw="2.6")}</span>' if False
                 else f'<span style="width: 36px; height: 36px; flex-shrink: 0; box-sizing: border-box; border-radius: 18px; border: {"2px solid %%MARKER%%" if state == "now" else "1.5px solid %%LINE%%"}; background: %%SURFACE%%; color: {col}; display: flex; align-items: center; justify-content: center">{ic(icon, 16)}</span>')
        line = '' if i == len(items) - 1 else '<span style="position: absolute; left: 17px; top: 40px; bottom: -18px; width: 2px; background: %%LINE%%"></span>'
        rows += (f'<div style="position: relative; display: flex; gap: 14px">{badge}{line}<span style="display: flex; flex-direction: column; gap: 3px; padding-top: 2px">'
                 f'<span style="font-size: 15px; font-weight: 700; color: {"%%INK%%" if state != "todo" else "%%INK2%%"}">{t}</span><span style="font-size: 13px; line-height: 1.5; color: %%MUTED%%">{b}</span></span></div>')
    app = (f'<div style="display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%">'
           f'<span style="width: 42px; height: 42px; flex-shrink: 0; border-radius: 11px; background: #141414; border: 1px solid #333; display: flex; align-items: center; justify-content: center; font: 600 13px Outfit, sans-serif; color: #E5483D">FU</span>'
           f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Get the app too</span><span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">Your clients live in it — and you can follow them from your phone.</span></span>'
           f'<span style="margin-left: auto; display: flex; gap: 6px">{btn("", "outline", "apple", 34)}{btn("", "outline", "play", 34)}</span></div>')
    return (f'<div style="width: 470px; display: flex; flex-direction: column; gap: 26px; padding-top: 30px">'
            f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">YOUR FIRST AFTERNOON</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 34px; line-height: 1.12; font-weight: 600; letter-spacing: -0.015em">From sign-up to your first client’s week <span style="color: %%MARKER%%">in four steps.</span></h2>'
            f'<div style="display: flex; flex-direction: column; gap: 22px">{rows}</div>{app}</div>')


def register(d, t):
    main = f'<main style="padding: 10px {PAD}px 0; display: flex; justify-content: center; gap: 90px">{form_step1()}{journey()}</main>'
    body = f'<div style="width: {W}px; height: 1000px; background: {wash()}; {FONT}; color: %%INK%%; overflow: hidden">{reg_topbar(d)}{main}</div>'
    return page(f"Register {d}", W, 1000, body, t)


# ---------------------------------------------------------------- step 3: invite the first client
def invite_phone():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    inner = (f'<div style="padding: 4px 6px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Invitation</span><span style="{DISP}; font-size: 20px; font-weight: 600">You’re invited</span></div>'
             + glass_card(f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 44px; height: 44px; border-radius: 22px; background: #C9B29E"></span>'
                          f'<span style="display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 700">Jan Novák</span><span style="font-size: 11px; color: {muted}">Personal trainer · Brno</span></span></div>'
                          f'<p style="margin: 10px 0 0; font-size: 12px; line-height: 1.5">“Hi Petra, here’s where we’ll plan your training from now on. See you Monday!”</p>', "12px 14px")
             + glass_card(f'<span style="font-size: 11px; color: {muted}">You’ll get</span>'
                          + "".join(f'<span style="display: flex; align-items: center; gap: 8px; padding-top: 7px; font-size: 12px"><span style="color: %%MARKER%%">{ic("check", 13, sw="2.4")}</span>{x}</span>' for x in ("Your training plan, day by day", "Chat with Jan", "A weekly check-in")), "12px 14px")
             + '<span style="margin-top: auto; height: 42px; border-radius: 21px; background: %%MARKER%%; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Accept invitation</span>')
    return phone_shell(inner, 270, 540)


def form_step3():
    return (f'<div style="width: 540px; box-sizing: border-box; border-radius: 22px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 24px 60px rgba(0,0,0,0.10); padding: 32px 36px; display: flex; flex-direction: column; gap: 18px">'
            f'{stepper(2)}'
            f'<div style="display: flex; flex-direction: column; gap: 6px; padding-top: 6px"><h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">Invite your first client</h1>'
            f'<span style="font-size: 14px; line-height: 1.5; color: %%MUTED%%">They get an email with a link to the Form Up app. Once they accept, you can build their first week.</span></div>'
            f'<div style="display: flex; gap: 12px">{field("Client’s first name", "Petra")}{field("Email", "petra@email.cz")}</div>'
            f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>Personal message <span style="font-weight: 400; color: %%MUTED%%">· optional</span></span>'
            f'<span style="height: 96px; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; font-size: 14px; line-height: 1.5; color: %%INK%%">Hi Petra, here’s where we’ll plan your training from now on. See you Monday!</span></label>'
            f'<a href="#" style="align-self: flex-start; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: %%INK2%%; text-decoration: none">{ic("plus", 14)}Add another client</a>'
            f'<button style="height: 48px; border-radius: 12px; border: none; background: %%MARKER%%; color: #FFFFFF; font: 700 15px \'DM Sans\', sans-serif">Send invitation</button>'
            f'<div style="display: flex; align-items: center; font-size: 13px"><a href="#" style="font-weight: 600; color: %%INK2%%">Back</a><a href="#" style="margin-left: auto; font-weight: 600; color: %%MUTED%%">I’ll do it later</a></div></div>')


def register_invite(d, t):
    preview = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding-top: 10px">'
               f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">WHAT PETRA WILL SEE</span>{invite_phone()}</div>')
    main = f'<main style="padding: 10px {PAD}px 0; display: flex; justify-content: center; align-items: flex-start; gap: 110px">{form_step3()}{preview}</main>'
    body = f'<div style="width: {W}px; height: 1000px; background: {wash()}; {FONT}; color: %%INK%%; overflow: hidden">{reg_topbar(d)}{main}</div>'
    return page(f"Register invite {d}", W, 1000, body, t)


# ---------------------------------------------------------------- email verification
def big_icon(svg_inner, bg, fg):
    return (f'<span style="width: 84px; height: 84px; border-radius: 42px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">'
            f'<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{svg_inner}</svg></span>')


def center_card(inner):
    return (f'<div style="width: 560px; box-sizing: border-box; border-radius: 22px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 24px 60px rgba(0,0,0,0.10); '
            f'padding: 32px 40px 36px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center">{inner}</div>')


def verify_page(d, t, card, signin=True):
    main = f'<main style="padding: 30px {PAD}px 0; display: flex; justify-content: center">{card}</main>'
    body = f'<div style="width: {W}px; height: {H}px; background: {wash()}; {FONT}; color: %%INK%%; overflow: hidden">{reg_topbar(d, signin)}{main}</div>'
    return page(f"Register verify {d}", W, H, body, t)


def check_email(d, t):
    mail = '<rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path d="M3.5 7l8.5 6 8.5-6"></path>'
    mail_btn = lambda l: f'<a href="#" style="flex-grow: 1; flex-basis: 0; height: 44px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; text-decoration: none; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px">{l}{ic("external", 14)}</a>'
    inner = (f'<div style="align-self: stretch; padding-bottom: 8px">{stepper(1)}</div>'
             f'{big_icon(mail, "%%DANGER_SOFT%%", "%%MARKER%%")}'
             f'<h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">Check your email</h1>'
             f'<p style="margin: 0; font-size: 15px; line-height: 1.6; color: %%INK2%%">We sent a verification link to<br><b style="color: %%INK%%">jan@coaching.cz</b></p>'
             f'<p style="margin: 0; font-size: 14px; line-height: 1.55; color: %%MUTED%%">Click the link in the email to activate your account. It is valid for 24 hours.</p>'
             f'<div style="align-self: stretch; display: flex; gap: 10px; padding-top: 6px">{mail_btn("Open Gmail")}{mail_btn("Open Outlook")}</div>'
             f'<div style="align-self: stretch; border-radius: 12px; background: %%GROUND%%; border: 1px solid %%LINE%%; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.5; color: %%MUTED%%; text-align: left">'
             f'<span style="font-weight: 700; color: %%INK%%">No email yet?</span>'
             f'<span>Check your spam folder, or wait a minute — it can take a moment to arrive.</span>'
             f'<span style="display: flex; align-items: center; gap: 8px; padding-top: 4px"><span style="font-weight: 600; color: %%MUTED%%; opacity: 0.7">Resend email</span><span style="font-size: 12px">· available in 0:42</span></span></div>'
             f'<span style="font-size: 13px; color: %%MUTED%%">Wrong address? <a href="#" style="font-weight: 700; color: %%INK%%">Change email</a></span>')
    return verify_page(d, t, center_card(inner))


def email_verified(d, t):
    check = '<path d="M5 12.5l4.5 4.5L19 7.5"></path>'
    nxt = lambda icon, title, sub: (f'<div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid %%LINE%%; text-align: left">'
                                    f'<span style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px; background: %%GROUND%%; border: 1px solid %%LINE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic(icon, 16)}</span>'
                                    f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></span></div>')
    inner = (f'<div style="align-self: stretch; padding-bottom: 8px">{stepper(2)}</div>'
             f'{big_icon(check, "%%NUTRI_SOFT%%", "%%NUTRI%%")}'
             f'<h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">Email verified</h1>'
             f'<p style="margin: 0; font-size: 15px; line-height: 1.6; color: %%INK2%%">Welcome to Form Up, Jan. Your account is ready.</p>'
             f'<a href="#" style="align-self: stretch; height: 48px; border-radius: 12px; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; text-decoration: none; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">Set up your profile{ic("chevron", 16)}</a>'
             f'<a href="#" style="font-size: 13px; font-weight: 600; color: %%MUTED%%">Skip for now and go to the portal</a>'
             f'<div style="align-self: stretch; display: flex; flex-direction: column; padding-top: 6px">'
             f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: %%MUTED%%; text-align: left; padding-bottom: 4px">WHAT’S NEXT</span>'
             f'{nxt("chat", "Invite your first client", "They join with the Form Up app")}'
             f'{nxt("calendar", "Build their first week", "From a template or from scratch")}</div>')
    return verify_page(d, t, center_card(inner), signin=False)



for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = t["BOLD"]
    DARK_ON = t["DARK"]
    for name, fn in (("PageRegister", register), ("PageRegisterCheckEmail", check_email), ("PageRegisterVerified", email_verified)):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(fn(d, t))
print("ok")
