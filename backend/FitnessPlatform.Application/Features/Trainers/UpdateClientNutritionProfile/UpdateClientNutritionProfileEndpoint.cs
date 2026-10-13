using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.UpdateClientNutritionProfile;

/// <summary>
/// Edits a client's dislikes, habits, allergies and fibre target. Requires a live link
/// that grants nutrition-plan visibility.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="linkAuthorizationService">Resolves the caller's link capabilities to the client.</param>
/// <param name="audit">Audit logging service.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class UpdateClientNutritionProfileEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    IAuditService audit)
    : Endpoint<UpdateClientNutritionProfileRequest, UpdateClientNutritionProfileResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/clients/{ClientId}/nutrition-profile");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update a client's nutrition profile";
            s.Description =
                "Replaces the client's dislikes, habits and allergies and optionally sets the fibre target. " +
                "Requires an active link with nutrition-plan visibility.";
            s.Responses[StatusCodes.Status200OK] = "Nutrition profile updated";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "Link does not grant nutrition-plan visibility";
            s.Responses[StatusCodes.Status404NotFound] = "No active link to the client";
            s.Responses[StatusCodes.Status409Conflict] = "Client has no onboarding data, or no nutrition targets to hold a fibre target";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientNutritionProfileRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            Guid.Parse(userId), req.ClientId, ct);

        if (capabilities is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (!capabilities.Value.CanViewNutritionPlans)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .Include(cp => cp.OnboardingData)
            .ThenInclude(od => od!.NutritionTargets)
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var onboardingData = clientProfile.OnboardingData;

        if (onboardingData is null || (req.FibreGrams.HasValue && onboardingData.NutritionTargets is null))
        {
            await this.SendProblemAsync(
                409,
                ErrorCodes.ClientNutritionProfileMissing,
                "The client has no onboarding data or nutrition targets to update.",
                ct);
            return;
        }

        onboardingData.Dislikes = Normalize(req.Dislikes);
        onboardingData.Habits = Normalize(req.Habits);
        onboardingData.Allergies = string.Join(",", Normalize(req.Allergies));

        if (req.FibreGrams.HasValue)
        {
            onboardingData.NutritionTargets!.FibreGrams = req.FibreGrams.Value;
        }

        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            Guid.Parse(userId), "UpdateClientNutritionProfile", "ClientProfile",
            clientProfile.PublicId, HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: "{\"updated\":true}", ct: ct);

        await Send.OkAsync(new UpdateClientNutritionProfileResponse
        {
            Dislikes = onboardingData.Dislikes,
            Habits = onboardingData.Habits,
            Allergies = Normalize(req.Allergies),
            FibreGrams = onboardingData.NutritionTargets?.FibreGrams
        }, ct);
    }

    private static List<string> Normalize(List<string> items) =>
        items.Select(item => item.Trim()).ToList();
}
