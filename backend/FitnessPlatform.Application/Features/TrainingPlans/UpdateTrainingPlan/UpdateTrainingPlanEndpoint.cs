using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Full-state update of a training plan: replaces name, description, and all weeks/sessions/exercises/sets.
/// Preserves per-week Status and DatePublished. Uses optimistic concurrency.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdateTrainingPlanEndpoint(IMongoContext mongo)
    : Endpoint<UpdateTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Full-state update of a training plan";
            s.Description = "Replaces the plan's name, description, and all weeks/sessions/exercises/sets. " +
                            "Per-week publish status is preserved. Uses optimistic concurrency via version field.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Fetch current plan
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);

        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Optimistic concurrency check
        if (plan.Version != req.Version)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        // Build lookup of existing week statuses
        var existingWeeks = plan.Weeks.ToDictionary(w => w.WeekNumber);

        // Check that no published weeks are being removed
        var incomingWeekNumbers = req.Weeks.Select(w => w.WeekNumber).ToHashSet();
        var removedPublished = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published && !incomingWeekNumbers.Contains(w.WeekNumber))
            .ToList();

        if (removedPublished.Count > 0)
        {
            ThrowError($"Cannot remove published weeks: {string.Join(", ", removedPublished.Select(w => w.WeekNumber))}");
            return;
        }

        // Start date validation
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (plan.StartDate.HasValue && req.StartDate?.Date != plan.StartDate.Value.Date)
        {
            // Trying to change or clear an existing start date
            if (DateOnly.FromDateTime(plan.StartDate.Value) < today)
            {
                ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be changed after it has arrived.");
                return;
            }

            // Clearing: only allowed if no weeks are published
            if (!req.StartDate.HasValue && plan.Weeks.Any(w => w.Status == WeekStatus.Published))
            {
                ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be cleared when weeks are published.");
                return;
            }
        }

        if (req.StartDate.HasValue)
        {
            if (req.StartDate.Value.DayOfWeek != System.DayOfWeek.Monday)
            {
                ThrowError(ErrorCodes.StartDateNotMonday, "Start date must be a Monday.");
                return;
            }

            // Only enforce "not in past" when the start date is being set or changed.
            // A plan that has already started naturally has a past start date in every
            // subsequent save — that must not block editing of other fields.
            var isStartDateNewOrChanged = !plan.StartDate.HasValue
                || req.StartDate.Value.Date != plan.StartDate.Value.Date;
            if (isStartDateNewOrChanged && DateOnly.FromDateTime(req.StartDate.Value) < today)
            {
                ThrowError(ErrorCodes.StartDateInPast, "Start date cannot be in the past.");
                return;
            }
        }

        // Map request to domain
        plan.Name = req.Name;
        plan.StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null;
        plan.Description = req.Description?.Trim();
        plan.Weeks = req.Weeks.Select(rw =>
        {
            var existing = existingWeeks.GetValueOrDefault(rw.WeekNumber);
            return new TrainingWeek
            {
                WeekNumber = rw.WeekNumber,
                Status = existing?.Status ?? WeekStatus.Draft,
                DatePublished = existing?.DatePublished,
                DayNotes = rw.DayNotes?.Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                    .ToDictionary(kv => kv.Key, kv => kv.Value.Trim()),
                Sessions = rw.Sessions.Select(rs => new TrainingSession
                {
                    SessionId = rs.SessionId ?? Guid.NewGuid(),
                    DayOfWeek = rs.DayOfWeek,
                    Name = rs.Name,
                    Order = rs.Order,
                    Notes = rs.Notes?.Trim(),
                    Format = rs.Format,
                    FormatConfig = rs.FormatConfig,
                    Sections = rs.Sections.Select(rsec => new TrainingSection
                    {
                        SectionId = rsec.SectionId ?? Guid.NewGuid(),
                        Order = rsec.Order,
                        Name = rsec.Name,
                        Format = rsec.Format,
                        FormatConfig = rsec.FormatConfig,
                        Exercises = rsec.Exercises.Select(re => new SessionExercise
                        {
                            ExerciseExternalId = re.ExerciseExternalId,
                            ExerciseName = re.ExerciseName,
                            Order = re.Order,
                            Notes = re.Notes?.Trim(),
                            RestSeconds = re.RestSeconds,
                            MovementType = re.MovementType,
                            Format = re.Format,
                            FormatConfig = re.FormatConfig,
                            Sets = re.Sets.Select(rset => new ExerciseSet
                            {
                                SetNumber = rset.SetNumber,
                                Type = rset.Type,
                                Reps = rset.Reps,
                                WeightKg = rset.WeightKg,
                                DurationSeconds = rset.DurationSeconds,
                                Rpe = rset.Rpe,
                                DistanceMeters = rset.DistanceMeters,
                                RestSeconds = rset.RestSeconds
                            }).ToList()
                        }).ToList()
                    }).ToList()
                }).ToList()
            };
        }).ToList();

        // Derive plan-level status from week statuses
        plan.Status = plan.Weeks.Any(w => w.Status == WeekStatus.Published)
            ? TrainingPlanStatus.Active
            : TrainingPlanStatus.Draft;

        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        // Persist with version check
        var versionFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.TrainingPlans.ReplaceOneAsync(
            versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan), ct);
    }
}
