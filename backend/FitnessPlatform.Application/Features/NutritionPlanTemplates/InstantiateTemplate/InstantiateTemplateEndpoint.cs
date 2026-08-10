using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.InstantiateTemplate;

/// <summary>
/// Instantiates a nutrition plan template into a new Draft client plan — a verbatim copy plus
/// <c>clientId</c>/<c>name</c>/<c>startDate</c>, with every week Draft. Replicates the existing
/// plan-creation coach↔client link check, start-date rules, and overlap check rather than
/// bypassing them (mirrors <c>CreatePlanEndpoint</c>).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates nutritionist-client relationship.</param>
/// <param name="db">PostgreSQL context for cross-DB validation.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class InstantiateTemplateEndpoint(
    IMongoContext mongo,
    NutritionAuthHelper authHelper,
    IApplicationDbContext db,
    TimeProvider timeProvider)
    : Endpoint<InstantiateNutritionPlanTemplateRequest, InstantiateNutritionPlanTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plan-templates/{TemplateId}/instantiate");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Instantiate a nutrition plan template";
            s.Description = "Creates a new Draft client plan from a template, every week Draft.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(InstantiateNutritionPlanTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Read-guarded, not write-guarded — another nutritionist's Public template must stay
        // instantiable even though this endpoint writes a new NutritionPlan.
        var template = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.NutritionPlanTemplates, req.TemplateId, nutritionistId, NutritionPlanTemplateLibrary.Denial, ct);

        if (template is null)
        {
            return;
        }

        var hasLink = await authHelper.HasActiveLinkAsync(nutritionistId, req.ClientId, ct);

        if (!hasLink)
        {
            // 404, never 403 — a 403 would confirm the client exists to an unlinked coach.
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientUserId = clientProfile.UserId;

        if (req.StartDate.HasValue)
        {
            var candidateStart = DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc);

            var existingFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                                & Builders<NutritionPlan>.Filter.Ne(p => p.Status, NutritionPlanStatus.Archived)
                                & Builders<NutritionPlan>.Filter.Ne(p => p.Status, NutritionPlanStatus.Completed)
                                & Builders<NutritionPlan>.Filter.Ne(p => p.StartDate, null);

            using var existingCursor = await mongo.NutritionPlans.FindAsync(existingFilter, cancellationToken: ct);
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

        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            NutritionistId = nutritionistId,
            Name = req.Name,
            Status = NutritionPlanStatus.Draft,
            GlobalSettings = template.GlobalSettings,
            Goal = template.Goal,
            Supplements = TemplateContentCloner.CloneSupplements(template.Supplements, mintFreshExternalIds: true),
            Weeks = TemplateContentCloner.CloneWeeksAsPlan(template.Weeks),
            Version = 1,
            DateCreated = now,
            StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null
        };

        await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: ct);

        await HttpContext.Response.SendAsync(new InstantiateNutritionPlanTemplateResponse
        {
            PlanId = plan.ExternalId,
            ClientId = req.ClientId,
            Name = plan.Name,
            Status = plan.Status.ToString(),
            DateCreated = plan.DateCreated
        }, 201, cancellation: ct);
    }
}
