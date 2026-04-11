using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Handles post-submission logic for questionnaire responses: notifies the
/// professional who assigned the questionnaire.
///
/// Profile mapping has been removed — questionnaire answers are now scoped
/// per coach-client relationship and accessed directly from the response.
/// Shared profile fields (height, weight, etc.) should be updated by the
/// client via the measurements / profile screens instead.
/// </summary>
public class ProfileMapperService(IApplicationDbContext db, INotificationService notifications, IRealtimeNotifier notifier) : IProfileMapperService
{
    public async Task MapResponseToProfileAsync(QuestionnaireResponse response, CancellationToken ct = default)
    {
        // Send notification to the professional
        var clientProfile = await db.ClientProfiles
            .Include(cp => cp.User)
            .Where(cp => cp.UserId == response.ClientId)
            .FirstOrDefaultAsync(ct);

        var clientUser = clientProfile?.User;
        var clientName = clientUser != null ? $"{clientUser.FirstName} {clientUser.LastName}" : "Klient";

        await notifications.CreateAsync(
            response.ProfessionalId,
            NotificationType.QuestionnaireSubmitted,
            "Dotazník vyplněn",
            $"{clientName} vyplnil(a) vstupní dotazník.",
            ct: ct);

        await notifier.NotifyAsync(response.ProfessionalId, "questionnaireSubmitted", new
        {
            ClientPublicId = clientProfile?.PublicId,
            ClientName = clientName,
            ResponsePublicId = response.PublicId,
        }, ct);

        await db.SaveChangesAsync(ct);
    }
}
