# ---------------------------------------------------------------- email verification
def big_icon(svg_inner, bg, fg):
    return (f'<span style="width: 84px; height: 84px; border-radius: 42px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">'
            f'<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{svg_inner}</svg></span>')


def center_card(inner):
    return (f'<div style="width: 560px; box-sizing: border-box; border-radius: 22px; border: 1px solid %%LINE%%; background: %%SURFACE%%; box-shadow: 0 24px 60px rgba(0,0,0,0.10); '
            f'padding: 32px 40px 36px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center">{inner}</div>')


def verify_page(d, t, card):
    main = f'<main style="padding: 30px {PAD}px 0; display: flex; justify-content: center">{card}</main>'
    body = f'<div style="width: {W}px; height: {H}px; background: {wash()}; {FONT}; color: %%INK%%; overflow: hidden">{reg_topbar(d)}{main}</div>'
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
             f'{nxt("users", "Set up your profile", "Photo, specialties and a short bio")}'
             f'{nxt("chat", "Invite your first client", "They join with the Form Up app")}'
             f'{nxt("calendar", "Build their first week", "From a template or from scratch")}</div>')
    return verify_page(d, t, center_card(inner))


