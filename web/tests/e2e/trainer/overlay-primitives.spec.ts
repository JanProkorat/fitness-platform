/**
 * #1090 — overlay primitives (Dialog, Popover, HoverCard, DropdownMenu, Toast)
 * animate their exit.
 *
 * Same root cause #1081 fixed for the Sheet: these primitives used CSS
 * `transition`s, which Radix's Presence can't see (no `animationName`), so the
 * element unmounted on the same tick the close was triggered. Presence only
 * suspends removal when the computed `animation-name` CHANGES between open and
 * closed, so each state needs its own distinct `@keyframes` name.
 *
 * Per primitive this spec proves:
 *   A. CSS contract — `animation-name` on open is the expected token.
 *   B. Exit suspension — after close the element is still attached with
 *      `data-state="closed"`, carries a DIFFERENT animation name, and only
 *      then disappears. (`animation-name` persists in computed style after the
 *      animation ends, so A is not a transient assertion.)
 *   C. Reduced motion — `animation-duration` collapses to 0.001s (the #1081
 *      media-query duration collapse) and the element still unmounts.
 *
 * Popover / HoverCard / DropdownMenu are positioned by Radix, which stamps
 * `data-side`; their keyframes are per side, so the expected name is read from
 * that attribute at runtime rather than assumed.
 *
 * Each primitive is reached on /clients as trainerTest; nothing here writes
 * backend state (the toast's POST is stubbed).
 */
import type { Locator, Page } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

interface AnimatedSlot {
  /** Locator for the animated element. */
  locate: (page: Page) => Locator;
  /** Expected `animation-name` on open; receives Radix's `data-side` (null if none). */
  inName: (side: string | null) => string;
  /** Expected `animation-name` on close. */
  outName: (side: string | null) => string;
}

interface PrimitiveCase {
  label: string;
  /** Brings the primitive to its open state. */
  open: (page: Page) => Promise<void>;
  /** Triggers the close. */
  close: (page: Page) => Promise<void>;
  /** Slots that animate. The first is the "primary" element the exit-suspension check anchors on. */
  slots: AnimatedSlot[];
}

const popperSlot = (slotName: string): AnimatedSlot => ({
  locate: (page) => page.locator(`[data-slot='${slotName}']`),
  inName: (side) => `popper-in-${side}`,
  outName: (side) => `popper-out-${side}`,
});

async function openTagPopover(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Select tags' }).click();
  await expect(page.locator("[data-slot='popover-content']")).toBeVisible();
}

async function openCreateTagDialog(page: Page): Promise<void> {
  await openTagPopover(page);
  await page.locator("[data-slot='popover-content']").getByRole('button', { name: 'Create tag' }).click();
  await expect(page.locator("[data-slot='dialog-content']")).toBeVisible();
}

const CASES: PrimitiveCase[] = [
  {
    label: 'Dialog',
    open: openCreateTagDialog,
    close: async (page) => {
      await page.keyboard.press('Escape');
    },
    slots: [
      {
        locate: (page) => page.locator("[data-slot='dialog-content']"),
        inName: () => 'dialog-in',
        outName: () => 'dialog-out',
      },
      {
        locate: (page) => page.locator("[data-slot='dialog-overlay']"),
        inName: () => 'dialog-overlay-in',
        outName: () => 'dialog-overlay-out',
      },
    ],
  },
  {
    label: 'Popover',
    open: openTagPopover,
    close: async (page) => {
      await page.keyboard.press('Escape');
    },
    slots: [popperSlot('popover-content')],
  },
  {
    label: 'HoverCard',
    open: async (page) => {
      await page.getByRole('button', { name: '1 active plan' }).hover();
      await expect(page.locator("[data-slot='hover-card-content']")).toBeVisible();
    },
    close: async (page) => {
      // HoverCard closes after a 300ms closeDelay once the pointer leaves.
      await page.mouse.move(0, 0);
    },
    slots: [popperSlot('hover-card-content')],
  },
  {
    label: 'DropdownMenu',
    open: async (page) => {
      await page.locator("[data-slot='dropdown-menu-trigger']").first().click();
      await expect(page.locator("[data-slot='dropdown-menu-content']")).toBeVisible();
    },
    close: async (page) => {
      await page.keyboard.press('Escape');
    },
    slots: [popperSlot('dropdown-menu-content')],
  },
  {
    label: 'Toast',
    open: async (page) => {
      // Stub the create so the dialog's onError raises an error toast without touching backend state.
      await page.route('**/trainer/client-tags', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 409, title: 'Conflict' }),
          });
          return;
        }
        await route.fallback();
      });
      await openCreateTagDialog(page);
      const dialog = page.locator("[data-slot='dialog-content']");
      await dialog.getByLabel('Name').fill(`QA Overlay Tag ${Date.now()}`);
      await dialog.getByRole('button', { name: 'Create tag', exact: true }).click();
      await expect(page.locator("[data-slot='toast']")).toBeVisible();
    },
    close: async (page) => {
      await page.locator("[data-slot='toast']").locator("[data-slot='toast-close']").click();
    },
    slots: [
      {
        locate: (page) => page.locator("[data-slot='toast']"),
        inName: () => 'toast-in',
        outName: () => 'toast-out',
      },
    ],
  },
];

async function gotoClients(page: Page): Promise<void> {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
}

const animationNameOf = (locator: Locator): Promise<string> =>
  locator.evaluate((el) => getComputedStyle(el).animationName);

test.describe('overlay primitives animate enter and exit (#1090)', () => {
  for (const primitive of CASES) {
    test(`${primitive.label}: distinct enter/exit keyframes, removal suspended on close`, async ({ page }) => {
      await gotoClients(page);
      await primitive.open(page);

      const primary = primitive.slots[0].locate(page);
      const side = await primary.getAttribute('data-side');

      // A. CSS contract on open, and remember each slot's open-state name.
      const enterNames: string[] = [];
      for (const slot of primitive.slots) {
        const element = slot.locate(page);
        await expect(element).toHaveCSS('animation-name', slot.inName(side));
        enterNames.push(await animationNameOf(element));
      }

      await primitive.close(page);

      // B. Exit suspension. Before the fix the element is already gone (Presence
      // saw animationName "none" and unmounted on the same tick), so this
      // assertion cannot observe data-state="closed" at all.
      await expect(primary).toHaveAttribute('data-state', 'closed');
      for (const [index, slot] of primitive.slots.entries()) {
        const element = slot.locate(page);
        await expect(element).toHaveCSS('animation-name', slot.outName(side));
        expect(await animationNameOf(element)).not.toBe(enterNames[index]);
      }

      await expect(primary).toBeHidden();
    });

    test(`${primitive.label}: reduced motion collapses the duration and still unmounts`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await gotoClients(page);
      await primitive.open(page);

      for (const slot of primitive.slots) {
        await expect(slot.locate(page)).toHaveCSS('animation-duration', '0.001s');
      }

      await primitive.close(page);

      await expect(primitive.slots[0].locate(page)).toBeHidden();
    });
  }
});
