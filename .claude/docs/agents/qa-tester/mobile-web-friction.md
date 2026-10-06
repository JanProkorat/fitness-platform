# qa-tester — Mobile web boot, known friction

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

Two failure shapes broke Expo web in the old app (before #1160) and
will come back as the fresh app grows:

- **Storage read at module load.** A store that reads persistent
  storage when its module loads crashes Metro's server pre-render on
  Expo web (`Tried to access storage on the server`). Route back to
  `mobile-expo` with "guard the module-load read with
  `typeof window === 'undefined'`" — do not patch it yourself.
- **Native-only module imported directly.** A component importing a
  native-only library (the old app's case was `react-native-pager-view`)
  crashes Expo web unless it goes through a `.web.tsx` platform split.
  Flag a new direct import as a regression.

A single import in a new screen can break Expo web and block
interactive QA, so a quick `npx expo start --web` smoke run is worth it
even for static-only mobile changes.
