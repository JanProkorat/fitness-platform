using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.UpdateClientData;

/// <summary>
/// Updates a client's profile fields and nutrition targets.
/// Only non-null request fields are applied.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
public class UpdateClientDataEndpoint(IApplicationDbContext db, IAuditService audit)
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

        var hasLink = await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(l => l.ProfessionalProfileId == professionalProfile.Id
                        && l.ClientProfileId == clientProfile.Id
                        && l.IsActive, ct);
        if (!hasLink) { await Send.NotFoundAsync(ct); return; }

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
