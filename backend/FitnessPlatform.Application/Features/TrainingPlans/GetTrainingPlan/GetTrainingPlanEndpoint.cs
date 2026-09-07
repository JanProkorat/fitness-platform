using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Retrieves a single training plan with full detail (weeks, sessions, exercises, sets).
/// Also returns per-session WorkoutLog execution data so the web layer can render
/// completed / skipped / not-yet-reached indicators on each set.
/// Also enriches each session with its current edit-lock state (Stable/Editing/Live) and
/// holder (Coach/Client/null) via a single batch <c>GetStateAsync</c> call on the lock service.
/// This gives the trainer plan editor the initial lock state on page load, so the Live
/// in-progress badge and unlock affordance are correct before any SignalR events arrive.
/// </summary>
/// <remarks>
/// The cross-store assembly (Postgres link → Mongo plan → execution docs) that builds the
/// response's <c>Completions</c>, <c>SessionExecutions</c> and finished-state fields lives in
/// <see cref="GetTrainingPlanCompletionBuilders"/> (#938) — this class stays the thin HTTP
/// orchestrator: authorize, fetch, delegate, respond.
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service — used to batch-fetch lock state.</param>
/// <param name="db">PostgreSQL context — resolves the client's PublicId for the response.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities — authorship identifies the
/// plan, the caller's live link to its client decides access.</param>
public class GetTrainingPlanEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService,
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<GetTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get a training plan";
            s.Description = "Returns the full training plan with all weeks, sessions, exercises, sets, " +
                             "and per-session workout-log execution data (completed/skipped set indicators).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Authorship + link gate: treat "not mine" and "no longer linked" as "not found" to
        // avoid an existence leak.
        var plan = await this.LoadOwnedTrainingPlanIfAllowedAsync(mongo, linkAuthorizationService, req.PlanId, trainerId, ct);

        if (plan is null)
        {
            return;
        }

        // plan.ClientId is the internal ApplicationUser.Id storage key (#840); the response's
        // ClientId must stay the client-facing ClientProfile.PublicId (pre-#840 contract) since
        // web/mobile feed it into /trainer/clients/{clientId}/... routes.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        var response = GetTrainingPlanResponse.FromDocument(plan, clientPublicId);

        // ── 1. SessionExecution fold-in (#841 unified the former TrainingCompletion +
        // WorkoutLog fold-ins into a single query) ───────────────────────────────────
        // Scoped to THIS plan's sessions, not to the client. The client-wide filter this
        // replaces was inherited from the old TrainingCompletion query and kept for wire-shape
        // continuity, but a client legitimately holds several plans — sequential non-overlapping
        // ones, and plans from more than one professional — so it folded another coach's
        // set-level results (actual reps, weight, RPE) and their planned values into this
        // response. The completions projection below tolerated that by looking sessions up
        // against this plan, but still emitted the out-of-plan rows; the performance projection
        // applied no session restriction at all. Same idiom as the client-facing full-plan route.
        var planSessionIds = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .Select(s => s.SessionId)
            .ToList();

        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, plan.ClientId)
                              & Builders<SessionExecution>.Filter.In(
                                  c => c.SessionId, planSessionIds.Cast<Guid?>());
        var executionSort = Builders<SessionExecution>.Sort
            .Ascending(c => c.Date)
            .Ascending(c => c.SessionId);
        var executionCursor = await mongo.SessionExecutions.FindAsync(
            executionFilter,
            new FindOptions<SessionExecution> { Sort = executionSort },
            ct);
        var executions = await executionCursor.ToListAsync(ct);

        // Build a session lookup for read-time backfill of legacy completions.
        // Keys are SessionId; sessions are already backfilled by FromDocument().
        var sessionLookup = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .ToDictionary(s => s.SessionId);

        // #857 phase 3b: SessionExecution.CompletedExerciseInstanceIds is a flat list of
        // SessionExercise.ExerciseId instance values. Reconstruct the wire-compatible
        // (ExerciseExternalId-keyed) shape by mapping each completed instance back to its
        // catalog external id and containing workout via the session definition — preserves
        // the pre-#857-phase-3b response contract. See GetTrainingPlanCompletionBuilders'
        // remarks for why this stays on its own over-report rule rather than the #938 canonical
        // placement-exact one — CompletedExerciseInstanceIds here also feeds the web edit-lock
        // derivation, a business gate #938 does not touch.
        response.Completions = GetTrainingPlanCompletionBuilders.BuildCompletions(executions, sessionLookup);

        // ── 2. Performance fold-in — builds SessionExecutionDto entries ──────────
        response.SessionExecutions = GetTrainingPlanCompletionBuilders.BuildSessionExecutions(executions);

        // ── 3. Checkbox-completion-based finished state fold-in ──────────────────
        // The mobile "mark whole day complete" checkbox writes completion flags but may leave
        // Performance null. Without this step, sessions finished via that path would never
        // appear as IsSessionFinished=true on the trainer portal (fix for issue #429).
        var completions = executions.Where(e => e.SessionId.HasValue).ToList();
        GetTrainingPlanCompletionBuilders.FoldInCheckboxFinishedState(response, completions, sessionLookup);

        // ── 3b. Per-workout finished state fold-in ───────────────────────────────
        // For each session that has execution data, project per-workout finished state into
        // FinishedWorkouts. This feeds the web trainer portal so it can render a "Finished"
        // label per workout and gate the edit-lock unlock affordance at workout granularity
        // (issue #465). IsWorkoutComplete() already folds in both signals (finished Performance,
        // checkbox completion flags) since #841 merged them onto one document.
        GetTrainingPlanCompletionBuilders.FoldInWorkoutFinishedState(response, completions, sessionLookup);

        // ── 4. Batch-fetch session lock state ────────────────────────────────────
        // Single Mongo round-trip — not one per session. Mirrors the pattern used
        // in GetFullTrainingPlanEndpoint (client read) so the shape is consistent.
        // Same set the execution filter above was scoped to — walked once.
        if (planSessionIds.Count > 0)
        {
            var lockDocs = await lockService.GetStateAsync(planSessionIds, ct);

            response.SessionLockStates = lockDocs
                .Select(l => new SessionLockStateDto
                {
                    SessionId = l.SessionId,
                    LockState = l.Type.ToString(),
                    LockHolder = l.Holder.ToString()
                })
                .ToList();
        }

        await Send.OkAsync(response, ct);
    }
}
