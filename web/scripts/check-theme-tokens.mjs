#!/usr/bin/env node
// Zero-dependency build-time check: every custom Tailwind theme token in
// index.css's `@theme inline` block that tailwind-merge's default config
// would misclassify (delete outright, for `text`/`shadow`; or silently
// never conflict-resolve, for `spacing`/`tracking`/`animate`) must be
// registered in `src/lib/tw-theme-tokens.ts`. See `src/lib/utils.ts`'s
// `extendTailwindMerge` call for why (#1078). This is a substring/regex
// check over the two files' text, not a TypeScript parse -- deliberately,
// so this script needs no dependency beyond Node's own `fs`.
//
// Run as the first step of `npm run build` (see package.json) so a token
// added to index.css without a matching registry entry fails CI instead of
// silently reproducing the #1078 bug for whichever component uses it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(scriptDir, '..', 'src', 'index.css');
const registryPath = path.join(scriptDir, '..', 'src', 'lib', 'tw-theme-tokens.ts');

const css = readFileSync(cssPath, 'utf8');
const registry = readFileSync(registryPath, 'utf8');

/**
 * Extracts the body of a `@theme inline { ... }` block by brace-counting
 * from the first `{` after the marker, so a nested `{` (there are none
 * today, but keyframes/media blocks elsewhere in the file could confuse a
 * naive regex) can't truncate the match early.
 */
function extractThemeBlock(source) {
  // Require the literal opening brace right after the marker (not just
  // "the next '{' anywhere in the file") -- the file's own header comment
  // describes the `@theme inline` layer in prose above the real block, and
  // a marker match on that prose would otherwise grab the wrong CSS rule's
  // braces entirely.
  const markerIndex = source.indexOf('@theme inline {');
  if (markerIndex === -1) {
    throw new Error('could not find an "@theme inline {" block in index.css');
  }

  const braceStart = source.indexOf('{', markerIndex);
  if (braceStart === -1) {
    throw new Error('found "@theme inline {" but no opening brace in index.css');
  }

  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
  }

  throw new Error('found "@theme inline {" but no matching closing brace in index.css');
}

/**
 * Extracts the quoted string literals of `export const <exportName> = [...]
 * as const;` by brace-counting the `[...]` span, so a literal containing a
 * `]` (none today) can't truncate the match early.
 */
function extractRegistryArray(source, exportName) {
  const marker = `export const ${exportName} = [`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const arrayStart = markerIndex + marker.length - 1;
  let depth = 0;
  for (let i = arrayStart; i < source.length; i += 1) {
    if (source[i] === '[') {
      depth += 1;
    } else if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        const body = source.slice(arrayStart + 1, i);
        const values = [];
        const literalRegex = /'([^']+)'/g;
        let match = literalRegex.exec(body);
        while (match !== null) {
          values.push(match[1]);
          match = literalRegex.exec(body);
        }
        return values;
      }
    }
  }

  return null;
}

// Each namespace's `isDefaultMatch` approximates tailwind-merge's own
// default theme scale for that group (bundle-mjs.mjs's default config), so
// this check only demands registration for a suffix that default would
// actually misclassify -- a token like `--radius-sm` (already a t-shirt
// size) is correctly never flagged.
const NAMESPACES = [
  {
    cssPrefix: '--text-',
    exportName: 'TEXT_SIZE_TOKENS',
    isDefaultMatch: (suffix) => /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/.test(suffix),
  },
  {
    cssPrefix: '--shadow-',
    exportName: 'SHADOW_TOKENS',
    isDefaultMatch: (suffix) => /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/.test(suffix),
  },
  {
    cssPrefix: '--spacing-',
    exportName: 'SPACING_TOKENS',
    isDefaultMatch: (suffix) => suffix === 'px' || (suffix !== '' && !Number.isNaN(Number(suffix))),
  },
  {
    cssPrefix: '--tracking-',
    exportName: 'TRACKING_TOKENS',
    isDefaultMatch: (suffix) => ['tighter', 'tight', 'normal', 'wide', 'wider', 'widest'].includes(suffix),
  },
  {
    cssPrefix: '--animate-',
    exportName: 'ANIMATE_TOKENS',
    isDefaultMatch: (suffix) => ['spin', 'ping', 'pulse', 'bounce'].includes(suffix),
  },
];

const themeBlock = extractThemeBlock(css);
const errors = [];

for (const { cssPrefix, exportName, isDefaultMatch } of NAMESPACES) {
  const registryValues = extractRegistryArray(registry, exportName);
  if (registryValues === null) {
    errors.push(`tw-theme-tokens.ts has no "export const ${exportName} = [...]" array.`);
    continue;
  }

  // Forward check: every non-default-matching CSS key is registered.
  //
  // `[a-z0-9-]+` also matches a Tailwind v4 *modifier* key like
  // `--text-body--line-height:` -- the '-' inside the class doesn't
  // distinguish a single hyphen in a multi-word suffix ("section-title")
  // from the double-hyphen that introduces a modifier ("body--line-height").
  // A suffix containing '--' is always a modifier line for an already-
  // declared base token, not a new token needing its own registry entry --
  // skip it here so it's never checked against isDefaultMatch/registryValues.
  const keyRegex = new RegExp(`^\\s*${cssPrefix}([a-z0-9-]+)\\s*:`, 'gm');
  let match = keyRegex.exec(themeBlock);
  const cssSuffixes = [];
  while (match !== null) {
    if (!match[1].includes('--')) {
      cssSuffixes.push(match[1]);
    }
    match = keyRegex.exec(themeBlock);
  }

  for (const suffix of cssSuffixes) {
    if (isDefaultMatch(suffix)) {
      continue;
    }

    if (!registryValues.includes(suffix)) {
      errors.push(
        `index.css declares "${cssPrefix}${suffix}" but '${suffix}' is missing from ` +
          `${exportName} in tw-theme-tokens.ts -- tailwind-merge will misclassify this ` +
          'token in cn() (see #1078).'
      );
    }
  }

  // Reverse check: every registered value still exists in index.css, so the
  // registry can't accumulate stale entries after a token is removed.
  for (const value of registryValues) {
    if (!cssSuffixes.includes(value)) {
      errors.push(
        `${exportName} in tw-theme-tokens.ts registers '${value}' but index.css has no ` +
          `"${cssPrefix}${value}" key -- remove the stale entry.`
      );
    }
  }
}

if (errors.length > 0) {
  console.error('check-theme-tokens: theme token registry is out of sync with index.css:\n');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error('\nUpdate web/src/lib/tw-theme-tokens.ts to match.');
  process.exit(1);
}

console.log('check-theme-tokens: theme token registry matches index.css.');
