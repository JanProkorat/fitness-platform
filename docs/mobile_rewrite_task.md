# GoodFellas Mobile App Rewrite — Claude Code Task

## Design System

The app implements **iOS 26 design language** combined with a **Notion-inspired
visual philosophy** — clean backgrounds, subtle borders, golden brand accent
`#c9a84c`.

### Color Palette

```typescript
export const Colors = {
  // Backgrounds
  bg:     '#f2f2f7',  // iOS system background
  bg2:    '#ffffff',  // iOS secondary background (cards, lists)
  bg3:    '#f2f2f7',  // Tertiary

  // Separators
  sep:    'rgba(60,60,67,0.18)',
  sep2:   'rgba(60,60,67,0.09)',

  // Labels
  label:  '#000000',
  label2: 'rgba(60,60,67,0.6)',
  label3: 'rgba(60,60,67,0.3)',

  // Fills (interactive elements)
  fill:   'rgba(120,120,128,0.12)',
  fill2:  'rgba(120,120,128,0.08)',

  // System
  blue:   '#007aff',
  green:  '#34c759',
  red:    '#ff3b30',
  orange: '#ff9500',
  purple: '#af52de',

  // Brand
  gold:   '#c9a84c',
  goldBg: 'rgba(201,168,76,0.10)',

  // Dark mode — switch via useColorScheme()
  dark: {
    bg:     '#1c1c1e',
    bg2:    '#2c2c2e',
    label:  '#ffffff',
    label2: 'rgba(235,235,245,0.6)',
    label3: 'rgba(235,235,245,0.3)',
    fill:   'rgba(120,120,128,0.24)',
    sep:    'rgba(84,84,88,0.65)',
    sep2:   'rgba(84,84,88,0.40)',
  },
} as const
```

### Typography

System font only — SF Pro on iOS, Roboto on Android. No external fonts.

```typescript
export const Type = {
  largeTitle:  { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  title1:      { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  title2:      { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  title3:      { fontSize: 20, fontWeight: '600' },
  headline:    { fontSize: 17, fontWeight: '600' },
  body:        { fontSize: 17, fontWeight: '400' },
  callout:     { fontSize: 16, fontWeight: '400' },
  subheadline: { fontSize: 15, fontWeight: '400' },
  footnote:    { fontSize: 13, fontWeight: '400' },
  caption1:    { fontSize: 12, fontWeight: '400' },
  caption2:    { fontSize: 11, fontWeight: '400' },
} as const
```

### Border Radius

```typescript
export const Radius = {
  sm:   10,  // small elements, badges
  md:   13,  // cards, lists (iOS grouped style)
  lg:   20,  // large cards with hero section
  xl:   28,  // buttons, large elements
  full: 999, // pill shapes
} as const
```

---

## Navigation & File Structure

Use **Expo Router** with file-based routing. Bottom tab navigation has 4 items.

```
app/
  _layout.tsx                  — root layout, AuthGuard, ThemeProvider
  (auth)/
    login.tsx                  — login screen
    register.tsx               — registration screen
    forgot-password.tsx        — forgot password screen
  (client)/
    _layout.tsx                — TabNavigator for client
    index.tsx                  — "Today" (main screen)
    discover.tsx               — Find trainer/coach
    plans.tsx                  — Plans overview
    plans/[planId].tsx         — Plan detail (training or nutrition)
    profile.tsx                — Profile and progress
    questionnaire.tsx          — Onboarding questionnaire flow
```

### Tab Bar

```typescript
// Icons: SF Symbols via @expo/vector-icons or react-native-sf-symbols
const tabs = [
  { name: 'index',    label: 'Today',    icon: 'house.fill' },
  { name: 'discover', label: 'Trainers', icon: 'magnifyingglass' },
  { name: 'plans',    label: 'Plans',    icon: 'calendar' },
  { name: 'profile',  label: 'Profile',  icon: 'person.fill' },
]
```

Tab bar uses a `BlurView` from `expo-blur` for the frosted glass background,
height 84px, safe area padding at the bottom. Active icon and label use
`Colors.gold`.

---

## Screens — Client

### 1. Today (`index.tsx`)

Rendering depends on the `hasTrainer` flag from the user profile.

#### A) Client has a trainer or coach

**Header** — large title "Good morning, [Name]" (largeTitle style), current date
below (caption1, label2 color).

**Stat strip** — 3 equal-width cards in a row (`flex: 1` each):
- Calories today (number + progress bar, gold color)
- Today's training (session name + status badge)
- Streak (number with 🔥, orange color)

**Today's training** — section with heading, card containing:
- Hero section (dark gradient, plan name, session name, muscle group pill badges,
  sets progress ring)
- Exercise rows — colored muscle-group dot, name, sets description, completion
  checkbox
- CTA button "Continue training" (gold, full width)

**Today's nutrition** — section with heading, card containing:
- Macro progress bars (protein blue, carbs orange, fat purple)
- Grouped meal list — icon + name + kcal + status (done / pending)
- Tap on meal → detail (bottom sheet or new screen)

#### B) Client has no trainer

- Info banner with gold left border
- CTA button "Find a trainer" → navigate to Discover tab
- Feature preview list (training plan, nutrition, progress tracking)

---

### 2. Find Trainer (`discover.tsx`)

**Only shown when the client has NO active trainer or coach.** If they do, this
tab shows the current collaboration status with an option to end it.

**Search bar** — iOS style (fill background, search icon, placeholder
"Search name, specialisation...")

**Segmented control** — All / Trainers / Coaches

**Pill filters** — horizontal scroll: All goals / Weight loss / Muscle gain /
Fitness / Rehabilitation

**Trainer/coach card:**

```
┌─────────────────────────────────────┐
│  [Avatar]  Trainer name             │
│            Role · City              │
│            ★★★★★ 4.9 (38)           │
│                        2,500 CZK/mo │
├─────────────────────────────────────┤
│  [tag] [tag] [tag]                  │
├─────────────────────────────────────┤
│  🟢 Accepting clients  [Profile] [Contact] │
└─────────────────────────────────────┘
```

Avatar is colored initials (2 letters, rounded square 56×56, border-radius 18).
"Contact" button is gold, "Profile" is secondary fill.
If at full capacity — "Contact" button is replaced with "Waitlist", greyed out.

**API:**
```
GET  /api/trainers?role=all&goal=&page=1&limit=20
POST /api/collaboration/request  { trainerId: string }
```

---

### 3. Plans (`plans.tsx` + `plans/[planId].tsx`)

**Segmented control** — Active / Archive

**Training plan card:**
- Hero section (dark blue gradient, "● Active" badge, plan name, trainer name,
  week progress bar)
- Stats row: completed / remaining / adherence %
- Week strip: 7 days with checkmarks (done = green, today = gold, future = grey)

**Nutrition plan card:**
- Hero section (dark teal gradient), same structure
- Stats: days completed / compliance % / weight progress

Tapping a card navigates to `plans/[planId].tsx`:
- Training plan: weekly overview (Mon–Sun with session chips), session detail
  with exercise list
- Nutrition plan: daily meal overview, macros

**API:**
```
GET /api/client/plans?status=active
GET /api/client/plans/:id
```

---

### 4. Profile & Progress (`profile.tsx`)

**Header** — large avatar (initials, 80×80, border-radius 26), name, role, streak
badge, compliance badge.

**Stats grid** — 2×2:
- Current weight (+ delta from start, green)
- Target weight (X kg remaining)
- Total training sessions
- Days with trainer

**Weight progress** — card with:
- Large current weight number + delta
- Bar chart of last 8 measurements (columns, last one gold, others fill)

**Profile section** — grouped list:
- Height / weight (editable)
- Goal
- Activity level
- Allergies / limitations

**Trainer section** — name, role, collaboration start date, option to end
collaboration (red row, confirm alert before action).

**API:**
```
GET /api/client/profile
PUT /api/client/profile
GET /api/client/progress/weight?limit=8
GET /api/client/stats
```

---

### 5. Onboarding Questionnaire (`questionnaire.tsx`)

Triggered automatically after accepting an invitation — either via push
notification deep link or when `questionnaireStatus === 'pending'` in the user
profile.

**Flow:**
1. Intro screen — questionnaire title, trainer's description, question count,
   CTA "Start"
2. Step-by-step — one question per full screen, progress bar at top
   ("Question X of N")
3. Input types:
   - `short_text` → TextInput
   - `single_choice` → RadioGroup (pill cards)
   - `multi_select` → CheckboxGroup (pill cards with checkmark)
   - `number` → numeric TextInput + ± stepper buttons
   - `scale` → row of 10 buttons 1–10, tap to highlight
   - `file_upload` → ImagePicker + thumbnail preview
4. Navigation: Back button (previous question only), Next / Submit
5. Auto-save answers to MMKV after each step (offline-first)
6. Success screen with Lottie animation after submit

**API:**
```
GET  /api/client/questionnaire
POST /api/client/questionnaire/response/start
PUT  /api/client/questionnaire/response/:id
POST /api/client/questionnaire/response/:id/submit
```

---

## Components to Build

Create these shared components under `components/`:

```
components/
  ui/
    Avatar.tsx           — initials avatar, multiple sizes and colors
    Badge.tsx            — status badge (active / warning / inactive)
    Card.tsx             — base card with hero and body slots
    MacroBar.tsx         — macro progress bar (label + track + value)
    StatCard.tsx         — square card with icon, number, label
    StatStrip.tsx        — 3 stat cards in a row
    WeekStrip.tsx        — 7-day strip with checkmarks and dots
    ProgressRing.tsx     — SVG circular progress (for training)
    GoldButton.tsx       — primary CTA button (gold background)
    SecondaryButton.tsx  — secondary button (fill background)
    SectionHeader.tsx    — section title + optional right-side action
    Separator.tsx        — 0.5px separator (iOS style)
  training/
    ExerciseRow.tsx      — exercise row with dot, name, checkbox
    TrainingCard.tsx     — training card (hero gradient + exercise list)
    SessionChip.tsx      — session pill badge (Push A, Pull A...)
  nutrition/
    MealRow.tsx          — meal row in list (icon + name + kcal)
    NutritionCard.tsx    — nutrition card with macro bars
  trainers/
    TrainerCard.tsx      — trainer/coach card in the marketplace
  questionnaire/
    QuestionScreen.tsx   — wrapper for a single question
    RadioGroup.tsx       — single choice input
    ScaleInput.tsx       — 1–10 scale input
```

---

## Implementation Order

Implement in this order — each phase must be working before moving to the next:

1. **Design system** — `Colors`, `Type`, `Radius`, `useTheme()` hook, base
   components (`Avatar`, `Card`, `GoldButton`, `Separator`, `SectionHeader`)
2. **Navigation + AuthGuard** — tab bar with BlurView, routing skeleton,
   auth flow, SecureStore
3. **Today screen** — both states (with trainer / without), stat strip, training
   card, nutrition card
4. **Profile screen** — stats grid, weight chart, profile list, trainer section
5. **Plans screen** — plan cards, week strip, plan detail
6. **Discover screen** — search, filters, trainer cards, collaboration request API
7. **Questionnaire** — all question types, MMKV persistence, submit flow

---

## Out of Scope (separate task)

- Trainer/coach section of the app
- In-app chat / messaging
- Push notifications
- In-app payments / subscription management
- Admin panel
