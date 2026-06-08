using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetClientVerdict;

/// <summary>
/// Returns the on-track verdict and supporting signals for a specific client.
/// Trainer must have an active link to the client. Returns 403 if not linked.
/// </summary>
public class GetClientVerdictEndpoint(
    IApplicationDbContext db,
    IClientVerdictService verdictService)
    : Endpoint<GetClientVerdictRequest, GetClientVerdictResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{clientId}/verdict");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client on-track verdict";
            s.Description = "Returns the on-track verdict and supporting signals (compliance, weight, training frequency, activity, PRs) for a specific client managed by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientVerdictRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        // Locate the trainer's professional profile
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == trainerUserId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Locate the client profile by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .Include(cp => cp.OnboardingData)
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify an active trainer-client link exists; return 403 (not 404) when missing
        var link = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.ProfessionalProfileId == professionalProfile.Id &&
                l.ClientProfileId == clientProfile.Id &&
                l.IsActive, ct);

        if (link is null)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var targetWeightKg = clientProfile.OnboardingData?.TargetWeightKg;

        // clientProfile.UserId is the ApplicationUser.Id (Guid) used by Mongo documents
        // clientProfile.Id is the long PK used by BodyMeasurement (keyed on ClientProfileId)
        // clientProfile.PublicId is the ApplicationUser.PublicId analog — used for PersonalRecord.ClientId
        var result = await verdictService.ComputeAsync(
            clientUserId: clientProfile.UserId,
            clientProfileId: clientProfile.Id,
            clientPublicId: clientProfile.PublicId,
            targetWeightKg: targetWeightKg,
            ct: ct);

        await Send.OkAsync(new GetClientVerdictResponse
        {
            Verdict = result.Verdict,
            CompliancePercent = result.CompliancePercent,
            WeightDeltaToGoal = result.WeightDeltaToGoal,
            WeightDirection = result.WeightDirection,
            TrainingFrequencyActual = result.TrainingFrequencyActual,
            TrainingFrequencyPrescribed = result.TrainingFrequencyPrescribed,
            LastActiveAt = result.LastActiveAt,
            PrCountThisMonth = result.PrCountThisMonth
        }, ct);
    }
}
