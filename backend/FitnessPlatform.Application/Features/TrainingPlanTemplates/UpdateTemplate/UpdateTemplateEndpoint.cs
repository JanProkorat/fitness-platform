using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.UpdateTemplate;

/// <summary>
/// Full-state update of a training plan template: replaces name, description, goal/difficulty,
/// and the week tree. Owner-only, version-gated.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="guard">Shared version-gated fetch-check-replace-409 skeleton.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class UpdateTemplateEndpoint(IMongoContext mongo, PlanConcurrencyGuard guard, TimeProvider timeProvider)
    : Endpoint<UpdateTemplateRequest, TrainingPlanTemplateDetailDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/training/plan-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Full-state update of a training plan template";
            s.Description = "Replaces the template's name, settings, and week tree. Owner-only, version-gated.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownerId = Guid.Parse(userId);

        var updated = await this.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            mongo.TrainingPlanTemplates,
            req.TemplateId,
            ownerId,
            TrainingPlanTemplateLibrary.Denial,
            req.Version,
            guard,
            (template, _) => MutateAsync(template, req),
            ct);

        if (updated is null)
        {
            return;
        }

        await Send.OkAsync(TrainingPlanTemplateDetailDto.FromDocument(updated), ct);
    }

    /// <summary>
    /// Endpoint-specific mutation applied to the fetched template before the version-gated
    /// replace. Always returns <c>true</c> — every validation rule already ran in
    /// <see cref="UpdateTemplateValidator"/> before <c>HandleAsync</c> was reached.
    /// </summary>
    private Task<bool> MutateAsync(TrainingPlanTemplate template, UpdateTemplateRequest req)
    {
        var weeks = TemplateRequestMapper.ToWeeks(req.Weeks);

        template.Name = req.Name;
        template.Description = req.Description;
        template.Goal = req.Goal;
        template.Difficulty = req.Difficulty;
        template.Weeks = weeks;
        template.WeekCount = weeks.Count;
        template.DateUpdated = timeProvider.GetUtcNow().UtcDateTime;
        template.Version += 1;

        return Task.FromResult(true);
    }
}
