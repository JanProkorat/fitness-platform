# Plan Start Date

Add a start date field to nutrition and training plans that anchors week numbers to calendar dates, gates publishing, and drives the mobile "show today's week" behavior.

## Data Model

Add `StartDate` (`DateTime?`, stored as midnight UTC, always a Monday) to both `NutritionPlan` and `TrainingPlan` MongoDB documents.

- Plan-level field, not per-week
- Weeks are contiguous: Week N starts on `StartDate + (N-1) * 7 days`
- Included in create requests (optional), update requests, and all responses (detail + summary)
- **Date-only semantics:** transmitted as ISO date string (`"2026-03-30"`) on the wire, stored as `DateTime` at midnight UTC in MongoDB. All "today" comparisons use `DateOnly.FromDateTime(DateTime.UtcNow)` on the backend. Monday check is performed on the date-only value.
- **Existing plans:** will have `StartDate: null`. No backfill needed. Already-published plans are unaffected — the start-date-required check on publish only applies to weeks published after this feature ships.

### Validation Rules

| Context | Rule |
|---------|------|
| Always | Must be a Monday |
| Create | If provided, must not be in the past (`startDate >= today`) |
| Update | If existing start date has arrived (`startDate < today`, strict less-than), reject changes |
| Update | Start date can be cleared (set to null) if it has not arrived and no weeks are published |
| Update | New value must be a Monday and not in the past |
| Publish | Start date must be set (400 if null) |
| Publish | The specific week's Monday (`startDate + (weekNumber-1)*7`) must not be in the past |

### Error Codes

New constants in `ErrorCodes.cs`:

- `START_DATE_NOT_MONDAY` — value is not a Monday
- `START_DATE_IN_PAST` — value is in the past
- `START_DATE_LOCKED` — attempted to change a start date that has arrived
- `START_DATE_REQUIRED` — publish attempted without a start date
- `WEEK_START_IN_PAST` — the target week's Monday is in the past (publish gate)

## Backend Changes

No new endpoints. Modifications to existing ones:

### CreatePlan / CreateTrainingPlan

- Add optional `StartDate` to `CreatePlanRequest` and `CreateTrainingPlanRequest`
- Validate: Monday, not in the past (if provided)

### UpdatePlan / UpdateTrainingPlan

- Add `StartDate` to `UpdatePlanRequest` and `UpdateTrainingPlanRequest`
- Validate: if plan already has a start date that has arrived (`startDate < today`), reject changes to it
- Validate: new value must be a Monday and not in the past
- Allow clearing to null if start date hasn't arrived and no weeks are published

### PublishWeek / PublishTrainingWeek

- Before publishing, validate:
  - `StartDate` is set (return 400 with `START_DATE_REQUIRED`)
  - The target week's start Monday is not in the past (return 400 with `WEEK_START_IN_PAST`)

### Response DTOs

- Add `StartDate` (as ISO date string) to `PlanSummaryDto`, `GetPlanResponse`, `TrainingPlanSummaryDto`, `GetTrainingPlanResponse`

## Web Frontend Changes

### Create Drawers (PlansPage / TrainingPlansPage)

- Add optional date picker for "Start date"
- Monday-only constraint (all other days disabled in the picker)

### Plan Detail Pages (NutritionPlanPage / TrainingPlanPage)

- Add inline date picker in the header area, near the plan name
- Monday-only constraint
- Disabled/locked when the start date has arrived (`startDate < today`)
- Value included in the save payload
- On publish attempt without start date: show error toast using mapped i18n key for `START_DATE_REQUIRED`

### WeekSelector Component

- When start date is set, show derived date range below week label
- Format: "Week 1 . Mar 31 - Apr 6" (dates formatted per user locale)
- When start date is null, preserve current behavior (just "Week 1")

## Mobile Changes (Training Plans Only)

Nutrition plans are not yet built on mobile.

### Default Week Selection

When a client opens a training plan with a start date:

1. Calculate current week: `floor((today - startDate).days / 7) + 1`
2. Clamp to valid range: `max(1, min(currentWeek, totalWeeks))`
3. Auto-select that week

"Today" uses the device's local date. `startDate` is treated as a date-only value (ignore time component).

If no start date or plan hasn't started yet, default to Week 1.

**Worked example:** startDate = March 30 (Monday). On April 5 (Saturday, day 6): `floor(6/7)+1 = 1` (Week 1). On April 6 (Sunday, day 7): `floor(7/7)+1 = 2` — but Sunday is still Week 1 (Mon-Sun). Fix: use `floor((today - startDate).days / 7) + 1` where the week boundary aligns with Monday. Since April 6 is 7 days from March 30, this gives Week 2. However, the plan uses Mon-Sun weeks, so the correct formula is: `floor(daysSinceStart / 7) + 1` where Sunday (day 7) maps to Week 2 start. This is acceptable since by Sunday the next week is about to begin, and the client sees the upcoming week. Alternatively, to strictly keep Sunday in the current week: `floor((daysSinceStart) / 7) + 1` with `daysSinceStart = max(0, (today - startDate).days - (today.dayOfWeek == Sunday ? 1 : 0))`. The simpler formula (without Sunday adjustment) is recommended — showing the next week on Sunday is reasonable UX.

### Week Display Format

Change from "Week 1" to "Week 1/4" format (currentWeek/totalWeeks) so the client sees progress through the plan.
