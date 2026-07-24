using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;

/// <summary>
/// Creates a new training plan for a client in Draft status.
/// </summary>
/// <remarks>
/// Intentionally does not go through <see cref="FitnessPlatform.Application.Domain.Services.PlanConcurrencyGuard"/> —
/// this is an <c>InsertOneAsync</c> of a brand-new document with <c>Version = 1</c>, so
/// there is no existing row to fetch, no version to compare, and no 409 path to extract.
/// See the guard's class doc-comment for the full Create/Delete exclusion rationale (#659 / #695).
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates trainer-client relationship.</param>
/// <param name="db">PostgreSQL context for cross-DB validation.</param>
public class CreateTrainingPlanEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper, IApplicationDbContext db)
    : Endpoint<CreateTrainingPlanRequest, TrainingPlanSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Create a training plan";
            s.Description = "Creates a new training plan in Draft status for a client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var hasLink = await authHelper.HasActiveLinkAsync(trainerId, req.ClientId, ct);

        if (!hasLink)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // req.ClientId is the trainer-facing ClientProfile.PublicId — resolve to
        // ApplicationUser.Id, the canonical clientId key for Mongo documents (#840).
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientUserId = clientProfile.UserId;

        // Validate questionnaire response link if provided
        if (req.QuestionnaireResponseId.HasValue)
        {
            var responseExists = await db.QuestionnaireResponses
                .AsNoTracking()
                .AnyAsync(r => r.PublicId == req.QuestionnaireResponseId.Value
                               && r.ProfessionalId == trainerId
                               && r.ClientId == req.ClientId
                               && r.Status == QuestionnaireResponseStatus.Submitted, ct);

            if (!responseExists)
            {
                ThrowError("QuestionnaireResponseId", "Questionnaire response not found or not submitted.");
                return;
            }
        }

        // Overlap check: a client may hold several sequential, non-overlapping plans of the
        // same type (#780), but their date windows [StartDate, StartDate + WeekCount * 7) must
        // not overlap. Only applies when a StartDate is supplied — Draft plans left unscheduled
        // are unranged and cannot overlap anything. Archived/Completed plans are excluded: they
        // are no longer "in force" and a new plan may legitimately reuse their old window.
        if (req.StartDate.HasValue)
        {
            var candidateStart = DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc);

            var existingFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                                & Builders<TrainingPlan>.Filter.Ne(p => p.Status, TrainingPlanStatus.Archived)
                                & Builders<TrainingPlan>.Filter.Ne(p => p.Status, TrainingPlanStatus.Completed)
                                & Builders<TrainingPlan>.Filter.Ne(p => p.StartDate, null);

            using var existingCursor = await mongo.TrainingPlans.FindAsync(existingFilter, cancellationToken: ct);
            var existingPlans = await existingCursor.ToListAsync(ct);

            var overlaps = existingPlans.Any(p =>
                PlanWindowResolver.WindowsOverlap(candidateStart, req.WeekCount, p.StartDate!.Value, p.Weeks.Count));

            if (overlaps)
            {
                await this.SendProblemAsync(409, ErrorCodes.PlanOverlap,
                    "The selected date range overlaps an existing plan for this client.", ct);
                return;
            }
        }

        var now = DateTime.UtcNow;

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            TrainerId = trainerId,
            Name = req.Name,
            Description = req.Description?.Trim(),
            Status = TrainingPlanStatus.Draft,
            QuestionnaireResponseId = req.QuestionnaireResponseId,
            Goal = req.Goal,
            TargetWeightKg = req.TargetWeightKg,
            Weeks = Enumerable.Range(1, req.WeekCount).Select(w => new TrainingWeek
            {
                WeekNumber = w,
                Status = WeekStatus.Draft,
                Sessions = []
            }).ToList(),
            Version = 1,
            DateCreated = now,
            StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null
        };

        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        var response = TrainingPlanSummaryDto.FromDocument(plan);
        await HttpContext.Response.SendAsync(response, 201, cancellation: ct);
    }
}
