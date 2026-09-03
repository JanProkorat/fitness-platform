using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SubscriptionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.UpdateSubscriptionPlan;

/// <summary>
/// Updates an existing subscription tier's fields. <c>Code</c> is the route key and cannot be
/// changed — see <see cref="UpdateSubscriptionPlanRequest"/>.
/// </summary>
/// <param name="db">Application database context.</param>
internal sealed class UpdateSubscriptionPlanEndpoint(IApplicationDbContext db)
    : Endpoint<UpdateSubscriptionPlanRequest, SubscriptionPlanDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/admin/subscription-plans/{Code}");
        Roles(AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Update subscription plan";
            s.Description = "Updates a subscription tier's fields. Code is immutable — reactivation/deactivation happens via the IsActive field here, not a separate endpoint.";
            s.Responses[StatusCodes.Status200OK] = "Subscription plan updated";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Caller is not an Admin";
            s.Responses[StatusCodes.Status404NotFound] = "No plan with this Code";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateSubscriptionPlanRequest req, CancellationToken ct)
    {
        var plan = await db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == req.Code, ct);

        if (plan is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status404NotFound,
                ErrorCodes.SubscriptionPlanNotFound,
                "No subscription plan with this Code.",
                ct);
            return;
        }

        plan.NameCs = req.NameCs;
        plan.NameEn = req.NameEn;
        plan.NameDe = req.NameDe;
        plan.ApplicableRoles = req.ApplicableRoles;
        plan.CanCreatePlans = req.CanCreatePlans!.Value;
        plan.CanMessage = req.CanMessage!.Value;
        plan.CanSendQuestionnaires = req.CanSendQuestionnaires!.Value;
        plan.CanUseWeeklyCheckIns = req.CanUseWeeklyCheckIns!.Value;
        plan.CanUsePerClientCheckInConfig = req.CanUsePerClientCheckInConfig!.Value;
        plan.MaxActiveClients = req.MaxActiveClients.Value;
        plan.PriceMinorUnits = req.PriceMinorUnits;
        plan.Currency = req.Currency;
        plan.BillingInterval = req.BillingInterval;
        plan.ExternalPriceId = req.ExternalPriceId;
        plan.IsActive = req.IsActive!.Value;

        await db.SaveChangesAsync(ct);

        await Send.OkAsync(SubscriptionPlanDto.FromEntity(plan), ct);
    }
}
