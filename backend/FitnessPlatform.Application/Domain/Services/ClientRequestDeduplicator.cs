using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Look-up and record helpers for offline-sync request dedupe. Callers look up first, apply the
/// write on a miss, and record only after the write succeeded.
/// </summary>
public static class ClientRequestDeduplicator
{
    /// <summary>
    /// Returns the recorded request, or null when <paramref name="clientRequestId"/> is null or unseen.
    /// </summary>
    public static async Task<ProcessedClientRequest?> FindAsync(
        IMongoContext mongo, Guid clientId, Guid? clientRequestId, CancellationToken ct)
    {
        if (clientRequestId is null)
        {
            return null;
        }

        var filter = Builders<ProcessedClientRequest>.Filter.And(
            Builders<ProcessedClientRequest>.Filter.Eq(r => r.ClientId, clientId),
            Builders<ProcessedClientRequest>.Filter.Eq(r => r.ClientRequestId, clientRequestId.Value));

        using var cursor = await mongo.ProcessedClientRequests.FindAsync(filter, cancellationToken: ct);

        return await cursor.FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Records a successfully applied request. No-op when <paramref name="clientRequestId"/> is null;
    /// a duplicate-key error from a concurrent twin is ignored.
    /// </summary>
    public static async Task RecordAsync(
        IMongoContext mongo,
        Guid clientId,
        Guid? clientRequestId,
        string operation,
        int? basedOnPlanVersion,
        Guid? resultId,
        DateTime createdAtUtc,
        CancellationToken ct)
    {
        if (clientRequestId is null)
        {
            return;
        }

        var record = new ProcessedClientRequest
        {
            ClientId = clientId,
            ClientRequestId = clientRequestId.Value,
            Operation = operation,
            BasedOnPlanVersion = basedOnPlanVersion,
            ResultId = resultId,
            CreatedAt = createdAtUtc,
        };

        try
        {
            await mongo.ProcessedClientRequests.InsertOneAsync(record, cancellationToken: ct);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            // A concurrent twin recorded the same request first; the write is recorded either way.
        }
    }
}
