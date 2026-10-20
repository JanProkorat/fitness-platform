using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.GetIncomingRequests;

/// <summary>
/// Endpoint for a professional to retrieve incoming pending client requests.
/// </summary>
public class GetIncomingRequestsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetIncomingRequestsResponse>
{
    public override void Configure()
    {
        Get("/trainer/client-requests");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Get incoming client requests";
            s.Description = "Returns all pending client requests for the authenticated professional.";
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
                     && r.Status == ClientRequestStatus.Pending)
            .OrderByDescending(r => r.SentAt)
            .Select(r => new
            {
                r.PublicId,
                ClientPublicId = r.ClientProfile.PublicId,
                FirstName = r.ClientProfile.User.FirstName,
                LastName = r.ClientProfile.User.LastName,
                Email = r.ClientProfile.User.Email,
                r.Message,
                r.SentAt,
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

        var requests = rows.Select(r => new IncomingClientRequestDto
        {
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
