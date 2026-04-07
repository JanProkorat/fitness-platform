using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetTrainerProfile;

/// <summary>
/// Returns the professional profile for the currently authenticated trainer or nutritionist.
/// </summary>
/// <param name="db">Database context.</param>
public class GetProfessionalProfileEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetProfessionalProfileResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/profile");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get professional profile";
            s.Description = "Returns the professional profile data for the currently authenticated user.";
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

        var profile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(pp => pp.UserId == Guid.Parse(userId), ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new GetProfessionalProfileResponse
        {
            Bio = profile.Bio,
            Specialization = profile.Specialization,
            City = profile.City,
            EstimatedPrice = profile.EstimatedPrice,
            Specializations = profile.Specializations,
            Certificates = profile.Certificates,
            Languages = profile.Languages,
            CollaborationType = profile.CollaborationType,
            MaxClients = profile.MaxClients,
            LinkedIn = profile.LinkedIn,
            Instagram = profile.Instagram,
            Website = profile.Website,
            ShowInSearch = profile.ShowInSearch,
            AcceptNewClients = profile.AcceptNewClients
        }, ct);
    }
}
