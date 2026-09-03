using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.SubscriptionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.GetSubscriptionPlans;

/// <summary>
/// Lists every subscription tier, including inactive ones, for the Admin management UI.
/// </summary>
/// <param name="db">Application database context.</param>
internal sealed class GetSubscriptionPlansEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetSubscriptionPlansResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/admin/subscription-plans");
        Roles(AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "List subscription plans";
            s.Description = "Returns every subscription tier, including inactive ones — the Admin management UI needs the full set, not just what's currently offered.";
            s.Responses[StatusCodes.Status200OK] = "All subscription plans";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Caller is not an Admin";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var plans = await db.SubscriptionPlans
            .AsNoTracking()
            .OrderBy(p => p.Code)
            .ToListAsync(ct);

        await Send.OkAsync(new GetSubscriptionPlansResponse
        {
            Plans = plans.Select(SubscriptionPlanDto.FromEntity).ToList(),
        }, ct);
    }
}
