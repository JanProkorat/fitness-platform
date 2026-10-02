"""Workout-done screens (per block) and the session summary."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen7.py")).read().split("NEW7 = {")[0]
exec(_src)
PATHS.update({"trophy": '<path d="M8 4h8v5a4 4 0 0 1-8 0z"></path><path d="M8 6H5a3 3 0 0 0 3 4"></path><path d="M16 6h3a3 3 0 0 1-3 4"></path><path d="M12 13v4"></path><path d="M8.5 20h7"></path>'})


def done_hero(step, name, fmt, time):
    return f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 20px; text-align: center">
{soft_icon("check", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", 52)}
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: %%TRAIN_TEXT%%; padding-top: 6px">WORKOUT {step} DONE</span>
<h1 style="{H1}">{name}</h1>
<span style="{ROW}; gap: 8px; font-size: 13px; color: %%MUTED%%">{fmt_chip(fmt)}{ic("clock", 13, sw="1.8")}{time}</span></div>'''


def stats(*items):
    cells = ""
    for i, (v, l) in enumerate(items):
        sep = "border-left: 1px solid %%HAIR%%;" if i else ""
        cells += f'<span style="flex-grow: 1; flex-basis: 0; {sep} display: flex; flex-direction: column; align-items: center; gap: 2px"><span style="{DISP}; font-size: 20px; font-weight: 600">{v}</span><span style="font-size: 12px; color: %%MUTED%%">{l}</span></span>'
    return f'<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 4px; display: flex">{cells}</div>'


def effort(value=7, label="Hard"):
    return f'''<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px">
<div style="{ROW}"><span style="font-size: 14px; font-weight: 500">How hard was it?</span><span style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%TRAIN_TEXT%%">{value} · {label}</span></div>
{seg_scale("Effort", value, 10, "%%TRAIN_TEXT%%")}</div>'''


def next_card(letter, name, fmt, detail):
    return f'''<div style="margin: 0 16px; border-radius: 20px; background: %%SEG%%; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: %%MUTED%%">UP NEXT</span>
<div style="{ROW}; gap: 10px"><span style="width: 26px; height: 26px; border-radius: 13px; background: %%CARD%%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">{letter}</span><span style="font-size: 16px; font-weight: 600">{name}</span><span style="margin-left: auto">{fmt_chip(fmt)}</span></div>
<span style="font-size: 13px; color: %%INK2%%; padding-left: 36px">{detail}</span></div>'''


def set_chips(reps, pr=None):
    out = "".join(f'<span style="min-width: 26px; height: 24px; padding: 0 6px; box-sizing: border-box; border-radius: 8px; background: {"%%TRAIN_SOFT%%" if i == pr else "%%SEG%%"}; color: {"%%TRAIN_TEXT%%" if i == pr else "%%INK2%%"}; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center">{r}</span>' for i, r in enumerate(reps))
    return f'<span style="display: flex; gap: 4px">{out}</span>'


# ---------------------------------------------------------------- A · Strength done
def done_strength(mode, t):
    ex = f'''<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 4px 16px">
<div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0"><div style="{ROW}"><span style="font-size: 15px; font-weight: 500">Back squat</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">80 kg · 1,920 kg</span></div>{set_chips(["6", "6", "6", "5"])}</div>
<div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-top: 1px solid %%HAIR%%"><div style="{ROW}"><span style="font-size: 15px; font-weight: 500">Bench press</span><span style="margin-left: 8px; {ROW}; gap: 4px; padding: 2px 7px; border-radius: 999px; background: %%TRAIN_SOFT%%; color: %%TRAIN_TEXT%%; font-size: 11px; font-weight: 700">{ic("trophy", 11, sw="2")}PR</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">45–47.5 kg · 1,440 kg</span></div>{set_chips(["8", "8", "8", "8"], 3)}</div>
</div>'''
    body = body_top(f'''{done_hero("A OF 3", "Strength", "Sets &amp; reps", "16:40")}
{stats(("16:40", "Time"), ("8 / 8", "Sets"), ("3,360 kg", "Volume"))}
{ex}
{effort(7, "Hard")}
{next_card("B", "Conditioning", "AMRAP · 12 min", "Kettlebell swings, box jumps, push-ups")}''', top=70, gap=12)
    return screen("Workout done strength", body + fade() + cta("Start AMRAP", "play", "%%TRAIN%%", "%%ON%%", "0 8px 22px rgba(242,140,56,0.3)"), t, mode)


# ---------------------------------------------------------------- B · AMRAP done (holds the score)
def done_amrap(mode, t):
    splits = [1.6, 1.75, 1.8, 1.85, 1.95, 2.05]
    hi = max(splits)
    bars = "".join(f'<span style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="width: 100%; height: {round(s / hi * 54)}px; border-radius: 6px 6px 3px 3px; background: %%TRAIN%%; opacity: {0.55 + i * 0.07:.2f}"></span><span style="font-size: 11px; color: %%MUTED%%">{i + 1}</span></span>' for i, s in enumerate(splits))
    score = f'''<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px">
<div style="{ROW}"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Score</span><span style="{DISP}; font-size: 26px; font-weight: 600">6 rounds + 4 reps</span></span><button style="margin-left: auto; height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid %%HAIR%%; background: transparent; color: %%INK2%%; font: 500 13px 'DM Sans', sans-serif">Edit</button></div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; color: %%MUTED%%">Time per round · slowest 2:03</span><div style="display: flex; align-items: flex-end; gap: 6px; height: 72px">{bars}</div></div>
</div>'''
    body = body_top(f'''{done_hero("B OF 3", "Conditioning", "AMRAP · 12 min", "12:00")}
{score}
{stats(("194", "Total reps"), ("1:57", "Avg round"), ("+1", "vs last time"))}
{effort(8, "Very hard")}
{next_card("C", "Finisher", "Tabata · 4 min", "Air bike, burpees, mountain climbers, jump squats")}''', top=70, gap=12)
    return screen("Workout done AMRAP", body + fade() + cta("Start Tabata", "play", "%%TRAIN%%", "%%ON%%", "0 8px 22px rgba(242,140,56,0.3)"), t, mode)


# ---------------------------------------------------------------- C · Tabata done (last block)
def done_tabata(mode, t):
    reps = [("Air bike", 14), ("Burpees", 9), ("Mountain climbers", 22), ("Jump squats", 13), ("Air bike", 13), ("Burpees", 8), ("Mountain climbers", 20), ("Jump squats", 12)]
    hi = max(r for _, r in reps)
    bars = "".join(f'<span style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="font-size: 11px; font-weight: 600">{r}</span><span style="width: 100%; height: {round(r / hi * 50)}px; border-radius: 6px 6px 3px 3px; background: %%TRAIN%%; opacity: {0.9 if i < 4 else 0.6}"></span><span style="font-size: 11px; color: %%MUTED%%">{i + 1}</span></span>' for i, (_, r) in enumerate(reps))
    per_move = "".join(f'<div style="{ROW}; padding: 10px 0; border-top: {"1px solid %%HAIR%%" if i else "none"}"><span style="font-size: 14px">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{a} + {b} reps</span></div>' for i, (n, a, b) in enumerate([("Air bike", 14, 13), ("Burpees", 9, 8), ("Mountain climbers", 22, 20), ("Jump squats", 13, 12)]))
    last = f'''<div style="margin: 0 16px; border-radius: 20px; background: %%SEG%%; padding: 14px 16px; {ROW}">{soft_icon("check", "%%CARD%%", "%%NUTRI_TEXT%%", 32)}<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">That was the last workout</span><span style="font-size: 13px; color: %%MUTED%%">3 of 3 done · see how the session went</span></span></div>'''
    body = body_top(f'''{done_hero("C OF 3", "Finisher", "Tabata · 4 min", "4:00")}
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px"><div style="{ROW}"><span style="font-size: 14px; font-weight: 500">Reps per round</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">111 total</span></div><div style="display: flex; align-items: flex-end; gap: 6px; height: 80px">{bars}</div></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 4px 16px">{per_move}</div>
{effort(9, "Near max")}
{last}''', top=70, gap=12)
    return screen("Workout done Tabata", body + fade() + cta("See session summary", "chevron"), t, mode)


# ---------------------------------------------------------------- Session summary
def session_summary(mode, t):
    parts = [("A", 16 * 60 + 40, "%%TRAIN%%", 1.0), ("rest", 5 * 60 + 10, "%%MUTED%%", 0.3), ("B", 12 * 60, "%%TRAIN%%", 0.7),
             ("rest", 9 * 60 + 30, "%%MUTED%%", 0.3), ("C", 4 * 60, "%%TRAIN%%", 0.45)]
    total = sum(p[1] for p in parts)
    bar = "".join(f'<span style="flex-grow: {s}; flex-basis: 0; height: 10px; background: {c}; opacity: {o}"></span>' for _, s, c, o in parts)
    legend_item = lambda c, o, l: f'<span style="{ROW}; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 2px; background: {c}; opacity: {o}"></span>{l}</span>'

    def row(letter, name, fmt, time, result, first=False):
        return f'<a href="#" style="{ROW}; padding: 12px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"} color: %%INK%%; {A}"><span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; background: %%SEG%%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">{letter}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 500">{name} <span style="color: %%MUTED%%; font-weight: 400">· {fmt}</span></span><span style="font-size: 13px; color: %%INK2%%">{result}</span></span><span style="margin-left: auto; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums">{time}</span></a>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0 20px; text-align: center">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: %%TRAIN_TEXT%%">SESSION COMPLETE</span>
<h1 style="{H1}">Full body C</h1><span style="font-size: 13px; color: %%MUTED%%">Saturday, 3 October · 3 workouts</span></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px; display: flex; flex-direction: column; gap: 10px">
<div style="{ROW}; align-items: baseline"><span style="{BIG}; font-size: 52px; line-height: 1">47:20</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">total time</span></div>
<div style="display: flex; gap: 2px; border-radius: 5px; overflow: hidden">{bar}</div>
<div style="display: flex; gap: 14px; font-size: 12px; color: %%MUTED%%">{legend_item("%%TRAIN%%", 1, "Workouts 32:40")}{legend_item("%%MUTED%%", 0.3, "Rest between 14:40")}</div></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{row("A", "Strength", "sets &amp; reps", "16:40", "8 sets · 3,360 kg · 1 PR", True)}{row("B", "Conditioning", "AMRAP", "12:00", "6 rounds + 4 reps")}{row("C", "Finisher", "Tabata", "4:00", "8 rounds · 111 reps")}</div>
<div style="margin: 0 16px; border-radius: 20px; background: %%TRAIN_SOFT%%; padding: 12px 16px; {ROW}">{soft_icon("trophy", "%%CARD%%", "%%TRAIN_TEXT%%", 32)}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 600">New personal record</span><span style="font-size: 13px; color: %%INK2%%">Bench press · 47.5 kg × 8</span></span></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px">
<div style="{ROW}"><span style="font-size: 14px; font-weight: 500">How do you feel?</span><span style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%NUTRI_TEXT%%">Good</span></div>{seg_scale("Mood", 4, 5, "%%NUTRI_TEXT%%")}
<span style="margin-top: 4px; min-height: 44px; padding: 10px 12px; box-sizing: border-box; border-radius: 12px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 14px; color: %%MUTED%%">Note for Martin (optional)</span></div>''', top=60, gap=12)
    return screen("Session summary", body + fade() + cta("Finish", "check"), t, mode)


NEW8 = {"DoneStrength": done_strength, "DoneAmrap": done_amrap, "DoneTabata": done_tabata, "SessionSummary": session_summary}
for mode, t in MODES.items():
    for label_, fn in NEW8.items():
        with open(os.path.join(HERE, "project", f"Glass{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
        print(f"Glass{label_}{mode}.dc.html")
