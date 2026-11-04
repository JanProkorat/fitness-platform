using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.GetIncomingRequests;

/// <summary>
/// Endpoint for a professional to retrieve incoming pending client requests.
/// </summary>
public class GetIncomingRequestsEndpoint(IApplicationDbContext db, IMongoContext mongo) : EndpointWithoutRequest<GetIncomingRequestsResponse>
{
    public override void Configure()
    {
        Get("/trainer/client-requests");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Get incoming client requests";
            s.Description = "Returns all open client requests for the authenticated professional: pending ones, and ones " +
                "where the coach proposed a package and waits for the client's answer (Status PackageProposed, with Proposal).";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            await Send.OkAsync(new GetIncomingRequestsResponse(), ct);
            return;
        }

        // Only requests still pending and addressed to this professional are listed, so the
        // requester's onboarding answers below are never exposed to anyone else or after an answer.
        var rows = await db.ClientRequests
            .AsNoTracking()
            .Where(r => r.ProfessionalProfileId == professionalProfile.Id
                     && (r.Status == ClientRequestStatus.Pending || r.Status == ClientRequestStatus.PackageProposed))
            .OrderByDescending(r => r.SentAt)
            .Select(r => new
            {
                r.PublicId,
                r.Status,
                Proposal = r.Status == ClientRequestStatus.PackageProposed && r.ProposedPackage != null
                    ? new IncomingRequestProposalDto
                    {
                        ProposedAt = r.ProposedAt ?? r.SentAt,
                        Package = new IncomingRequestPackageDto
                        {
                            PublicId = r.ProposedPackage.PublicId,
                            Name = r.ProposedPackage.Name,
                            Billing = r.ProposedPackage.Billing,
                            IntervalWeeks = r.ProposedPackage.IntervalWeeks,
                            Price = r.ProposedPackage.Price,
                            Currency = r.ProposedPackage.Currency,
                        },
                        Discount = r.ProposedDiscount == null
                            ? null
                            : new IncomingRequestDiscountDto
                            {
                                PublicId = r.ProposedDiscount.PublicId,
                                Name = r.ProposedDiscount.Name,
                                Type = r.ProposedDiscount.Type,
                                Value = r.ProposedDiscount.Value,
                                Currency = r.ProposedDiscount.Currency,
                            },
                    }
                    : null,
                ClientPublicId = r.ClientProfile.PublicId,
                FirstName = r.ClientProfile.User.FirstName,
                LastName = r.ClientProfile.User.LastName,
                Email = r.ClientProfile.User.Email,
                r.Message,
                r.SentAt,
                r.ShareHistory,
                ClientProfileId = r.ClientProfileId,
                ClientUserId = r.ClientProfile.UserId,
                Package = r.CoachPackage == null
                    ? null
                    : new IncomingRequestPackageDto
                    {
                        PublicId = r.CoachPackage.PublicId,
                        Name = r.CoachPackage.Name,
                        Billing = r.CoachPackage.Billing,
                        IntervalWeeks = r.CoachPackage.IntervalWeeks,
                        Price = r.CoachPackage.Price,
                        Currency = r.CoachPackage.Currency,
                    },
                r.ClientProfile.HeightCm,
                r.ClientProfile.WeightKg,
                PrimaryGoal = r.ClientProfile.OnboardingData != null
                    ? (PrimaryGoal?)r.ClientProfile.OnboardingData.PrimaryGoal
                    : null,
                ActivityLevel = r.ClientProfile.OnboardingData != null
                    && r.ClientProfile.OnboardingData.NutritionTargets != null
                    ? (ActivityLevel?)r.ClientProfile.OnboardingData.NutritionTargets.DerivedActivityLevel
                    : null,
            })
            .ToListAsync(ct);

        // History counts only for clients who agreed to share, fetched once for the whole list.
        var counts = await ClientHistoryCounts.LoadAsync(
            db,
            mongo,
            rows.Where(r => r.ShareHistory).Select(r => (r.ClientProfileId, r.ClientUserId)).ToList(),
            ct);

        var requests = rows.Select(r => new IncomingClientRequestDto
        {
            Package = r.Package,
            Status = r.Status,
            Proposal = r.Proposal,
            ShareHistory = r.ShareHistory,
            History = r.ShareHistory && counts.TryGetValue(r.ClientProfileId, out var history)
                ? new IncomingRequestHistoryDto
                {
                    PlanCount = history.PlanCount,
                    MeasurementCount = history.MeasurementCount,
                    PhotoCount = history.PhotoCount,
                }
                : null,
            PublicId = r.PublicId,
            ClientPublicId = r.ClientPublicId,
            ClientFirstName = r.FirstName ?? string.Empty,
            ClientLastName = r.LastName ?? string.Empty,
            ClientEmail = r.Email ?? string.Empty,
            Message = r.Message,
            SentAt = r.SentAt,
            HeightCm = r.HeightCm,
            WeightKg = r.WeightKg,
            PrimaryGoal = r.PrimaryGoal?.ToString(),
            DerivedActivityLevel = r.ActivityLevel?.ToString(),
        }).ToList();

        await Send.OkAsync(new GetIncomingRequestsResponse { Requests = requests }, ct);
    }
}
