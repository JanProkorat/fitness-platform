using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.UnlogMealEaten;

/// <summary>
/// Endpoint for removing a previously logged meal entry for the current day,
/// letting a client uncheck a meal they marked as eaten by mistake.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing SignalR events.</param>
public class UnlogMealEatenEndpoint(IMongoContext mongo, IApplicationDbContext db, IRealtimeNotifier notifier) : Endpoint<UnlogMealEatenRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/nutrition/log/meals/{MealId}/eaten");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Unmark a meal as eaten";
            s.Description = "Removes today's meal log entries for the given meal, letting the client uncheck a meal.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UnlogMealEatenRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Remove any meal log entries for this meal and client logged today (UTC).
        // Uses the same OR pattern as GetTodayLog and SaveMealPhotos to find all log
        // variants: modern records (LogDate == today), photo-only records (EatenAt null,
        // LogDate == today), and legacy records (LogDate = default, EatenAt in today's window).
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var filter = Builders<MealLog>.Filter.And(
            Builders<MealLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<MealLog>.Filter.Eq(l => l.MealId, req.MealId),
            Builders<MealLog>.Filter.Or(
                Builders<MealLog>.Filter.Eq(l => l.LogDate, today),
                Builders<MealLog>.Filter.And(
                    Builders<MealLog>.Filter.Gte(l => l.EatenAt, today),
                    Builders<MealLog>.Filter.Lt(l => l.EatenAt, tomorrow))));

        var deleteResult = await mongo.MealLogs.DeleteManyAsync(filter, ct);

        if (deleteResult.DeletedCount > 0)
        {
            // The SignalR payload's ClientId is the trainer-facing ClientProfile.PublicId
            // convention (unrelated to the Mongo document clientId key migrated in #840) —
            // pass clientProfile.PublicId explicitly rather than the (now UserId-valued) clientId.
            await NotifyLinkedProfessionalsAsync(clientProfile.Id, clientProfile.PublicId, ct);
        }

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Pushes a <c>clientcomplianceupdated</c> SignalR event to every active professional
    /// (trainer/nutritionist) linked to this client so their dashboards can refresh streak
    /// and compliance without polling.
    /// </summary>
    private async Task NotifyLinkedProfessionalsAsync(long clientProfileId, Guid clientPublicId, CancellationToken ct)
    {
        var professionalUserIds = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfileId && l.IsActive)
            .Join(db.ProfessionalProfiles.AsNoTracking(),
                link => link.ProfessionalProfileId,
                prof => prof.Id,
                (_, prof) => prof.UserId)
            .Distinct()
            .ToListAsync(ct);

        var payload = new { ClientId = clientPublicId };
        foreach (var userId in professionalUserIds)
        {
            await notifier.NotifyAsync(userId, "clientcomplianceupdated", payload, ct);
        }
    }
}
