using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.RemoveOffPlanFood;

/// <summary>
/// Removes an off-plan food entry from the caller's day log for today.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class RemoveOffPlanFoodEndpoint(IMongoContext mongo, IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<RemoveOffPlanFoodRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/nutrition/log/off-plan-foods/{EntryId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Remove an off-plan food entry";
            s.Description = "Removes one off-plan food entry from today's day log. Entries of other days or other clients are not found.";
            s.Responses[StatusCodes.Status204NoContent] = "Entry removed";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "No such entry in the caller's day log for today";
            s.Responses[StatusCodes.Status409Conflict] = "The day log changed concurrently; retry";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RemoveOffPlanFoodRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;

        if (await ClientRequestDeduplicator.FindAsync(mongo, clientId, req.ClientRequestId, ct) is not null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        var (todayUtc, windowStartUtc, windowEndUtc) = await db.ResolveClientLocalDayWindowAsync(
            clientId, req.OccurredAt?.UtcDateTime ?? nowUtc, ct);

        var logFilter = Builders<DayLog>.Filter.And(
            TodayDayLogFilter.Build(clientId, null, todayUtc, windowStartUtc, windowEndUtc),
            Builders<DayLog>.Filter.ElemMatch(l => l.OffPlanFoods, e => e.EntryId == req.EntryId));

        using var cursor = await mongo.DayLogs.FindAsync(logFilter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var versionedFilter = Builders<DayLog>.Filter.And(
            Builders<DayLog>.Filter.Eq(l => l.Id, log.Id),
            Builders<DayLog>.Filter.Eq(l => l.Version, log.Version));

        var update = Builders<DayLog>.Update
            .PullFilter(l => l.OffPlanFoods, e => e.EntryId == req.EntryId)
            .Set(l => l.UpdatedAt, nowUtc)
            .Inc(l => l.Version, 1);

        var result = await mongo.DayLogs.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.DayLogVersionConflict,
                "The day log was modified by another request.", ct);
            return;
        }

        await ClientRequestDeduplicator.RecordAsync(
            mongo, clientId, req.ClientRequestId, "RemoveOffPlanFood", req.BasedOnPlanVersion, null, nowUtc, ct);

        await Send.NoContentAsync(ct);
    }
}
