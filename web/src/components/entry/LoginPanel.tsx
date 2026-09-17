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
  const isFirstRenderRef = useRef(true);
  const swapRef = useRef<HTMLDivElement>(null);

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

  // Focus moves to the swapped-in form's first field on every real swap,
  // never on first mount (a fresh page load must not steal focus).
  //
  // The guard must reset itself in a CLEANUP function, not just read-then-
  // flip the ref inline in the effect body. StrictMode double-invokes every
  // effect at mount time (invoke → cleanup → invoke, dev-only) to surface
  // exactly this class of bug: the first invocation flips the ref to
  // false and returns; without a cleanup, the second (StrictMode-simulated)
  // invocation then sees it already false and proceeds to call .focus() —
  // on the very first real page load. That silently auto-focused
  // #entry-firstName on a cold `/register` load, so the first interaction
  // afterward (even an inert click on a disabled submit button) blurred an
  // empty required field and surfaced its "required" error out of nowhere
  // (confirmed via `document.activeElement` in a real browser — see #1058
  // validation-feedback rework). Restoring the ref in the cleanup cancels
  // the double-invoke out: mount ends up looking like a single skipped run
  // in both dev and production, while a later real swap (mount already
  // settled, no cleanup pending) still focuses the new field once.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return () => {
        isFirstRenderRef.current = true;
      };
    }

    const firstField = swapRef.current?.querySelector<HTMLInputElement>(
      'input:not([type="checkbox"])'
    );
    firstField?.focus({ preventScroll: true });
  }, [display.key]);

  return (
    <div className="grid grid-rows-[auto_1fr_auto] gap-4.5 border-t border-border bg-surface px-7 py-10 sm:px-11 panel:sticky panel:top-0 panel:col-start-2 panel:row-span-full panel:h-screen panel:overflow-y-auto panel:border-t-0 panel:border-l panel:py-8">
      <h2 className="text-auth-title font-bold text-ink">{t('entry.panel.headline')}</h2>

      <div
        key={display.key}
        ref={swapRef}
        onAnimationEnd={phase === 'leaving' ? handleLeaveAnimationEnd : undefined}
        className={cn(
          'flex flex-col gap-4.5 self-center-safe',
          !reducedMotion && (phase === 'leaving' ? 'animate-panel-out' : 'animate-panel-in')
        )}
      >
        {display.element}
      </div>

      <LanguageSwitcher />
    </div>
  );
}
