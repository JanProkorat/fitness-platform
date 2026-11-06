using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Users.GetMySubscription;

/// <summary>
/// Returns the caller's coach subscription block.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves entitlements, client usage and the second-role state.</param>
internal sealed class GetMySubscriptionEndpoint(IApplicationDbContext db, EntitlementService entitlementService)
    : EndpointWithoutRequest<GetMySubscriptionResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/users/me/subscription");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get my coach subscription";
            s.Description = "The caller's plan, status, active-client usage and limit, second-role state, monthly price lines and the " +
                            "feature flags that currently apply. A coach with no subscription is shown on the Free plan with no status.";
            s.Responses[StatusCodes.Status200OK] = "The caller's subscription block";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile, or the Free plan is missing";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var profileId = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (long?)p.Id)
            .FirstOrDefaultAsync(ct);

        if (profileId is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var response = await LoadPlanBlockAsync(profileId.Value, ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var entitlements = await entitlementService.GetEntitlementsAsync(profileId.Value, ct);

        response.ActiveClientCount = await entitlementService.GetActiveClientCountAsync(profileId.Value, ct);
        response.ClientLimit = entitlements.MaxActiveClients;
        response.SecondRole = await entitlementService.GetSecondRoleStateAsync(profileId.Value, ct);
        response.Features = new SubscriptionFeaturesDto
        {
            CanCreatePlans = entitlements.CanCreatePlans,
            CanMessage = entitlements.CanMessage,
            CanSendQuestionnaires = entitlements.CanSendQuestionnaires,
            CanUseWeeklyCheckIns = entitlements.CanUseWeeklyCheckIns,
            CanUsePerClientCheckInConfig = entitlements.CanUsePerClientCheckInConfig,
            CanUsePayments = entitlements.CanUsePayments,
        };

        await Send.OkAsync(response, ct);
    }

    /// <summary>
    /// Plan identity, status and price lines — from the subscription row, or from the Free plan when there is none.
    /// </summary>
    private async Task<GetMySubscriptionResponse?> LoadPlanBlockAsync(long profileId, CancellationToken ct)
    {
        var subscription = await db.CoachSubscriptions
            .AsNoTracking()
            .Where(cs => cs.ProfessionalProfileId == profileId)
            .Select(cs => new
            {
                cs.SubscriptionPlan.Code,
                cs.SubscriptionPlan.NameCs,
                cs.SubscriptionPlan.NameEn,
                cs.SubscriptionPlan.NameDe,
                cs.Status,
                cs.CurrentPeriodEndsAt,
                cs.CancelAtPeriodEnd,
                cs.FreeUntil,
                cs.PaysSecondRoleAddOn,
                cs.SubscriptionPlanPrice.PriceMinorUnits,
                cs.SubscriptionPlanPrice.SecondRoleAddOnPriceMinorUnits,
                cs.SubscriptionPlanPrice.Currency,
            })
            .FirstOrDefaultAsync(ct);

        if (subscription is not null)
        {
            var response = new GetMySubscriptionResponse
            {
                PlanCode = subscription.Code,
                NameCs = subscription.NameCs,
                NameEn = subscription.NameEn,
                NameDe = subscription.NameDe,
                Status = subscription.Status,
                CurrentPeriodEndsAt = subscription.CurrentPeriodEndsAt,
                CancelAtPeriodEnd = subscription.CancelAtPeriodEnd,
                FreeUntil = subscription.FreeUntil,
                PriceLines =
                [
                    new SubscriptionPriceLineDto
                    {
                        Kind = SubscriptionPriceLineKind.Plan,
                        AmountMinorUnits = subscription.PriceMinorUnits,
                        Currency = subscription.Currency,
                    },
                ],
            };

            if (subscription.PaysSecondRoleAddOn && subscription.SecondRoleAddOnPriceMinorUnits is { } addOnPrice)
            {
                response.PriceLines.Add(new SubscriptionPriceLineDto
                {
                    Kind = SubscriptionPriceLineKind.SecondRoleAddOn,
                    AmountMinorUnits = addOnPrice,
                    Currency = subscription.Currency,
                });
            }

            return response;
        }

        var free = await db.SubscriptionPlans
            .AsNoTracking()
            .Where(p => p.Code == SubscriptionPlanCodes.Free)
            .FirstOrDefaultAsync(ct);

        if (free is null)
        {
            return null;
        }

        return new GetMySubscriptionResponse
        {
            PlanCode = free.Code,
            NameCs = free.NameCs,
            NameEn = free.NameEn,
            NameDe = free.NameDe,
            PriceLines =
            [
                new SubscriptionPriceLineDto
                {
                    Kind = SubscriptionPriceLineKind.Plan,
                    AmountMinorUnits = free.PriceMinorUnits,
                    Currency = free.Currency,
                },
            ],
        };
    }
}
