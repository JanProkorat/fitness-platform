using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.Client.OnboardingAnswers.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.OnboardingAnswers.Get;

/// <summary>
/// Returns the caller's editable onboarding answers.
/// </summary>
/// <param name="db">Database context.</param>
internal sealed class GetClientOnboardingAnswersEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<ClientOnboardingAnswersResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/onboarding/answers");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get my onboarding answers";
            s.Description = "Returns the onboarding answers the client can edit after onboarding.";
            s.Responses[StatusCodes.Status200OK] = "Current answers";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "No client profile";
            s.Responses[StatusCodes.Status409Conflict] = "Onboarding not completed (ONBOARDING_NOT_COMPLETED)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (profile.OnboardingData is null)
        {
            await this.SendProblemAsync(
                409, ErrorCodes.OnboardingNotCompleted, "The client has not completed onboarding.", ct);
            return;
        }

        await Send.OkAsync(ClientOnboardingAnswersResponse.FromEntity(profile.OnboardingData), ct);
    }
}
