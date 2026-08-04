using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.InstantiateTemplate;

/// <summary>
/// Instantiates a training plan template into a new Draft client plan — a verbatim copy plus
/// <c>clientId</c>/<c>name</c>/<c>startDate</c>, with every week Draft. Replicates the existing
/// plan-creation coach↔client link check, start-date rules, and overlap check rather than
/// bypassing them (mirrors <c>CreateTrainingPlanEndpoint</c>).
/// </summary>
/// <remarks>
/// Unlike the nutrition-side sibling (<c>NutritionPlanTemplates/InstantiateTemplate</c>), the
/// no-active-link and unresolved-<c>ClientProfile.PublicId</c> 404s are routed through
/// <see cref="LibraryDenialExtensions.SendLibraryNotFoundAsync"/> rather than a bare
/// <c>Send.NotFoundAsync(ct)</c> — #858 introduced the shared helper precisely so every
/// sharing-library 404 (missing document, unreadable document, and this endpoint's coach-link
/// guard) is byte-identical on the wire, carrying <see cref="ErrorCodes.TrainingPlanTemplateNotFound"/>.
/// A structurally different empty-bodied 404 here would make the unlinked-client case
/// distinguishable from the template-not-found case, and would never surface the error code the
/// issue's acceptance criteria names.
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates trainer-client relationship.</param>
/// <param name="db">PostgreSQL context for cross-DB validation.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class InstantiateTemplateEndpoint(
    IMongoContext mongo,
    ProfessionalAuthHelper authHelper,
    IApplicationDbContext db,
    TimeProvider timeProvider)
    : Endpoint<InstantiateTemplateRequest, InstantiateTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plan-templates/{TemplateId}/instantiate");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Instantiate a training plan template";
            s.Description = "Creates a new Draft client plan from a template, every week Draft.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(InstantiateTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Read-guarded, not write-guarded — another trainer's Public template must stay
        // instantiable even though this endpoint writes a new TrainingPlan.
        var template = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.TrainingPlanTemplates, req.TemplateId, trainerId, TrainingPlanTemplateLibrary.Denial, ct);

        if (template is null)
        {
            return;
        }

        var hasLink = await authHelper.HasActiveLinkAsync(trainerId, req.ClientId, ct);

        if (!hasLink)
        {
            // 404 via the shared library helper, never a bare 404 and never 403 — a 403 would
            // confirm the client exists to an unlinked coach. See this type's remarks.
            await this.SendLibraryNotFoundAsync(TrainingPlanTemplateLibrary.Denial, ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await this.SendLibraryNotFoundAsync(TrainingPlanTemplateLibrary.Denial, ct);
            return;
        }

        var clientUserId = clientProfile.UserId;

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
                PlanWindowResolver.WindowsOverlap(candidateStart, template.WeekCount, p.StartDate!.Value, p.Weeks.Count));

            if (overlaps)
            {
                await this.SendProblemAsync(409, ErrorCodes.PlanOverlap,
                    "The selected date range overlaps an existing plan for this client.", ct);
                return;
            }
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            TrainerId = trainerId,
            Name = req.Name,
            Status = TrainingPlanStatus.Draft,
            Goal = template.Goal,
            Weeks = TemplateContentCloner.CloneWeeksAsPlan(template.Weeks),
            Version = 1,
            DateCreated = now,
            StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null
        };

        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        await HttpContext.Response.SendAsync(new InstantiateTemplateResponse
        {
            PlanId = plan.ExternalId,
            ClientId = req.ClientId,
            Name = plan.Name,
            Status = plan.Status.ToString(),
            DateCreated = plan.DateCreated
        }, 201, cancellation: ct);
    }
}
