using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Endpoint for logging a meal from the client's active plan as eaten.
/// Creates a <see cref="MealLog"/> document with a snapshot of the meal's foods.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing SignalR events.</param>
public class LogMealEatenEndpoint(IMongoContext mongo, IApplicationDbContext db, IRealtimeNotifier notifier) : Endpoint<LogMealEatenRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/meals/{MealId}/eaten");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Log a meal as eaten";
            s.Description = "Records that the client has eaten a specific meal from their active nutrition plan.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(LogMealEatenRequest req, CancellationToken ct)
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

        var clientId = clientProfile.PublicId;

        // Resolve the Active plan whose date window contains today — a client may hold several
        // sequential, non-overlapping Active plans (#780).
        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var activePlans = await cursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, DateTime.UtcNow);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var meal = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Meals)
            .FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        var mealLog = new MealLog
        {
            ClientId = clientId,
            PlanId = plan.ExternalId,
            MealId = req.MealId,
            LogDate = now.Date,
            EatenAt = now,
            FoodsEaten = meal.Foods,
            Photos = (req.PhotoBlobUrls ?? [])
                .Select(url => new MealPhoto { BlobUrl = url, UploadedAt = now })
                .ToList(),
            Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim()
        };

        await mongo.MealLogs.InsertOneAsync(mealLog, cancellationToken: ct);

        await NotifyLinkedProfessionalsAsync(clientProfile.Id, clientId, ct);

        await HttpContext.Response.SendAsync(new { Message = "Meal logged successfully." }, 201, cancellation: ct);
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
