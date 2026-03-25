# Plan Start Date

Add a start date field to nutrition and training plans that anchors week numbers to calendar dates, gates publishing, and drives the mobile "show today's week" behavior.

## Data Model

Add `StartDate` (`DateTime?`, UTC, always a Monday) to both `NutritionPlan` and `TrainingPlan` MongoDB documents.

- Plan-level field, not per-week
- Weeks are contiguous: Week N starts on `StartDate + (N-1) * 7 days`
- Included in create requests (optional), update requests, and all responses (detail + summary)

### Validation Rules

| Context | Rule |
|---------|------|
| Always | Must be a Monday |
| Create | If provided, must be today or future |
| Update | If existing start date's Monday has arrived (`startDate <= today`), reject changes |
| Update | New value must be a Monday and not in the past |
| Publish | Start date must be set (400 if null) |
| Publish | The specific week's Monday (`startDate + (weekNumber-1)*7`) must not be in the past |

## Backend Changes

No new endpoints. Modifications to existing ones:

### CreatePlan / CreateTrainingPlan

- Add optional `StartDate` to `CreatePlanRequest` and `CreateTrainingPlanRequest`
- Validate: Monday, not in the past (if provided)

### UpdatePlan / UpdateTrainingPlan

- Add `StartDate` to `UpdatePlanRequest` and `UpdateTrainingPlanRequest`
- Validate: if plan already has a start date that has arrived, reject changes to it
- Validate: new value must be a Monday and not in the past

### PublishWeek / PublishTrainingWeek

- Before publishing, validate:
  - `StartDate` is set (return 400 with error code if null)
  - The target week's start Monday is not in the past

### Response DTOs

- Add `StartDate` to `PlanSummaryDto`, `GetPlanResponse`, `TrainingPlanSummaryDto`, `GetTrainingPlanResponse`

## Web Frontend Changes

### Create Drawers (PlansPage / TrainingPlansPage)

- Add optional date picker for "Start date"
- Monday-only constraint (all other days disabled in the picker)

### Plan Detail Pages (NutritionPlanPage / TrainingPlanPage)

- Add inline date picker in the header area, near the plan name
- Monday-only constraint
- Disabled/locked when the start date's Monday has arrived
- Value included in the save payload
- On publish attempt without start date: show error toast

### WeekSelector Component

- When start date is set, show derived date range below week label
- Format: "Week 1 . Mar 31 - Apr 6"

## Mobile Changes (Training Plans Only)

Nutrition plans are not yet built on mobile.

### Default Week Selection

When a client opens a training plan with a start date:

1. Calculate current week: `floor((today - startDate) / 7) + 1`
2. Clamp to valid range: `max(1, min(currentWeek, totalWeeks))`
3. Auto-select that week

If no start date or plan hasn't started yet, default to Week 1.

### Week Display Format

Change from "Week 1" to "Week 1/4" format (currentWeek/totalWeeks) so the client sees progress through the plan.
