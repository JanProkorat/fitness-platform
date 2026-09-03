using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.DeactivateSubscriptionPlan;

/// <summary>
/// Soft-deactivates a subscription tier by setting <c>IsActive = false</c>. Never deletes the
/// row — <c>CoachSubscription</c> FK history must survive. Idempotent: deactivating an
/// already-inactive plan still returns 204.
/// </summary>
/// <param name="db">Application database context.</param>
internal sealed class DeactivateSubscriptionPlanEndpoint(IApplicationDbContext db)
    : Endpoint<DeactivateSubscriptionPlanRequest, object>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/admin/subscription-plans/{Code}");
        Roles(AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Deactivate subscription plan";
            s.Description = "Soft-deactivates a subscription tier (IsActive = false). The row is never deleted — CoachSubscription FK history must survive. Idempotent.";
            s.Responses[StatusCodes.Status204NoContent] = "Plan deactivated (or was already inactive)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Caller is not an Admin";
            s.Responses[StatusCodes.Status404NotFound] = "No plan with this Code";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeactivateSubscriptionPlanRequest req, CancellationToken ct)
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

        if (plan.IsActive)
        {
            plan.IsActive = false;
            await db.SaveChangesAsync(ct);
        }

        await Send.NoContentAsync(ct);
    }
}
