# Cross-Week Drag & Drop for Training Plans

**Date:** 2026-03-23
**Status:** Approved

## Overview

Migrate training plan drag-and-drop from native HTML5 DnD to `@dnd-kit/react` (already installed) and implement cross-week dragging of exercises, sessions, and days via a hover-to-switch mechanism on week tabs.

The core UX: user drags an item over a week tab, tab highlights with a progress indicator, after 500ms the displayed week switches to the target week, and the user drops the item onto a specific location in that week. Pointer-event-based DnD (dnd-kit) survives the DOM re-render when weeks switch, which native HTML5 DnD cannot do.

## Drag Data Model

A single `DragDropProvider` wraps the entire training plan content (week selector + day columns). Every draggable carries typed data:

```ts
type DragData =
  | { type: 'exercise'; weekNumber: number; sessionId: string; exerciseIndex: number; exercise: SessionExercise }
  | { type: 'session'; weekNumber: number; sessionId: string; dayOfWeek: number }
  | { type: 'day'; weekNumber: number; dayOfWeek: number }
```

`weekNumber` is captured at drag start and stays fixed — this identifies the source week even after the displayed week switches.

## Drop Targets

| Target | Accepts | Behavior |
|--------|---------|----------|
| Exercise slot (within session) | `exercise` | Reorder within session or move across sessions |
| Session container | `exercise` (cross-session move), `session` (reorder) | Insert exercise at position, or reorder session |
| Day column | `session` (move to day), `day` (copy day) | Append session to day, or copy day content |
| Week tab | All types | Navigation trigger only (500ms hover-switch), NOT a drop target |

## Week Tab Hover-Switch Mechanism

1. **Drag enters week tab** — 500ms timer starts. Tab gets gold highlight + CSS progress bar animation (`animation: progress 500ms linear`).
2. **Drag leaves before 500ms** — timer clears, highlight removed.
3. **After 500ms** — `setSelectedWeek(targetWeek)` fires. DOM re-renders with target week content. Drag continues seamlessly (pointer events).
4. **Hover back to original week** — same mechanism, switches back. User can freely navigate between weeks mid-drag.
5. **Drop directly on tab** — no-op. Tabs are navigation triggers, not drop targets.

Timer stored in a ref, cleared on drag leave and drag end.

## Drop Behavior by Drag Type

### Exercise

| Scenario | Action | Store Method |
|----------|--------|--------------|
| Same session | Reorder | `reorderExercises(week, sessionId, fromIdx, toIdx)` |
| Different session, same week | Move | `moveExerciseToSession(week, fromSession, toSession, fromIdx, toIdx)` |
| Different week (after tab switch) | Move | `moveExerciseToWeek(fromWeek, toWeek, fromSession, toSession, fromIdx, toIdx)` — **new** |

Visual: gold drop indicator bar between exercises, session highlight on hover.

### Session

| Scenario | Action | Store Method |
|----------|--------|--------------|
| Same day | Reorder vertically | Reorder sessions by order |
| Different day, same week | Move | `moveSessionToDay(week, sessionId, targetDay)` |
| Different week (after tab switch) | Move, append to day | `moveSessionToWeek(fromWeek, toWeek, sessionId, targetDay)` |

Visual: day column gets gold border highlight. No confirmation dialog — always appends.

### Day

| Scenario | Action | Store Method |
|----------|--------|--------------|
| Same week | Reorder | `reorderDay(week, fromDay, toPosition)` |
| Different week (after tab switch), target empty | Copy immediately | `copyDayToWeek(fromWeek, fromDay, toWeek, toDay)` |
| Different week (after tab switch), target has sessions | Dialog: Replace or Append | `copyDayToWeek` after user confirms |

Visual: day column header gets gold highlight. Days are **copied** (source retains sessions), not moved.

## Store Changes

One new action:

```ts
moveExerciseToWeek: (
  fromWeek: number,
  toWeek: number,
  fromSessionId: string,
  toSessionId: string,
  fromIndex: number,
  toIndex: number
) => void
```

Removes exercise from source session in source week, inserts into target session in target week at `toIndex`. Both sessions' exercise orders renumbered.

All other store actions already exist: `moveSessionToWeek`, `moveSessionToDay`, `copyDayToWeek`, `reorderExercises`, `moveExerciseToSession`, `reorderDay`.

No API changes — mutations are local state, persisted via existing `save()` action.

## Component Decomposition

Extract drag-related components from the monolithic `TrainingPlanPage.tsx` (880 lines):

```
web/src/components/training/
├── AddExercisesDrawer.tsx        # existing, unchanged
├── TrainingDragProvider.tsx       # DragDropProvider wrapper + onDragOver/onDragEnd routing
├── DraggableExercise.tsx          # useSortable for exercises within sessions
├── DroppableSession.tsx           # useDroppable for session containers
├── DraggableSession.tsx           # useDraggable on session header
├── DroppableDay.tsx               # useDroppable for day columns
├── DraggableDayHeader.tsx         # useDraggable on day header
└── WeekTab.tsx                    # useDroppable + 500ms hover timer logic
```

`TrainingDragProvider` holds the core routing:
- Inspects `active.data.type` in `onDragOver`/`onDragEnd`
- Dispatches to correct store actions
- Manages drag state (visual indicators, hover timers)

`TrainingPlanPage` stays focused on layout, toolbars, dialogs, and non-DnD concerns.

## WeekSelector Adaptation

The shared `WeekSelector` component (used by both nutrition and training) gains an optional `renderTab` prop:

```tsx
renderTab?: (props: {
  weekNumber: number;
  status: 'Draft' | 'Published';
  isSelected: boolean;
}) => ReactNode
```

- **Training** passes `WeekTab` component (with droppable behavior + hover-switch logic)
- **Nutrition** omits the prop, gets the existing default button markup
- No changes to nutrition code

## Visual Feedback Summary

| State | Visual |
|-------|--------|
| Dragging exercise | Source exercise reduced opacity, cursor grabbing |
| Exercise over session | Session border gold highlight |
| Exercise drop position | Gold horizontal bar between exercises (existing `slideIn` animation) |
| Dragging session | Source session reduced opacity |
| Session over day column | Day column gold border |
| Dragging day header | Source day header reduced opacity |
| Day over day column | Day column header gold highlight |
| Any drag over week tab | Tab gold highlight + 500ms progress bar animation |
| Week tab switch | Smooth transition, drag continues |

## Migration Scope

All native HTML5 DnD in `TrainingPlanPage` is replaced:
- Remove `draggable` attributes, `onDragStart/Over/Drop/End` handlers
- Remove `draggedDay`, `dragOverDay`, `dragOverGap`, `draggedSessionRef`, `draggedExerciseRef`, `dropTargetRef` state
- Remove cross-week dialog for sessions (`crossWeekSessionDialog`)
- Keep day-copy dialog (for non-empty target days only)
- Replace with dnd-kit hooks (`useSortable`, `useDraggable`, `useDroppable`) in extracted components
