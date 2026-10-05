"""Coach sign-up: account type choice, coach registration, coach profile setup."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen13.py")).read().split("NEW13 = [")[0]
exec(_src)


def choice_card(title, sub, icon, soft, ink, selected):
    border = "1.5px solid %%INK%%" if selected else "1.5px solid transparent"
    mark = (f'<span style="width: 22px; height: 22px; border-radius: 11px; background: %%INK%%; color: %%BG%%; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.8")}</span>'
            if selected else '<span style="width: 20px; height: 20px; border-radius: 11px; border: 1.5px solid %%HAIR%%"></span>')
    return f'''<button aria-pressed="{"true" if selected else "false"}" style="display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 20px; background: %%CARD%%; border: {border}; box-shadow: %%CARD_SHADOW%%; color: %%INK%%; text-align: left; font-family: 'DM Sans', sans-serif">
{soft_icon(icon, soft, ink, 44)}<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 600">{title}</span><span style="font-size: 13px; line-height: 1.4; color: %%MUTED%%">{sub}</span></span><span style="margin-left: auto">{mark}</span></button>'''


def account_type(mode, t):
    body = f'''{top_bar(gbtn("back", "Back to sign in"))}
<div style="position: absolute; top: 100px; left: 0; right: 0; padding: 0 20px; display: flex; flex-direction: column; gap: 12px">
<div style="padding-bottom: 8px">{logo("B", mode == "Dark", 18)}</div>
<h1 style="{H1}">Create your account</h1>
<span style="font-size: 15px; color: %%MUTED%%; padding-bottom: 8px">One app for both — pick how you'll use it.</span>
{choice_card("I want a coach", "Follow training and meal plans, check in weekly, chat with your coach.", "user", "%%SEG%%", "%%INK2%%", False)}
{choice_card("I'm a coach", "Trainer or nutritionist. Look after clients on the go — build plans on the web.", "users", "%%RED_SOFT%%", "%%RED%%", True)}
</div>
<span style="position: absolute; left: 0; right: 0; bottom: 104px; text-align: center; font-size: 14px; color: %%MUTED%%">Already have an account? <a href="#" style="font-weight: 600; color: %%RED%%; {A}">Sign in</a></span>
{cta("Continue", "chevron")}'''
    return screen("Account type", body, t, mode)


def coach_register(mode, t):
    role = lambda name, sub, icon, soft, ink, on: f'''<button aria-pressed="{"true" if on else "false"}" style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 16px; background: %%CARD%%; border: 1.5px solid {"%%INK%%" if on else "%%HAIR%%"}; color: %%INK%%; text-align: left; font-family: 'DM Sans', sans-serif">
<span style="display: flex; align-items: center">{soft_icon(icon, soft, ink, 30)}<span style="margin-left: auto">{"<span style='width: 20px; height: 20px; border-radius: 10px; background: %%INK%%; color: %%BG%%; display: flex; align-items: center; justify-content: center'>" + ic("check", 11, sw="2.8") + "</span>" if on else "<span style='width: 18px; height: 18px; border-radius: 10px; border: 1.5px solid %%HAIR%%'></span>"}</span></span>
<span style="font-size: 15px; font-weight: 600">{name}</span><span style="font-size: 11px; line-height: 1.35; color: %%MUTED%%">{sub}</span></button>'''
    rule = lambda txt, ok: f'<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: {"%%INK2%%" if ok else "%%MUTED%%"}"><span style="width: 14px; height: 14px; border-radius: 7px; {"background: %%NUTRI%%; color: %%ON%%" if ok else "border: 1px solid %%HAIR%%"}; display: flex; align-items: center; justify-content: center">{ic("check", 9, sw="3") if ok else ""}</span>{txt}</span>'
    body = f'''{top_bar(gbtn("back", "Back"), '<span style="font-size: 14px; font-weight: 600">Coach account</span>')}
<div style="position: absolute; top: 88px; left: 0; right: 0; padding: 0 20px; display: flex; flex-direction: column; gap: 12px">
<h1 style="{H1}; font-size: 28px">Create coach account</h1>
<span style="font-size: 13px; font-weight: 500; color: %%MUTED%%">What do you do? You can pick both.</span>
<div style="display: flex; gap: 10px">{role("Trainer", "Training plans, exercises, workout logging", "dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", True)}{role("Nutritionist", "Meal plans, recipes, ingredients, macros", "leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", False)}</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{field("First name", "Martin")}{field("Last name", "Král")}</div>
{field("Email", "martin@example.com", "mail")}
{field("Password", "••••••••••", "lock", '<span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">Show</span>')}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px">{rule("At least 8 characters", True)}{rule("Uppercase letter", True)}{rule("Lowercase letter", True)}{rule("Digit", True)}</div>
<label style="display: flex; gap: 10px; align-items: flex-start; font-size: 12px; line-height: 1.45; color: %%MUTED%%"><span style="width: 20px; height: 20px; flex-shrink: 0; border-radius: 6px; background: %%INK%%; color: %%BG%%; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.6")}</span>I agree to the processing of my personal data and to the terms of use.</label>
</div>
{fade()}{cta("Create account")}'''
    return screen("Coach register", body, t, mode)


def coach_setup(mode, t):
    spec = lambda x, on=False: f'<button aria-pressed="{"true" if on else "false"}" style="height: 34px; padding: 0 12px; border-radius: 17px; {"background: %%INK%%; color: %%BG%%; border: 1px solid %%INK%%" if on else "background: transparent; color: %%INK2%%; border: 1px solid %%HAIR%%"}; font: 500 13px \'DM Sans\', sans-serif; display: inline-flex; align-items: center; gap: 5px">{ic("check", 12, sw="2.4") if on else ""}{x}</button>'
    body = f'''{top_bar(gbtn("back", "Back"), progress(2, 2), f'<a href="#" style="font-size: 14px; font-weight: 500; color: %%MUTED%%; {A}">Later</a>')}
<div style="position: absolute; top: 96px; left: 0; right: 0; padding: 0 20px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 4px"><h1 style="{H1}">Your coach profile</h1><span style="font-size: 14px; color: %%MUTED%%">Clients see this when they look for a coach.</span></div>
<div style="display: flex; align-items: center; gap: 14px"><button aria-label="Add photo" style="width: 72px; height: 72px; flex-shrink: 0; border-radius: 36px; border: 1.5px dashed %%MUTED%%; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("camera", 24, sw="1.6")}</button><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Add a photo</span><span style="font-size: 12px; color: %%MUTED%%">Profiles with a photo get more requests</span></span></div>
{field("City", "Prague", "pin")}
<div style="display: flex; align-items: center; font-size: 15px">Also coach online<span style="margin-left: auto">{toggle(True)}</span></div>
<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; font-weight: 500; color: %%MUTED%%">Specialties</span><div style="display: flex; flex-wrap: wrap; gap: 6px">{spec("Strength", True)}{spec("Fat loss", True)}{spec("Beginners")}{spec("Running")}{spec("Mobility")}{spec("Postpartum")}</div></div>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Short bio<span style="min-height: 64px; padding: 10px 12px; box-sizing: border-box; border-radius: 14px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 14px; color: %%MUTED%%">How you work, in two or three sentences</span></label>
</div>
{fade()}{cta("Finish")}'''
    return screen("Coach setup", body, t, mode)


NEW14 = [("CoachAccountType", account_type), ("CoachRegister", coach_register), ("CoachSetup", coach_setup)]
for mode, t in MODES.items():
    for label_, fn in NEW14:
        with open(os.path.join(HERE, "project", f"{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
print("ok")
