using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Trainers.GetClientTimeline;

/// <summary>
/// Returns a merged, chronological activity timeline for a single client,
/// composed on-read from existing sources (meal logs, workout logs, body
/// measurements, questionnaire responses, plan publish events, linking).
/// The requesting trainer must have an active link to the client.
/// </summary>
/// <param name="db">Relational data source.</param>
/// <param name="mongo">Document data source.</param>
/// <param name="audit">Audit logging service.</param>
public class GetClientTimelineEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    IAuditService audit)
    : Endpoint<GetClientTimelineRequest, GetClientTimelineResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/timeline");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client activity timeline";
            s.Description = "Returns a merged timeline of recent client activity (meals, workouts, measurements, plan events) for a specific client managed by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientTimelineRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        // Locate the trainer profile
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == trainerUserId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Locate the client profile (req.ClientId is the ClientProfile.PublicId)
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify active trainer-client link
        var link = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(ctl =>
                ctl.ProfessionalProfileId == professionalProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id &&
                ctl.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // A link that carries neither capability flag grants no timeline visibility at
        // all — deny outright (matches ProfessionalAuthHelper.HasAnyPlanAccessAsync
        // semantics from #903).
        if (!link.CanViewNutritionPlans && !link.CanViewTrainingPlans)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        // Every Mongo document's clientId (MealLog, NutritionPlan, TrainingPlan,
        // WorkoutLog, PersonalRecord) is keyed on ApplicationUser.Id (#840).
        // QuestionnaireResponse.ClientId is an EF entity keyed on UserId too.
        var clientUserId = clientProfile.UserId;

        // Look back up to 90 days; we'll take the top `Limit` overall.
        var from = DateTime.UtcNow.Date.AddDays(-90);

        var items = new List<ClientTimelineItem>();

        // ── 1. Meal logs — aggregate per day to avoid dozens of rows ──
        // Nutrition-domain: gated on CanViewNutritionPlans.
        if (link.CanViewNutritionPlans)
        {
            var mealFilter = Builders<MealLog>.Filter.Eq(l => l.ClientId, clientUserId)
                & Builders<MealLog>.Filter.Gte(l => l.EatenAt, from);

            using var cursor = await mongo.MealLogs.FindAsync(mealFilter, cancellationToken: ct);
            var logs = await cursor.ToListAsync(ct);
            // Group by EatenAt date when available; fall back to LogDate for photo-only
            // entries that slipped through the Gte filter (defensive).
            var perDay = logs
                .GroupBy(l => (l.EatenAt ?? l.LogDate).Date)
                .OrderByDescending(g => g.Key);

            foreach (var day in perDay)
            {
                items.Add(new ClientTimelineItem
                {
                    Id = $"meals:{day.Key:yyyy-MM-dd}",
                    Type = "meal_day",
                    OccurredAt = day.Max(l => l.EatenAt ?? l.LogDate),
                    Title = $"Zaznamenáno {day.Count()} jídel",
                    Icon = "🍽",
                });
            }
        }

        // ── 2. Workout logs (completed) ──
        // #841: scoped to executions that carry Performance data (a live-training-assistant
        // log) — checkbox-only completions never appeared in the old WorkoutLogs collection.
        // Training-domain: gated on CanViewTrainingPlans.
        if (link.CanViewTrainingPlans)
        {
            var workoutFilter = Builders<SessionExecution>.Filter.Eq(l => l.ClientId, clientUserId)
                & Builders<SessionExecution>.Filter.Exists(l => l.Performance)
                & Builders<SessionExecution>.Filter.Gte(l => l.Performance!.StartedAt, from)
                & Builders<SessionExecution>.Filter.Eq(l => l.Status, SessionExecutionStatus.Completed);

            using var cursor = await mongo.SessionExecutions.FindAsync(workoutFilter, cancellationToken: ct);
            var logs = await cursor.ToListAsync(ct);
            foreach (var log in logs)
            {
                items.Add(new ClientTimelineItem
                {
                    Id = $"workout:{log.ExternalId}",
                    Type = "workout",
                    OccurredAt = log.Performance!.CompletedAt ?? log.Performance.StartedAt,
                    Title = "Dokončil trénink",
                    Description = log.Exercises.Count > 0
                        ? $"{log.Exercises.Count} cviků"
                        : null,
                    Icon = "🏋",
                });
            }
        }

        // ── 3. Body measurements — dual-readable standalone entries (not attached to a
        //      nutrition or training item), so they stay visible to any caller holding
        //      at least one capability flag. See #916 classification rule. ──
        var measurements = await db.BodyMeasurements
            .AsNoTracking()
            .Where(bm => bm.ClientProfileId == clientProfile.Id && bm.MeasuredAt >= from)
            .OrderByDescending(bm => bm.MeasuredAt)
            .Select(bm => new { bm.PublicId, bm.MeasuredAt, bm.WeightKg })
            .ToListAsync(ct);

        foreach (var m in measurements)
        {
            items.Add(new ClientTimelineItem
            {
                Id = $"measurement:{m.PublicId}",
                Type = "measurement",
                OccurredAt = m.MeasuredAt,
                Title = "Zapsal tělesné míry",
                Description = m.WeightKg.HasValue ? $"Váha: {m.WeightKg.Value} kg" : null,
                Icon = "📏",
            });
        }

        // ── 4. Questionnaire responses (submitted only) — dual-readable standalone
        //      entries, same rationale as body measurements above. ──
        var questionnaires = await db.QuestionnaireResponses
            .AsNoTracking()
            .Include(r => r.Questionnaire)
            .Where(r => r.ClientId == clientUserId
                     && r.SubmittedAt != null
                     && r.SubmittedAt >= from)
            .OrderByDescending(r => r.SubmittedAt)
            .Select(r => new { r.PublicId, r.SubmittedAt, QuestionnaireTitle = r.Questionnaire.Title })
            .ToListAsync(ct);

        foreach (var q in questionnaires)
        {
            items.Add(new ClientTimelineItem
            {
                Id = $"questionnaire:{q.PublicId}",
                Type = "questionnaire",
                OccurredAt = q.SubmittedAt!.Value,
                Title = "Vyplnil dotazník",
                Description = q.QuestionnaireTitle,
                Icon = "📋",
            });
        }

        // ── 5. Nutrition & training plan publish events ──
        // Nutrition-domain: gated on CanViewNutritionPlans.
        if (link.CanViewNutritionPlans)
        {
            var nutritionPlanFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                & Builders<NutritionPlan>.Filter.Gte(p => p.DatePublished, from);

            using var cursor = await mongo.NutritionPlans.FindAsync(nutritionPlanFilter, cancellationToken: ct);
            var plans = await cursor.ToListAsync(ct);
            foreach (var plan in plans.Where(p => p.DatePublished.HasValue))
            {
                items.Add(new ClientTimelineItem
                {
                    Id = $"nutrition_plan:{plan.ExternalId}",
                    Type = "nutrition_plan_published",
                    OccurredAt = plan.DatePublished!.Value,
                    Title = "Zveřejněn jídelníček",
                    Description = string.IsNullOrWhiteSpace(plan.Name) ? null : plan.Name,
                    Icon = "🥗",
                });
            }
        }

        // Training-domain: gated on CanViewTrainingPlans.
        if (link.CanViewTrainingPlans)
        {
            var trainingPlanFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                & Builders<TrainingPlan>.Filter.Gte(p => p.DatePublished, from);

            using var cursor = await mongo.TrainingPlans.FindAsync(trainingPlanFilter, cancellationToken: ct);
            var plans = await cursor.ToListAsync(ct);
            foreach (var plan in plans.Where(p => p.DatePublished.HasValue))
            {
                items.Add(new ClientTimelineItem
                {
                    Id = $"training_plan:{plan.ExternalId}",
                    Type = "training_plan_published",
                    OccurredAt = plan.DatePublished!.Value,
                    Title = "Zveřejněn tréninkový plán",
                    Description = string.IsNullOrWhiteSpace(plan.Name) ? null : plan.Name,
                    Icon = "🏋",
                });
            }
        }

        // ── 6. Personal records ── Training-domain: gated on CanViewTrainingPlans.
        if (link.CanViewTrainingPlans)
        {
            var prFilter = Builders<PersonalRecord>.Filter.Eq(r => r.ClientId, clientUserId)
                & Builders<PersonalRecord>.Filter.Gte(r => r.AchievedAt, from);

            using var cursor = await mongo.PersonalRecords.FindAsync(prFilter, cancellationToken: ct);
            var records = await cursor.ToListAsync(ct);
            foreach (var record in records)
            {
                items.Add(new ClientTimelineItem
                {
                    Id = $"personal_record:{record.ExternalId}",
                    Type = "personal_record",
                    OccurredAt = record.AchievedAt,
                    Title = record.ExerciseName,
                    Description = $"{record.WeightKg} kg \u00d7 {record.Reps}",
                    Icon = "\U0001f3c6",
                    PersonalRecord = new PersonalRecordPayload
                    {
                        ExternalId = record.ExternalId,
                        ExerciseExternalId = record.ExerciseExternalId,
                        ExerciseName = record.ExerciseName,
                        WeightKg = record.WeightKg,
                        Reps = record.Reps,
                        WorkoutLogId = record.WorkoutLogId,
                    },
                });
            }
        }

        // ── 7. Trainer-client link (the "klient propojen" event) — dual-readable. ──
        items.Add(new ClientTimelineItem
        {
            Id = $"linked:{link.PublicId}",
            Type = "linked",
            OccurredAt = link.DateCreated,
            Title = "Klient propojen",
            Icon = "\U0001f517",
        });

        // Audit the trainer read of client activity.
        await audit.LogAsync(
            trainerUserId,
            "Read",
            "ClientTimeline",
            req.ClientId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        var ordered = items
            .OrderByDescending(i => i.OccurredAt)
            .Take(req.Limit)
            .ToList();

        await Send.OkAsync(new GetClientTimelineResponse
        {
            Items = ordered,
            CanViewNutritionPlans = link.CanViewNutritionPlans,
            CanViewTrainingPlans = link.CanViewTrainingPlans
        }, ct);
    }
}
