"""Recipes list (this plan / all plans), recipe detail, ingredient detail."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen10.py")).read().split("NEW10 = {")[0]
exec(_src)

RECIPES = [
    ("Chicken rice bowl", "Lunch", 640, 48, "25 min", "#C9D9A8", "#8CA86A", True),
    ("Oat bowl with berries", "Breakfast", 420, 18, "10 min", "#D8C8E6", "#9C84B8", True),
    ("Salmon, potatoes, greens", "Dinner", 610, 42, "30 min", "#F2C9B1", "#C98D6B", True),
    ("Greek yogurt, honey", "Snack", 180, 17, "2 min", "#F1F1EC", "#CFCBBE", False),
    ("Turkey wrap", "Lunch", 520, 38, "15 min", "#E9D9C7", "#B89A78", False),
    ("Lentil curry", "Dinner", 560, 26, "35 min", "#E7B48F", "#C27C4E", False),
]
PREV = [("Overnight oats", "Breakfast", 390, 20, "5 min", "#E3D6B9", "#B6A27A"), ("Beef stir-fry", "Dinner", 590, 44, "20 min", "#D7A68E", "#A06A52"),
        ("Tuna salad", "Lunch", 430, 36, "10 min", "#BFD3D8", "#7FA0A8")]


def recipe_card(name, meal, kcal, prot, time, c1, c2, week=False, plan=None):
    badge = '<span style="position: absolute; top: 8px; left: 8px; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,0.9); color: #141414; font-size: 11px; font-weight: 600">This week</span>' if week else ""
    sub = f'<span style="font-size: 11px; color: %%MUTED%%">{plan}</span>' if plan else ""
    return f'''<a href="#" style="display: flex; flex-direction: column; gap: 6px; color: %%INK%%; {A}">
<div style="position: relative; height: 112px; border-radius: 16px; background: linear-gradient(150deg, {c1}, {c2})">{badge}</div>
<span style="font-size: 14px; font-weight: 600; line-height: 1.25">{name}</span>
<span style="font-size: 12px; color: %%MUTED%%">{meal} · {kcal} kcal · {prot} g P · {time}</span>{sub}</a>'''


def recipes_list(mode, t, scope):
    this = scope == "plan"
    if this:
        grid = "".join(recipe_card(*r) for r in RECIPES)
        content = f'''<div style="padding: 0 20px; font-size: 12px; color: %%MUTED%%">18 recipes in Cut — phase 2 · 6 this week</div>
<div style="padding: 0 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px">{grid}</div>'''
    else:
        cur = "".join(recipe_card(*r[:7], plan=None) for r in RECIPES[:2])
        old = "".join(recipe_card(*r, plan=None) for r in PREV[:2])
        sec = lambda title, sub, color, cards: f'<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 10px"><span style="display: flex; align-items: center; gap: 8px"><span style="width: 4px; height: 16px; border-radius: 2px; background: {color}"></span><span style="font-size: 14px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></span><div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px">{cards}</div></div>'
        content = f'''<div style="padding: 0 20px; font-size: 12px; color: %%MUTED%%">41 recipes across 2 plans</div>
{sec("Cut — phase 2", "Jana · now · 18", "%%NUTRI%%", cur)}
{sec("Cut — phase 1", "Jana · Mar – Jun · 23", "%%MUTED%%", old)}'''
    body = body_top(f'''<div style="padding: 0 20px"><h1 style="{H1}">Recipes</h1></div>
<div style="padding: 0 16px">{seg(["This plan", "All plans"], "This plan" if this else "All plans")}</div>
<div style="padding: 0 16px; display: flex; gap: 8px; overflow: hidden">{chip("All", True)}{chip("Breakfast")}{chip("Lunch")}{chip("Dinner")}{chip("Snack")}</div>
{content}''', top=84, gap=14)
    return screen(f"Recipes {scope}", body + top_bar(gbtn("back", "Back")) + fade() + search_fab(), t, mode)


PORTIONS = 3
# per-portion base: (name, grams-or-text per portion, kcal per portion, thumb colour, unit formatter)
BASE = [("Chicken breast", 150, 165, "#E9D9C7", "g"), ("Jasmine rice, cooked", 230, 297, "#EFEBE1", "g"), ("Broccoli", 150, 51, "#A9C79B", "g"),
        ("Olive oil", 14, 124, "#E6D48A", "tbsp"), ("Soy sauce", 5, 3, "#8A6A52", "tsp")]


def amount(q, unit, n):
    if unit == "g":
        return f"{q * n:,} g"
    per = {"tbsp": 14, "tsp": 5}[unit]
    return f"{n} {unit} · {q * n} g"


def recipe_detail(mode, t):
    n = PORTIONS
    rows = "".join(f'<a href="#" aria-label="Open {name}" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}; color: %%INK%%; {A}"><span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; background: {c}"></span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px">{name}</span><span style="font-size: 12px; color: %%MUTED%%">{k * n:,} kcal</span></span><span style="margin-left: auto; font-size: 14px; font-weight: 600">{amount(q, u, n)}</span><span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a>' for i, (name, q, k, c, u) in enumerate(BASE))
    mac = lambda l, v, c: f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; align-items: center"><span style="font-size: 16px; font-weight: 600">{v}</span><span style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: %%MUTED%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {c}"></span>{l}</span></span>'
    portions = f'''<div style="border-radius: 18px; {CARD}; padding: 12px 16px; display: flex; align-items: center; gap: 12px">
<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 600">Portions</span><span style="font-size: 12px; color: %%MUTED%%">Plan says 1 · amounts update below</span></span>
<span style="margin-left: auto; display: flex; align-items: center; gap: 12px">{round_btn("minus", "Fewer portions", 34)}<span style="{DISP}; font-size: 24px; font-weight: 600; min-width: 18px; text-align: center">{n}</span>{round_btn("plus", "More portions", 34)}</span></div>'''
    glass_dark = "background: rgba(20,20,20,0.3); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.25)"
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 220px; background: linear-gradient(150deg, #C9D9A8, #8CA86A); display: flex; align-items: flex-end; padding: 0 20px 34px; box-sizing: border-box; color: #1B1B1D; font-size: 12px; letter-spacing: 0.08em">[RECIPE PHOTO]</div>
<div style="position: absolute; top: 196px; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; background: %%BG%%; padding: 18px 16px 0; display: flex; flex-direction: column; gap: 10px">
<div style="padding: 0 4px; display: flex; flex-direction: column; gap: 6px"><span style="display: flex; gap: 6px">{role_chip_custom("Lunch")}{role_chip_custom("High protein")}<span style="font-size: 12px; color: %%MUTED%%; display: flex; align-items: center; gap: 4px">{ic("clock", 12, sw="1.8")}25 min</span></span><h1 style="{H1}; font-size: 26px">Chicken rice bowl</h1></div>
{portions}
<div style="border-radius: 18px; {CARD}; padding: 10px 4px 12px; display: flex; flex-direction: column; gap: 8px"><div style="padding: 0 12px">{seg(["Per portion", f"All {n} portions"], "Per portion")}</div><div style="display: flex">{mac("kcal", "640", "%%INK%%")}{mac("Protein", "48 g", "%%PROT%%")}{mac("Carbs", "72 g", "%%CARB%%")}{mac("Fat", "16 g", "%%FAT%%")}{mac("Fiber", "6 g", "%%FIB%%")}</div></div>
<div style="border-radius: 18px; {CARD}; padding: 4px 16px"><div style="display: flex; align-items: center; padding: 8px 0"><span style="{DISP}; font-size: 17px; font-weight: 600">Ingredients</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">for {n} portions</span></div>{rows}</div>
</div>'''
    tb = top_bar(gbtn("back", "Back", style=glass_dark, color="#1B1B1D"), "", gbtn("share", "Share", style=glass_dark, color="#1B1B1D"))
    return screen("Recipe detail", body + tb + fade() + cta("How to make it · 5 steps", "chevron"), t, mode)


def cooking_steps(mode, t):
    n = PORTIONS
    steps = [
        ("Cook the rice", f"Cook enough rice for <b>{230 * n} g</b> cooked — about {80 * n} g dry in {200 * n} ml water.", "12 min", "done"),
        ("Prepare the chicken", f"Cut <b>{150 * n} g chicken breast</b> into strips. Season with salt and pepper.", None, "now"),
        ("Fry", f"Heat <b>{n} tbsp olive oil</b> in a pan. Fry the chicken until golden.", "7 min", "todo"),
        ("Steam the broccoli", f"Steam <b>{150 * n} g broccoli</b> until bright green and tender.", "5 min", "todo"),
        ("Serve", f"Split rice, chicken and broccoli into {n} bowls. Drizzle each with 1 tsp soy sauce.", None, "todo"),
    ]
    cards = ""
    for i, (title, text, timer, st) in enumerate(steps):
        now, done = st == "now", st == "done"
        num = (f'<span style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="2.6")}</span>' if done
               else f'<span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 14px; border: 1.5px solid {"%%NUTRI%%" if now else "%%HAIR%%"}; font-size: 13px; font-weight: 600; color: {"%%NUTRI_TEXT%%" if now else "%%MUTED%%"}; display: flex; align-items: center; justify-content: center">{i + 1}</span>')
        tm = (f'<button style="align-self: flex-start; height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid %%HAIR%%; background: transparent; color: %%NUTRI_TEXT%%; font: 600 13px \'DM Sans\', sans-serif; display: flex; align-items: center; gap: 5px">{ic("clock", 13, sw="2")}{"Done · " if done else "Start "}{timer}</button>' if timer else "")
        bg = "background: %%NUTRI_SOFT%%;" if now else f"{CARD};"
        cards += f'''<div style="border-radius: 18px; {bg} padding: 14px 16px; display: flex; gap: 12px; opacity: {0.55 if done else 1}">{num}
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 15px; font-weight: 600">{title}</span><span style="font-size: 14px; line-height: 1.5; color: %%INK2%%">{text}</span>{tm}</div></div>'''
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: %%MUTED%%">Chicken rice bowl</span><h1 style="{H1}">How to make it</h1></div>
<div style="margin: 0 16px; display: flex; align-items: center; gap: 10px"><span style="padding: 5px 11px; border-radius: 999px; background: %%NUTRI_SOFT%%; color: %%NUTRI_TEXT%%; font-size: 12px; font-weight: 600">For {n} portions</span><span style="font-size: 12px; color: %%MUTED%%">Step 2 of 5 · about 25 min</span></div>
<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px">{cards}</div>''', top=84, gap=12)
    return screen("Cooking steps", body + top_bar(gbtn("back", "Back to recipe")) + fade() + cta("Next step", "chevron", "%%NUTRI%%", "%%ON%%", "0 8px 22px rgba(140,193,82,0.3)"), t, mode)


def role_chip_custom(text):
    return f'<span style="padding: 3px 8px; border-radius: 999px; background: %%NUTRI_SOFT%%; color: %%NUTRI_TEXT%%; font-size: 11px; font-weight: 600">{text}</span>'


def ingredient_detail(mode, t):
    per = [("Protein", 23.0, "%%PROT%%", 77), ("Carbs", 0.0, "%%CARB%%", 0), ("Fat", 1.5, "%%FAT%%", 5), ("Fiber", 0.0, "%%FIB%%", 0)]
    rows = "".join(f'<div style="display: flex; flex-direction: column; gap: 5px; padding: 8px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}"><div style="display: flex; font-size: 14px"><span style="display: flex; align-items: center; gap: 6px; color: %%INK2%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {c}"></span>{l}</span><span style="margin-left: auto; font-weight: 600">{v:g} g</span></div>{thin_bar(p, c, 3)}</div>' for i, (l, v, c, p) in enumerate(per))
    tag = lambda x, soft="%%NUTRI_SOFT%%", ink="%%NUTRI_TEXT%%": f'<span style="padding: 5px 10px; border-radius: 999px; background: {soft}; color: {ink}; font-size: 12px; font-weight: 600">{x}</span>'
    glass_dark = "background: rgba(20,20,20,0.3); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.25)"
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 220px; background: linear-gradient(150deg, #EFE3D3, #D4B898); display: flex; align-items: flex-end; padding: 0 20px 34px; box-sizing: border-box; color: #1B1B1D; font-size: 12px; letter-spacing: 0.08em">[INGREDIENT PICTURE]</div>
<div style="position: absolute; top: 196px; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; background: %%BG%%; padding: 20px 16px 0; display: flex; flex-direction: column; gap: 12px">
<div style="padding: 0 4px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 12px; color: %%MUTED%%">Meat</span><h1 style="{H1}; font-size: 26px">Chicken breast</h1></div>
<div style="border-radius: 18px; background: %%NUTRI_SOFT%%; padding: 12px 16px; display: flex; align-items: center; gap: 10px"><span style="font-size: 13px; color: %%NUTRI_TEXT%%; font-weight: 600">In Chicken rice bowl · 3 portions</span><span style="margin-left: auto; font-size: 14px; font-weight: 600">450 g · 495 kcal</span></div>
<div style="border-radius: 18px; {CARD}; padding: 12px 16px 6px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; align-items: baseline"><span style="{DISP}; font-size: 17px; font-weight: 600">Per 100 g</span><span style="margin-left: auto"><span style="{DISP}; font-size: 22px; font-weight: 600">110</span><span style="font-size: 13px; color: %%MUTED%%"> kcal</span></span></div>{rows}</div>
<div style="border-radius: 18px; {CARD}; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">
<span style="font-size: 13px; color: %%MUTED%%">Suits</span><div style="display: flex; flex-wrap: wrap; gap: 6px">{tag("Gluten-free")}{tag("Lactose-free")}{tag("Dairy-free")}{tag("Keto")}{tag("Low-carb")}</div>
<span style="font-size: 13px; color: %%MUTED%%; padding-top: 4px">Allergens</span><span style="font-size: 14px">None listed</span>
<span style="font-size: 13px; color: %%MUTED%%; padding-top: 4px">Unit</span><span style="font-size: 14px">1 portion = 150 g</span></div>
</div>'''
    tb = top_bar(gbtn("back", "Back to recipe", style=glass_dark, color="#1B1B1D"))
    return screen("Ingredient detail", body + tb, t, mode)


NEW11 = {"RecipesPlan": lambda m, t: recipes_list(m, t, "plan"), "RecipesAll": lambda m, t: recipes_list(m, t, "all"), "RecipeDetail": recipe_detail, "CookingSteps": cooking_steps, "IngredientDetail": ingredient_detail}
for mode, t in MODES.items():
    for label_, fn in NEW11.items():
        with open(os.path.join(HERE, "project", f"Glass{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
        print(f"Glass{label_}{mode}.dc.html")
