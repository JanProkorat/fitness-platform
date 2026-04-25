using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayDayLog;

/// <summary>
/// Endpoint that returns the client's day-level diary log for today (plan-level photos + note).
/// Returns an empty photo list and null note when no day log exists for today.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class GetTodayDayLogEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : EndpointWithoutRequest<GetTodayDayLogResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/log/day/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's plan-level day log";
            s.Description =
                "Returns today's day-level diary entry (plan photos and note) for the authenticated client. " +
                "Returns an empty Photos list and null Note when no entry exists yet.";
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

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientId = clientProfile.PublicId;
        var todayUtc = DateTime.UtcNow.Date;

        // Resolve the client's active plan to scope the lookup
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            // No active plan — return empty response (not a 404; the gallery can still render)
            await Send.OkAsync(new GetTodayDayLogResponse(), ct);
            return;
        }

        var logFilter = Builders<DayLog>.Filter.And(
            Builders<DayLog>.Filter.Eq(l => l.ClientId, clientId),
            Builders<DayLog>.Filter.Eq(l => l.PlanId, plan.ExternalId),
            Builders<DayLog>.Filter.Eq(l => l.LogDate, todayUtc));

        var logCursor = await mongo.DayLogs.FindAsync(logFilter, cancellationToken: ct);
        var dayLog = await logCursor.FirstOrDefaultAsync(ct);

        if (dayLog is null)
        {
            await Send.OkAsync(new GetTodayDayLogResponse(), ct);
            return;
        }

        var response = new GetTodayDayLogResponse
        {
            Note = dayLog.Note,
            Photos = dayLog.Photos
                .Select(p => new DayPhotoDto
                {
                    BlobUrl = p.BlobUrl,
                    UploadedAt = p.UploadedAt,
                    Note = p.Note,
                    Category = p.Category.ToString()
                })
                .ToList()
        };

        await Send.OkAsync(response, ct);
    }
}
