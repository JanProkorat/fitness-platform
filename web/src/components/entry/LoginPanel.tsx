import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import LanguageSwitcher from '@/components/entry/LanguageSwitcher';

interface DisplayedRoute {
  key: string;
  element: ReactNode;
}

type SwapPhase = 'idle' | 'leaving';

/**
 * Tracks `prefers-reduced-motion` in JS (not CSS) — see the cross-fade
 * comment below for why a CSS-only `animation: none` is not enough here.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}

/**
 * Login panel SHELL (#1058) — the standing community headline, the
 * language switch, and the cross-fade swap area for the login/register/
 * forgot-password forms rendered via App.tsx's pathless layout route
 * (`<Route element={<EntryPage />}>` wrapping the three form routes). No
 * login-specific markup lives here — every form is its own route element
 * behind the swap area below.
 *
 * The headline and the swap area are SIBLING grid rows, not a shared
 * centred flex column: centring the two together (the pre-split shell's
 * `flex flex-col justify-center`) makes the headline drift up and down
 * every time the form swaps to one of a different height, which reads as
 * the page jumping. Pinning the headline to its own `auto` row and only
 * centring the swap-area row fixes that.
 *
 * Cross-fade: a bare `<Outlet />` unmounts the outgoing route element the
 * instant the location changes, so there is no "leaving" phase to animate.
 * `useOutlet()` resolves the matched route's element as a value without
 * mounting it here, so the previous element can be held in state and
 * swapped out-then-in by hand: the outgoing form plays the leaving
 * animation, and only once it finishes do we commit the incoming element
 * and let it play the entering one — the two are never mounted together.
 * The swap wrapper is keyed by pathname so React treats each route's form
 * as a distinct instance; without that key, two different forms would
 * reconcile into a single component instance and leak local state (field
 * values, validation) across the swap.
 */
export default function LoginPanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const outlet = useOutlet();
  const reducedMotion = usePrefersReducedMotion();

  const [display, setDisplay] = useState<DisplayedRoute>(() => ({
    key: location.pathname,
    element: outlet,
  }));
  const [phase, setPhase] = useState<SwapPhase>('idle');
  const swapRef = useRef<HTMLDivElement>(null);
  // Tracks which `display.key` the focus effect below has already run for.
  // Seeded with the initial key so the effect's first invocation (the cold
  // mount) is recognised as "already handled" rather than as a swap.
  const focusedKeyRef = useRef(display.key);

  // The route changed since the last commit. This adjusts state directly
  // during render — React's documented pattern for "adjusting state when
  // a prop changes" — rather than a useEffect: a useEffect whose entire
  // body derives a setState call from a prop comparison and then returns
  // is exactly the redundant-derived-state shape the
  // react-hooks/set-state-in-effect lint rule flags, and there genuinely
  // is no external system to synchronize with yet at this point — that
  // happens once the CSS animation completes, in the real event handler
  // (handleLeaveAnimationEnd) below.
  //
  // Both branches are idempotent and self-terminating: once `display.key`
  // or `phase` reflects the change, the condition guarding each setState
  // call goes false, so this can't loop and is safe to run on every
  // render (including React StrictMode's double-invoke).
  if (location.pathname !== display.key) {
    if (reducedMotion) {
      setDisplay({ key: location.pathname, element: outlet });
      if (phase !== 'idle') {
        setPhase('idle');
      }
    } else if (phase !== 'leaving') {
      setPhase('leaving');
    }
  }

  // Commits the pending route once the leaving animation finishes. A plain
  // event handler, not an effect — reads the latest location/outlet at the
  // moment it actually fires, so a second navigation mid-animation is
  // picked up correctly instead of resolving to a stale intermediate route.
  const handleLeaveAnimationEnd = () => {
    setDisplay({ key: location.pathname, element: outlet });
    setPhase('idle');
  };

  // Focus moves to the swapped-in form's CONTAINER on every real swap, never
  // on first mount (a fresh page load must not steal focus) — and never into
  // a FIELD inside it. This compares `display.key` against a ref of the last
  // key the effect already ran for, rather than a boolean "first render"
  // flag with a re-arming cleanup. React runs an effect's cleanup before
  // EVERY re-run triggered by a dependency change, not only on unmount — so
  // a boolean guard reset inside its own cleanup gets re-armed on every
  // single swap, not just the mount, and the guard branch swallows every
  // real swap too (`focus()` never reached; confirmed via
  // `document.activeElement` staying BODY across a `/register` → `/` swap at
  // +0..+2500ms — see #1058 QA). A ref comparison has no cleanup to re-arm:
  // it is seeded with the mount's own key, so the mount's invocation sees
  // "already handled" and skips, while a real swap's invocation sees a
  // different key, updates the ref, and focuses once.
  //
  // The focus target is `swapRef` itself (given `tabIndex={-1}` below), NOT
  // the form's first input. Focusing straight into the first field was tried
  // first and had to be reverted: RegisterForm runs React Hook Form in
  // `mode: 'onTouched'`, so a swap into it left the never-typed
  // #entry-firstName focused, and the user's very next click anywhere (e.g.
  // the consent checkbox) blurred it first — marking it touched, rendering
  // its "required" error, growing the form ~24px, and (via
  // `self-center-safe`) re-centring the swap row out from under the pointer
  // between mousedown and mouseup, swallowing that first click entirely.
  // Landing on the container instead still satisfies the requirement (a
  // keyboard user's next Tab enters the first field, and reduces
  // disorientation for screen-reader users, who hear the new form's heading)
  // without touching, validating, or blurring any field.
  useEffect(() => {
    if (focusedKeyRef.current === display.key) {
      return;
    }
    focusedKeyRef.current = display.key;

    swapRef.current?.focus({ preventScroll: true });
  }, [display.key]);

  return (
    <div className="grid grid-rows-[auto_1fr_auto] gap-4.5 border-t border-border bg-surface px-7 py-10 sm:px-11 panel:sticky panel:top-0 panel:col-start-2 panel:row-span-full panel:h-screen panel:overflow-y-auto panel:border-t-0 panel:border-l panel:py-8">
      <h2 className="text-auth-title font-bold text-ink">{t('entry.panel.headline')}</h2>

      <div
        key={display.key}
        ref={swapRef}
        data-testid="entry-swap"
        // -1: a focus SINK for the swap-commit effect above, not a tab stop
        // of its own — the container is never reached by pressing Tab, only
        // targeted programmatically. `outline-none` because that
        // programmatic focus has no visual affordance to show; a sighted
        // keyboard user's next real Tab press lands on the form's first
        // field and gets its own visible focus ring there.
        tabIndex={-1}
        onAnimationEnd={phase === 'leaving' ? handleLeaveAnimationEnd : undefined}
        className={cn(
          'flex flex-col gap-4.5 self-center-safe outline-none',
          !reducedMotion && (phase === 'leaving' ? 'animate-panel-out' : 'animate-panel-in')
        )}
      >
        {display.element}
      </div>

      <LanguageSwitcher />
    </div>
  );
}
