"""Web: Forms — list and the form editor (onboarding, weekly check-in)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen2.py")).read().split("# ---------------------------------------------------------------- canvas")[0]
exec(_src)
PATHS.update({
    "grip": '<circle cx="9" cy="6" r="1.2"></circle><circle cx="15" cy="6" r="1.2"></circle><circle cx="9" cy="12" r="1.2"></circle><circle cx="15" cy="12" r="1.2"></circle><circle cx="9" cy="18" r="1.2"></circle><circle cx="15" cy="18" r="1.2"></circle>',
    "form": '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"></path><path d="M14 3.5V8h4"></path><path d="M10 12h5"></path><path d="M10 16h5"></path>',
    "bars": '<path d="M6 20v-6"></path><path d="M12 20V8"></path><path d="M18 20v-10"></path>',
    "ruler": '<rect x="3.5" y="8" width="17" height="8" rx="1.5"></rect><path d="M7.5 8v3"></path><path d="M11 8v4"></path><path d="M14.5 8v3"></path><path d="M18 8v3"></path>',
    "hash": '<path d="M9 4L7 20"></path><path d="M17 4l-2 16"></path><path d="M4.5 9h15"></path><path d="M4 15h15"></path>',
    "radio": '<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="3.5"></circle>',
    "text": '<path d="M5 6h14"></path><path d="M12 6v13"></path>',
    "smile": '<circle cx="12" cy="12" r="8.5"></circle><path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"></path><path d="M9 9.5v.1"></path><path d="M15 9.5v.1"></path>',
    "star": '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"></path>',
    "cup": '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"></path><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"></path><path d="M9 4.5v2"></path><path d="M12 4.5v2"></path>',
    "shield": '<path d="M12 3.5l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9v-5z"></path>',
    "userplus": '<circle cx="10" cy="8" r="3.5"></circle><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.3 0 2.5.3 3.5.9"></path><path d="M18 13v6"></path><path d="M15 16h6"></path>',
    "checksq": '<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.5 12l2.5 2.5 4.5-5"></path>',
    "list": '<path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path><circle cx="4.5" cy="6" r="1"></circle><circle cx="4.5" cy="12" r="1"></circle><circle cx="4.5" cy="18" r="1"></circle>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path>',
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="3"></circle>',
    "grip2": "",
})


def forms_shell(d, main, main_style="padding: 28px 32px; gap: 18px"):
    return shell(d, "Forms", main, main_style)


# ---------------------------------------------------------------- list
TYPE_STYLE = {"Onboarding": ("userplus", "%%NUTRI%%"), "Check-in": ("checksq", "%%MARKER%%")}
FORMS = [("Client Onboarding Form", "Onboarding", 9, "Sent to every new client after they accept your invite", "18 clients", "Today"),
         ("Weekly Check-In", "Check-in", 3, "Sent every Sunday at 18:00", "12 clients · 86 % answered last week", "2 days ago")]


def type_pill(kind):
    icon, col = TYPE_STYLE[kind]
    return f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid %%LINE%%; background: %%SURFACE%%; font-size: 12px; font-weight: 600; white-space: nowrap"><span style="color: {col}; display: flex">{ic(icon, 14)}</span>{kind}</span>'


def forms_list(d, t):
    rows = ""
    for name, kind, q, when, used, edited in FORMS:
        icon, col = TYPE_STYLE[kind]
        rows += f'''<tr>
<td style="{TD}"><div style="display: flex; align-items: center; gap: 12px"><span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; background: %%GROUND%%; border: 1px solid %%LINE%%; color: {col}; display: flex; align-items: center; justify-content: center">{ic("form", 18)}</span><div style="display: flex; flex-direction: column; gap: 2px"><a href="#" style="font-size: 14px; font-weight: 600; color: %%INK%%; text-decoration: none">{name}</a><span style="font-size: 12px; color: %%MUTED%%">{when}</span></div></div></td>
<td style="{TD}">{type_pill(kind)}</td>
<td style="{TD}; color: %%INK2%%">{q} questions</td>
<td style="{TD}; color: %%INK2%%">{used}</td>
<td style="{TD}; color: %%MUTED%%">{edited}</td>
<td style="{TD}; width: 32px"><button aria-label="Form menu" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("more", 18)}</button></td>
</tr>'''
    table = f'''<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">
<table style="width: 100%; border-collapse: collapse">
<thead><tr><th style="{TH}">Form</th><th style="{TH}">Type</th><th style="{TH}">Questions</th><th style="{TH}">Used for</th><th style="{TH}">Edited</th><th style="{TH}"></th></tr></thead>
<tbody>{rows}</tbody></table>{pagination(2, 2)}</div>'''
    main = (f'<div style="display: flex; align-items: flex-end">{title_block("Forms", "Questions your clients answer — at the start and every week", ("FORMS", "%%MARKER%%"))}<span style="margin-left: auto">{btn("New form", "primary", "plus", 40)}</span></div>'
            f'<div style="display: flex; align-items: center; gap: 10px">{search("Search forms…")}{filter_pill("Type")}</div>{table}')
    return page(f"Forms {d}", W, H, forms_shell(d, main), t)


# ---------------------------------------------------------------- editor
def palette_card(icon, bg, fg, title, sub):
    return (f'<div style="display: flex; align-items: center; gap: 10px; padding: 9px 10px 9px 6px; border-radius: 12px; border: 1px solid %%LINE%%; background: %%TRAY_CARD%%; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: grab">'
            f'<span style="display: flex; color: %%MUTED%%">{ic("grip", 14)}</span>'
            f'<span style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">{ic(icon, 17)}</span>'
            f'<span style="min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 600">{title}</span><span style="font-size: 11px; color: %%MUTED%%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></span></div>')


def palette(smart, standard):
    head = lambda x: f'<span style="padding-top: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: %%MUTED%%">{x}</span>'
    return (f'<aside aria-label="Fields" style="position: relative; z-index: 1; width: 300px; flex-shrink: 0; background: %%TRAY%%; border-right: 2px solid %%TRAY_EDGE%%; box-shadow: 6px 0 24px rgba(0,0,0,0.07); padding: 18px 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; overflow: hidden">'
            f'<span style="display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: %%INK2%%">{ic("plus", 14)}ADD A QUESTION</span>'
            f'<span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%; padding-bottom: 4px">Drag a field into the form, or click it to add it at the end.</span>'
            f'{head("SMART FIELDS")}<span style="font-size: 11px; color: %%MUTED%%; margin-top: -4px">Answers are saved to the client’s profile</span>'
            + "".join(palette_card(*x) for x in smart) + head("STANDARD FIELDS") + "".join(palette_card(*x) for x in standard) + '</aside>')


SMART = {
    "body": ("activity", "%%DANGER_SOFT%%", "%%MARKER%%", "Body measurements", "Weight, body fat and more"),
    "circ": ("ruler", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Circumference measurements", "Waist, hips, thighs, chest"),
    "food": ("cup", "%%TRAIN_SOFT%%", "%%TRAIN%%", "Food preferences", "Dietary preferences and restrictions"),
    "ed": ("shield", "%%GROUND%%", "%%INK2%%", "Eating disorder screening", "Screen for potential eating disorders"),
    "photos": ("image", "%%TRAIN_SOFT%%", "%%TRAIN%%", "Progress photos", "Between 1 and 5 photos"),
}
STD = {
    "smiley": ("smile", "%%NUTRI_SOFT%%", "%%NUTRI_INK%%", "Smiley rating", "Quick feeling, 5 faces"),
    "star": ("star", "%%TRAIN_SOFT%%", "%%TRAIN%%", "Star rating", "Satisfaction on a 1–5 scale"),
    "multi": ("list", "%%GROUND%%", "%%INK2%%", "Multiple choice", "Pick any number of options"),
    "number": ("hash", "%%GROUND%%", "%%INK2%%", "Number", "A number, with a range"),
    "single": ("radio", "%%GROUND%%", "%%INK2%%", "Single choice", "Pick exactly one option"),
    "text": ("text", "%%GROUND%%", "%%INK2%%", "Text", "Free-text answer"),
}


def qcard(icon, kind, inner, title=None, sub=None, n=None, smart=False, selected=False):
    ring = "border: 2px solid %%INK%%" if selected else "border: 1px solid %%LINE%%"
    smart_tag = '<span style="height: 22px; padding: 0 8px; border-radius: 11px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center">Saved to profile</span>' if smart else ""
    t = (f'<div style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">{title}</span>'
         f'<span style="font-size: 13px; color: %%MUTED%%">{sub}</span></div>') if title else ""
    return (f'<div style="border-radius: 16px; {ring}; background: %%SURFACE%%; box-shadow: 0 10px 30px rgba(0,0,0,0.05); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="display: flex; align-items: center; gap: 10px"><span style="color: %%MUTED%%; display: flex">{ic("grip", 15)}</span>'
            f'<span style="width: 24px; height: 24px; border-radius: 12px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">{n}</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: %%MUTED%%">{ic(icon, 14)}{kind}</span>{smart_tag}'
            f'<span style="margin-left: auto; display: flex; gap: 4px">'
            + "".join(f'<button aria-label="{l}" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: {c}; display: flex; align-items: center; justify-content: center">{ic(i, 15)}</button>' for i, l, c in (("copy", "Duplicate question", "%%MUTED%%"), ("trash", "Delete question", "%%MUTED%%")))
            + f'</span></div>{t}{inner}</div>')


def option_row(label, extra=""):
    return (f'<div style="display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 8px 0 12px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%GROUND%%">'
            f'<span style="display: flex; color: %%MUTED%%">{ic("grip", 13)}</span><span style="font-size: 14px">{label}</span>'
            f'<span style="margin-left: auto; display: flex; align-items: center; gap: 6px">{extra}<button aria-label="Remove {label}" style="width: 26px; height: 26px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("x", 14)}</button></span></div>')


def add_row(label):
    return f'<div style="height: 40px; border-radius: 10px; border: 1.5px dashed %%LINE%%; color: %%INK2%%; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px">{ic("plus", 14)}{label}</div>'


def answer_box(ph, h=44):
    return f'<div style="height: {h}px; box-sizing: border-box; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; display: flex; align-items: center; font-size: 14px; color: %%MUTED%%">{ph}</div>'


def toggle_line(label, on=True):
    knob = (f'<span style="width: 34px; height: 20px; border-radius: 10px; background: {"%%INK%%" if on else "%%LINE%%"}; position: relative; display: inline-block">'
            f'<span style="position: absolute; top: 2px; {"right: 2px" if on else "left: 2px"}; width: 16px; height: 16px; border-radius: 8px; background: %%SURFACE%%"></span></span>')
    return f'<span style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: %%INK2%%">{knob}{label}</span>'


def editor_top(title, kind, saved="Saved"):
    return (f'<div style="flex-shrink: 0; padding: 14px 24px; background: %%SURFACE%%; border-bottom: 1px solid %%LINE%%; display: flex; align-items: center; gap: 12px">'
            f'<a href="#" aria-label="Back to forms" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("back", 17)}</a>'
            f'<span style="font-size: 13px; color: %%MUTED%%; white-space: nowrap">Forms /</span><h1 style="margin: 0; {DISP}; font-size: 24px; font-weight: 600; white-space: nowrap">{title}</h1>{type_pill(kind)}'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: %%MUTED%%; white-space: nowrap">{ic("check", 13)}{saved}</span>'
            f'<span style="margin-left: auto; display: flex; gap: 8px"><button aria-label="Preview as client" title="Preview as client" style="width: 38px; height: 38px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("eye", 17)}</button>{btn("Settings", "outline", "settings", 38)}{btn("Save", "primary", "check", 38)}</span></div>')


def editor_page(d, t, title, kind, smart, standard, cards, settings_line):
    canvas = (f'<div style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 22px 28px; background: %%GLOW%%; display: flex; flex-direction: column; gap: 14px">'
              f'<div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: %%MUTED%%">{settings_line}</div>'
              f'<div style="max-width: 900px; width: 100%; align-self: center; display: flex; flex-direction: column; gap: 14px">{cards}</div></div>')
    main = f'{palette(smart, standard)}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">{editor_top(title, kind)}{canvas}</div>'
    return page(f"Form editor {d}", W, H, forms_shell(d, main, "flex-direction: row; padding: 0"), t)


def onboarding(d, t):
    goals = "".join(option_row(x) for x in ["Weight loss", "Muscle gain", "Strength", "Endurance", "General health"])
    cards = (qcard("list", "Multiple choice", f'<div style="display: flex; flex-direction: column; gap: 6px">{goals}{add_row("Add choice")}</div><div style="display: flex; gap: 18px">{toggle_line("Required")}{toggle_line("Allow “Other”", False)}</div>',
                   "What are your primary fitness goals?", "Select all that apply", 1, selected=True)
             + qcard("hash", "Number", f'<div style="display: flex; gap: 10px">{answer_box("Min 0", 40)}{answer_box("Max 7", 40)}{answer_box("Unit: days", 40)}</div>',
                     "How many days per week do you currently exercise?", "Enter a number between 0 and 7", 2)
             + qcard("text", "Text", answer_box("Client types their answer here…", 72),
                     "Do you have any injuries, health conditions, or other considerations we should know about?", "Please give as much detail as you can, so we can build a safe programme", 3))
    line = f'{ic("info", 14)}<span>Sent automatically to every new client after they accept your invitation · <b style="color: %%INK2%%">9 questions</b> · about 4 minutes</span>'
    return editor_page(d, t, "Client Onboarding Form", "Onboarding", [SMART[k] for k in ("body", "circ", "food", "ed")], [STD[k] for k in ("multi", "number", "single", "text")], cards, line)


def checkin(d, t):
    metric = lambda x: option_row(x, f'<span style="font-size: 12px; color: %%MUTED%%; display: flex; align-items: center; gap: 4px">metric {ic("chevdown", 13)}</span>')
    body = "".join(metric(x) for x in ["Weight (kg)", "Body fat (%)", "Waist (cm)", "Hips (cm)", "Thigh (cm)", "Chest (cm)"])
    faces = "".join(f'<span style="width: 44px; height: 44px; border-radius: 22px; {"background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; border: 1.5px solid %%NUTRI%%" if i == 4 else "background: %%GROUND%%; color: %%INK2%%; border: 1px solid %%LINE%%"}; display: flex; align-items: center; justify-content: center">{ic("smile", 22)}</span>' for i in range(5))
    labels = '<div style="display: flex; justify-content: space-between; width: 268px; font-size: 11px; color: %%MUTED%%"><span>Very low</span><span>Great</span></div>'
    cards = (qcard("activity", "Body measurements", f'<div style="display: flex; flex-direction: column; gap: 6px">{body}{add_row("Add metric")}</div>', None, None, 1, smart=True)
             + qcard("smile", "Smiley rating", f'<div style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; gap: 12px">{faces}</div>{labels}</div>',
                     "How has your energy level been this week?", "Rate your overall energy", 2)
             + qcard("text", "Text", answer_box("Client types their answer here…", 60),
                     "What challenges did you face this week?", "Help us understand what got in the way, so we can support you better", 3))
    line = f'{ic("calendar", 14)}<span>Sent every <b style="color: %%INK2%%">Sunday at 18:00</b> · reminder after 24 h · answers appear in each client’s check-in history</span>'
    return editor_page(d, t, "Weekly Check-In", "Check-in", [SMART[k] for k in ("body", "circ", "photos")], [STD[k] for k in ("smiley", "star", "multi", "single", "text")], cards, line)


for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = ""
    DARK_ON = t["DARK"]
    for name, fn in (("PageForms", forms_list), ("PageFormOnboarding", onboarding), ("PageFormCheckIn", checkin)):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(fn(d, t))
print("ok")
