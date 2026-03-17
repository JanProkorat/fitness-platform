using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetTrainerProfile;

/// <summary>
/// Returns the trainer profile for the currently authenticated trainer.
/// </summary>
/// <param name="db">Database context.</param>
public class GetTrainerProfileEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetTrainerProfileResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/profile");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get trainer profile";
            s.Description = "Returns the trainer profile data for the currently authenticated user.";
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

        var profile = await db.TrainerProfiles
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new GetTrainerProfileResponse
        {
            Bio = profile.Bio,
            Specialization = profile.Specialization,
            YearsOfExperience = profile.YearsOfExperience
        }, ct);
    }
}
