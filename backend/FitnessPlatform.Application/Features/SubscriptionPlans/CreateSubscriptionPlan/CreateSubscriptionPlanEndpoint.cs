using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SubscriptionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.CreateSubscriptionPlan;

/// <summary>
/// Creates a new subscription tier. Admin-only — tier definitions are data managed here,
/// not hardcoded (#595).
/// </summary>
/// <param name="db">Application database context.</param>
internal sealed class CreateSubscriptionPlanEndpoint(IApplicationDbContext db)
    : Endpoint<CreateSubscriptionPlanRequest, SubscriptionPlanDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/admin/subscription-plans");
        Roles(AppRoles.Admin);
        Description(b => b.WithName(nameof(CreateSubscriptionPlanEndpoint)));
        Summary(s =>
        {
            s.Summary = "Create subscription plan";
            s.Description = "Creates a new subscription tier. Code is the immutable entitlement/Stripe mapping key.";
            s.Responses[StatusCodes.Status201Created] = "Subscription plan created";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Caller is not an Admin";
            s.Responses[StatusCodes.Status409Conflict] = "A plan with this Code already exists";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateSubscriptionPlanRequest req, CancellationToken ct)
    {
        var codeExists = await db.SubscriptionPlans
            .AsNoTracking()
            .AnyAsync(p => p.Code == req.Code, ct);

        if (codeExists)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.SubscriptionPlanCodeAlreadyExists,
                "A subscription plan with this Code already exists.",
                ct);
            return;
        }

        var plan = new SubscriptionPlan
        {
            Code = req.Code,
            NameCs = req.NameCs,
            NameEn = req.NameEn,
            NameDe = req.NameDe,
            ApplicableRoles = req.ApplicableRoles,
            CanCreatePlans = req.CanCreatePlans,
            CanMessage = req.CanMessage,
            CanSendQuestionnaires = req.CanSendQuestionnaires,
            CanUseWeeklyCheckIns = req.CanUseWeeklyCheckIns,
            CanUsePerClientCheckInConfig = req.CanUsePerClientCheckInConfig,
            MaxActiveClients = req.MaxActiveClients,
            PriceMinorUnits = req.PriceMinorUnits,
            Currency = req.Currency,
            BillingInterval = req.BillingInterval,
            ExternalPriceId = req.ExternalPriceId,
            IsActive = req.IsActive,
        };

        db.SubscriptionPlans.Add(plan);
        await db.SaveChangesAsync(ct);

        await Send.ResponseAsync(SubscriptionPlanDto.FromEntity(plan), StatusCodes.Status201Created, ct);
    }
}
