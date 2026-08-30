using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.UpdateClientData;

/// <summary>
/// Updates a client's profile fields, nutrition targets, and (#667) identity
/// fields (first name, last name, email). Only non-null request fields are applied.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager — used for the client's identity fields.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="linkAuthorizationService">
/// Resolves the caller's link capabilities to the client. Called only after the caller's own
/// professional profile and the target client profile are separately confirmed to exist (both
/// still 404 on their own), so a <see langword="null"/> result here can only mean "no active
/// link" — preserving the endpoint's existing 404 (not 403) for that case.
/// </param>
public class UpdateClientDataEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    IAuditService audit,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<UpdateClientDataRequest, UpdateClientDataResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/trainer/clients/{ClientId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update client data";
            s.Description = "Updates client profile fields and/or nutrition targets. Only non-null fields are applied.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientDataRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == Guid.Parse(userId), ct);
        if (professionalProfile is null) { await Send.NotFoundAsync(ct); return; }

        var clientProfile = await db.ClientProfiles
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);
        if (clientProfile is null) { await Send.NotFoundAsync(ct); return; }

        // The professional and client profiles are already confirmed to exist above, so a null
        // result here can only mean "no active link" — not "no professional/client profile".
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            Guid.Parse(userId), req.ClientId, ct);
        if (capabilities is null) { await Send.NotFoundAsync(ct); return; }

        // Update identity fields (#667) — these live on ApplicationUser, not ClientProfile.
        if (req.FirstName != null || req.LastName != null || req.Email != null)
        {
            var clientUser = await userManager.FindByIdAsync(clientProfile.UserId.ToString());
            if (clientUser is null) { await Send.NotFoundAsync(ct); return; }

            if (req.Email != null && !string.Equals(clientUser.Email, req.Email, StringComparison.OrdinalIgnoreCase))
            {
                // SetEmailAsync (not a direct field assignment) so NormalizedEmail stays in
                // sync with the uniqueness index UserManager.FindByEmailAsync relies on, and
                // so RequireUniqueEmail's validator catches a duplicate here rather than
                // failing silently or crashing on a unique-constraint violation at SaveChanges.
                var emailResult = await userManager.SetEmailAsync(clientUser, req.Email);
                if (!emailResult.Succeeded)
                {
                    ThrowError("Email", string.Join(" ", emailResult.Errors.Select(e => e.Description)));
                    return;
                }

                // Keep UserName in sync with Email — Register always sets them equal, and
                // other lookups (FindByNameAsync) should not silently diverge from it.
                var userNameResult = await userManager.SetUserNameAsync(clientUser, req.Email);
                if (!userNameResult.Succeeded)
                {
                    ThrowError("Email", string.Join(" ", userNameResult.Errors.Select(e => e.Description)));
                    return;
                }
            }

            if (req.FirstName != null) clientUser.FirstName = req.FirstName;
            if (req.LastName != null) clientUser.LastName = req.LastName;

            if (req.FirstName != null || req.LastName != null)
            {
                clientUser.DateUpdated = DateTime.UtcNow;
                await userManager.UpdateAsync(clientUser);
            }
        }

        // Update profile fields
        if (req.WeightKg.HasValue) clientProfile.WeightKg = req.WeightKg.Value;
        if (req.HeightCm.HasValue) clientProfile.HeightCm = req.HeightCm.Value;
        if (req.Age.HasValue)
        {
            clientProfile.DateOfBirth = new DateTime(DateTime.UtcNow.Year - req.Age.Value, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        }

        // Update onboarding data fields if present
        if (clientProfile.OnboardingData is { } od)
        {
            if (req.Sex != null) od.Sex = Enum.Parse<BiologicalSex>(req.Sex, true);
            if (req.WeightKg.HasValue) od.WeightKg = req.WeightKg.Value;
            if (req.HeightCm.HasValue) od.HeightCm = req.HeightCm.Value;
            if (req.Age.HasValue)
            {
                od.DateOfBirth = new DateTime(DateTime.UtcNow.Year - req.Age.Value, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            }
            if (req.DerivedActivityLevel != null) od.DerivedActivityLevel = Enum.Parse<ActivityLevel>(req.DerivedActivityLevel, true);
            if (req.DerivedNutritionGoal != null) od.DerivedNutritionGoal = Enum.Parse<NutritionGoal>(req.DerivedNutritionGoal, true);
            if (req.Bmr.HasValue) od.Bmr = req.Bmr.Value;
            if (req.Tdee.HasValue) od.Tdee = req.Tdee.Value;
            if (req.AdjustedKcal.HasValue) od.AdjustedKcal = req.AdjustedKcal.Value;
            if (req.ProteinGrams.HasValue) od.ProteinGrams = req.ProteinGrams.Value;
            if (req.CarbsGrams.HasValue) od.CarbsGrams = req.CarbsGrams.Value;
            if (req.FatGrams.HasValue) od.FatGrams = req.FatGrams.Value;
            if (req.MealDistribution != null) od.MealDistribution = req.MealDistribution;
        }

        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            Guid.Parse(userId), "UpdateClientData", "ClientProfile",
            clientProfile.PublicId, HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"updated\":true}}", ct: ct);

        await Send.OkAsync(new UpdateClientDataResponse { Message = "Client data updated" }, ct);
    }
}
