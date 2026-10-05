"""Workouts list (this plan / all plans), workout detail, exercise detail — mirrors recipes/ingredients."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen11.py")).read().split("NEW11 = {")[0]
exec(_src)

WORKOUTS = [
    ("Lower body A", "Strength", "Sets & reps", "6 exercises · 55 min", True, "Thu"),
    ("Conditioning", "AMRAP", "AMRAP · 12 min", "3 exercises · 12 min", True, "Sat"),
    ("Finisher", "Tabata", "Tabata · 4 min", "4 exercises · 4 min", True, "Sat"),
    ("Upper body B", "Strength", "Sets & reps", "5 exercises · 50 min", False, "Last done 26 Sep"),
    ("Engine builder", "EMOM", "EMOM · 10 min", "2 exercises · 10 min", False, "Last done 24 Sep"),
    ("21-15-9", "For Time", "For time · cap 15 min", "2 exercises", False, "Last done 19 Sep"),
]
FORMAT_ICON = {"Strength": "dumbbell", "AMRAP": "clock", "Tabata": "clock", "EMOM": "clock", "For Time": "clock"}


def workout_row(name, fmt, chip_text, meta, week, when, first=False):
    tag = '<span style="padding: 2px 7px; border-radius: 999px; background: %%TRAIN%%; color: %%ON%%; font-size: 11px; font-weight: 600">This week</span>' if week else ""
    return f'''<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 12px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"} color: %%INK%%; {A}">
{soft_icon(FORMAT_ICON[fmt], "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", 40)}
<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="display: flex; align-items: center; gap: 6px"><span style="font-size: 15px; font-weight: 600">{name}</span>{tag}</span>
<span style="font-size: 12px; color: %%MUTED%%">{chip_text} · {meta}</span><span style="font-size: 12px; color: %%MUTED%%">{"Planned: " + when if week else when}</span></span>
<span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a>'''


def workouts_list(mode, t, scope):
    this = scope == "plan"
    if this:
        rows = "".join(workout_row(*w, first=i == 0) for i, w in enumerate(WORKOUTS))
        content = f'''<div style="padding: 0 20px; font-size: 12px; color: %%MUTED%%">14 workouts in Strength block 2 · 3 this week</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div>'''
    else:
        cur = "".join(workout_row(*w, first=i == 0) for i, w in enumerate(WORKOUTS[:3]))
        old = "".join(workout_row(*w, first=i == 0) for i, w in enumerate([("Full body A", "Strength", "Sets & reps", "6 exercises · 50 min", False, "Mar – Jun"), ("Hill sprints", "EMOM", "EMOM · 8 min", "1 exercise · 8 min", False, "Mar – Jun")]))
        sec = lambda title, sub, color, rows: f'<div style="display: flex; flex-direction: column; gap: 8px"><span style="padding: 0 20px; display: flex; align-items: center; gap: 8px"><span style="width: 4px; height: 16px; border-radius: 2px; background: {color}"></span><span style="font-size: 14px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></span><div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div></div>'
        content = f'''<div style="padding: 0 20px; font-size: 12px; color: %%MUTED%%">31 workouts across 2 plans</div>
{sec("Strength block 2", "Martin · now · 14", "%%TRAIN%%", cur)}
{sec("Strength block 1", "Martin · Mar – Jun · 17", "%%MUTED%%", old)}'''
    body = body_top(f'''<div style="padding: 0 20px"><h1 style="{H1}">Workouts</h1></div>
<div style="padding: 0 16px">{seg(["This plan", "All plans"], "This plan" if this else "All plans")}</div>
<div style="padding: 0 16px; display: flex; gap: 8px; overflow: hidden">{chip("All", True)}{chip("Strength")}{chip("AMRAP")}{chip("EMOM")}{chip("Tabata")}{chip("For time")}</div>
{content}''', top=84, gap=14)
    return screen(f"Workouts {scope}", body + top_bar(gbtn("back", "Back")) + fade() + search_fab(), t, mode)


def workout_detail(mode, t):
    ex = [("Kettlebell swing", "10 reps · 24 kg", "#E9D9C7"), ("Box jump", "8 reps · 60 cm", "#D9CFC2"), ("Push-up", "6 reps", "#CFC8BE")]
    rows = "".join(f'<a href="#" aria-label="Open {n}" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}; color: %%INK%%; {A}"><span style="position: relative; width: 52px; height: 40px; flex-shrink: 0; border-radius: 10px; background: {c}; color: #141414; display: flex; align-items: center; justify-content: center">{ic("play", 12, sw="2.2")}</span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px">{n}</span><span style="font-size: 12px; color: %%MUTED%%">per round</span></span><span style="margin-left: auto; font-size: 14px; font-weight: 600">{q}</span><span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a>' for i, (n, q, c) in enumerate(ex))
    hist = lambda d, v, best=False: f'<div style="display: flex; align-items: center; padding: 10px 0; border-top: 1px solid %%HAIR%%"><span style="font-size: 14px">{d}</span>{"<span style=\"margin-left: 8px; padding: 2px 7px; border-radius: 999px; background: %%TRAIN_SOFT%%; color: %%TRAIN_TEXT%%; font-size: 11px; font-weight: 700\">Best</span>" if best else ""}<span style="margin-left: auto; font-size: 14px; font-weight: 600">{v}</span></div>'
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 6px">{fmt_chip("AMRAP · 12 min")}<h1 style="{H1}">Conditioning</h1><span style="font-size: 13px; color: %%MUTED%%">3 exercises · used in Full body C</span></div>
<div style="margin: 0 16px; border-radius: 18px; background: %%TRAIN_SOFT%%; padding: 12px 16px; display: flex; gap: 10px"><span style="display: flex; color: %%TRAIN_TEXT%%; padding-top: 1px">{ic("info", 16, sw="1.8")}</span><span style="font-size: 14px; line-height: 1.45">Do as many rounds as you can in 12 minutes. Your score is rounds plus extra reps.</span></div>
<div style="margin: 0 16px; border-radius: 18px; {CARD}; padding: 4px 16px"><div style="display: flex; align-items: center; padding: 8px 0"><span style="{DISP}; font-size: 17px; font-weight: 600">Exercises</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">one round</span></div>{rows}</div>
<div style="margin: 0 16px; border-radius: 18px; {CARD}; padding: 4px 16px 2px"><div style="padding: 8px 0 2px; {DISP}; font-size: 17px; font-weight: 600">Your results</div>{hist("3 Oct", "6 rounds + 4", True)}{hist("26 Sep", "5 rounds + 8")}{hist("19 Sep", "5 rounds + 2")}</div>
<div style="padding: 0 16px">{group("", list_row("In your plan", "Sat · Full body C", icon="calendar", first=True))}</div>''', top=84, gap=12)
    return screen("Workout detail", body + top_bar(gbtn("back", "Back"), "", gbtn("share", "Share")), t, mode)


def exercise_detail(mode, t):
    glass_dark = "background: rgba(20,20,20,0.3); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.25)"
    cue = lambda n, txt: f'<div style="display: flex; gap: 12px; padding: 9px 0; border-top: {"none" if n == 1 else "1px solid %%HAIR%%"}"><span style="width: 22px; height: 22px; flex-shrink: 0; border-radius: 11px; background: %%SEG%%; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center">{n}</span><span style="font-size: 14px; line-height: 1.45; color: %%INK2%%">{txt}</span></div>'
    tag = lambda x: f'<span style="padding: 5px 10px; border-radius: 999px; background: %%TRAIN_SOFT%%; color: %%TRAIN_TEXT%%; font-size: 12px; font-weight: 600">{x}</span>'
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 240px; background: linear-gradient(150deg, #3A3A3E, #1B1B1D); display: flex; align-items: center; justify-content: center">
<span style="width: 60px; height: 60px; border-radius: 30px; background: rgba(255,255,255,0.22); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.35); color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("play", 22, sw="2")}</span>
<span style="position: absolute; left: 20px; bottom: 36px; color: #F6F4F0; font-size: 12px; letter-spacing: 0.08em">[EXERCISE VIDEO]</span></div>
<div style="position: absolute; top: 216px; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; background: %%BG%%; padding: 20px 16px 0; display: flex; flex-direction: column; gap: 12px">
<div style="padding: 0 4px; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; color: %%MUTED%%">Kettlebell · full body</span><h1 style="{H1}; font-size: 26px">Kettlebell swing</h1><div style="display: flex; flex-wrap: wrap; gap: 6px">{tag("Glutes")}{tag("Hamstrings")}{tag("Core")}</div></div>
<div style="border-radius: 18px; background: %%TRAIN_SOFT%%; padding: 12px 16px; display: flex; align-items: center; gap: 10px"><span style="font-size: 13px; color: %%TRAIN_TEXT%%; font-weight: 600">In Conditioning</span><span style="margin-left: auto; font-size: 14px; font-weight: 600">10 reps · 24 kg</span></div>
<div style="border-radius: 18px; {CARD}; padding: 6px 16px"><div style="padding: 6px 0; {DISP}; font-size: 17px; font-weight: 600">How to do it</div>{cue(1, "Hinge at the hips, back flat, bell between your feet.")}{cue(2, "Hike it back, then snap the hips forward.")}{cue(3, "Let the bell float to chest height — arms stay loose.")}</div>
<div style="border-radius: 18px; {CARD}; padding: 12px 16px; display: flex"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Heaviest</span><span style="font-size: 16px; font-weight: 600">28 kg</span></span><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Last time</span><span style="font-size: 16px; font-weight: 600">24 kg × 10</span></span><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Done</span><span style="font-size: 16px; font-weight: 600">11×</span></span></div>
</div>'''
    tb = top_bar(gbtn("back", "Back to workout", style=glass_dark, color="#F6F4F0"))
    return screen("Exercise detail", body + tb, t, mode)


NEW12 = {"WorkoutsPlan": lambda m, t: workouts_list(m, t, "plan"), "WorkoutsAll": lambda m, t: workouts_list(m, t, "all"), "WorkoutDetail": workout_detail, "ExerciseDetail": exercise_detail}
for mode, t in MODES.items():
    for label_, fn in NEW12.items():
        with open(os.path.join(HERE, "project", f"Glass{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
        print(f"Glass{label_}{mode}.dc.html")
