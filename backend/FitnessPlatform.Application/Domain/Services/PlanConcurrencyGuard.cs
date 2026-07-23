using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Outcome of a <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> call.
/// </summary>
public enum PlanConcurrencyOutcome
{
    /// <summary>No document matched the lookup filter (not found or not owned by the caller).</summary>
    NotFound,

    /// <summary>The fetched document's version did not match the caller-supplied expected version.</summary>
    VersionConflict,

    /// <summary>
    /// The <c>mutate</c> delegate already wrote a response (e.g. via <c>SendProblemAsync</c>) and
    /// signalled the guard to stop before reaching <c>ReplaceOneAsync</c>. The caller must return
    /// immediately without sending any further response.
    /// </summary>
    HandledByMutator,

    /// <summary>The version-gated <c>ReplaceOneAsync</c> matched zero documents (lost the concurrency race).</summary>
    ReplaceConflict,

    /// <summary>The mutation was applied and persisted successfully.</summary>
    Success
}

/// <summary>
/// Result of a <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> call.
/// </summary>
/// <typeparam name="TDoc">The Mongo document type being guarded.</typeparam>
public class PlanConcurrencyResult<TDoc>
{
    /// <summary>The outcome of the guarded replace attempt.</summary>
    public required PlanConcurrencyOutcome Outcome { get; init; }

    /// <summary>
    /// The mutated document, present only when <see cref="Outcome"/> is
    /// <see cref="PlanConcurrencyOutcome.Success"/>.
    /// </summary>
    public TDoc? Document { get; init; }
}

/// <summary>
/// Encapsulates the fetch-by-ExternalId + ownership check + Version check + mutate +
/// version-gated <c>ReplaceOneAsync</c> + conflict-on-zero-modified skeleton shared by the
/// NutritionPlans/TrainingPlans version-gated mutation endpoints (Update, Publish, Complete,
/// LinkQuestionnaire). This service owns only the fetch/version-check/replace sequencing —
/// endpoint-specific validation and field mutation stays in the caller-supplied
/// <c>mutate</c> delegate, and any work that must run only after a confirmed successful
/// replace (e.g. archiving sibling plans, releasing edit locks) stays in the endpoint, gated on
/// <see cref="PlanConcurrencyOutcome.Success"/>.
///
/// <para>
/// <b>Create and Delete are intentionally excluded (#659 / #695).</b> #659's original
/// six-pair enumeration (Create, Update, Publish, Delete, Complete, LinkQuestionnaire)
/// only migrated the four pairs that already implement this guard's version-gated
/// fetch-check-replace-409 skeleton. Create and Delete don't:
/// <list type="bullet">
/// <item><b>Create</b> (<c>CreateTrainingPlanEndpoint</c> / <c>CreatePlanEndpoint</c>)
/// uses <c>InsertOneAsync</c> with <c>Version = 1</c> on a brand-new document — there is
/// no existing row to fetch, no version to compare, and no 409 path to extract.</item>
/// <item><b>Delete</b> (<c>DeleteTrainingPlanEndpoint</c> / <c>DeletePlanEndpoint</c>)
/// soft-deletes via <c>UpdateOneAsync(...).Inc(Version)</c> scoped only by ExternalId +
/// owner — it never compares a caller-supplied <c>req.Version</c>, so there is no
/// version-conflict branch for the guard to encapsulate either.</item>
/// </list>
/// Forcing either through this guard as-is would <i>add</i> a version-check/409 path
/// neither endpoint has today — a behavior change #659's AC explicitly ruled out ("not a
/// behavior or API-shape change"). This is the intended, permanent state: Create/Delete
/// stay as-is unless their own duplication independently clears the project's
/// rule-of-three for extraction (a decision for a fresh, narrowly-scoped issue, not a
/// re-opening of #659).
/// </para>
/// </summary>
public class PlanConcurrencyGuard
{
    /// <summary>
    /// Fetches a document via <paramref name="lookupFilter"/>, checks its version against
    /// <paramref name="expectedVersion"/>, applies <paramref name="mutate"/>, and persists the
    /// result via a version-gated <c>ReplaceOneAsync</c> using <paramref name="replaceFilter"/>.
    /// </summary>
    /// <param name="collection">The Mongo collection to read from and write to.</param>
    /// <param name="lookupFilter">Filter identifying the document by ExternalId and owner (e.g. NutritionistId/TrainerId).</param>
    /// <param name="replaceFilter">Filter identifying the document by ExternalId and the pre-mutation version, used for the optimistic-concurrency write.</param>
    /// <param name="expectedVersion">The version the caller expects the document to currently have.</param>
    /// <param name="getVersion">Reads the current version from a fetched document.</param>
    /// <param name="mutate">
    /// Endpoint-specific validation and mutation logic. Must mutate the document in place,
    /// including bumping its own version and updated-at fields. May throw to short-circuit
    /// (e.g. via FastEndpoints' <c>ThrowError</c>) — the exception propagates to the caller
    /// unchanged. For error paths that already write a response directly (e.g.
    /// <c>SendProblemAsync</c>) rather than throwing, the delegate must return <c>false</c> to
    /// signal the guard to stop before <c>ReplaceOneAsync</c>; returning <c>true</c> proceeds
    /// to the version-gated replace.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<PlanConcurrencyResult<TDoc>> ReplaceWithVersionGuardAsync<TDoc>(
        IMongoCollection<TDoc> collection,
        FilterDefinition<TDoc> lookupFilter,
        FilterDefinition<TDoc> replaceFilter,
        int expectedVersion,
        Func<TDoc, int> getVersion,
        Func<TDoc, CancellationToken, Task<bool>> mutate,
        CancellationToken ct)
    {
        var cursor = await collection.FindAsync(lookupFilter, cancellationToken: ct);
        var doc = await cursor.FirstOrDefaultAsync(ct);

        if (doc is null)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.NotFound };
        }

        if (getVersion(doc) != expectedVersion)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.VersionConflict };
        }

        var shouldContinue = await mutate(doc, ct);

        if (!shouldContinue)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.HandledByMutator };
        }

        var result = await collection.ReplaceOneAsync(replaceFilter, doc, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.ReplaceConflict };
        }

        return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.Success, Document = doc };
    }

    /// <summary>
    /// Fetches a document via <paramref name="lookupFilter"/>, runs <paramref name="validate"/>
    /// against it, and — if validation passes — persists a targeted <c>$set</c>/<c>$inc</c> via
    /// <c>FindOneAndUpdateAsync</c> using <paramref name="writeFilter"/> and
    /// <paramref name="arrayFilters"/>, returning the post-update document.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Added for #839 (targeted publish-week <c>$set</c>) alongside
    /// <see cref="ReplaceWithVersionGuardAsync{TDoc}"/> — deliberately additive. Unlike the
    /// replace-based guard, this method does NOT compare a caller-supplied expected version: the
    /// caller is expected to fold the concurrency guard directly into <paramref name="writeFilter"/>
    /// (e.g. an <c>ElemMatch</c> on the specific array element being mutated) so that unrelated
    /// document-level changes never produce a false conflict, while a genuine race on the same
    /// targeted element still causes the write to match zero documents.
    /// </para>
    /// <para>
    /// This method's <see cref="PlanConcurrencyResult{TDoc}.Outcome"/> never returns
    /// <see cref="PlanConcurrencyOutcome.VersionConflict"/> — that enum value only applies to the
    /// version-gated replace path above.
    /// </para>
    /// </remarks>
    /// <param name="collection">The Mongo collection to read from and write to.</param>
    /// <param name="lookupFilter">Filter identifying the document by ExternalId and owner (e.g. NutritionistId/TrainerId).</param>
    /// <param name="validate">
    /// Endpoint-specific validation logic, run against the freshly fetched document. Must NOT
    /// mutate the document — the actual mutation happens server-side via the targeted update. May
    /// throw to short-circuit (e.g. via FastEndpoints' <c>ThrowError</c>) — the exception
    /// propagates to the caller unchanged. For error paths that already write a response directly
    /// rather than throwing, the delegate must return <c>false</c> to signal the guard to stop
    /// before the write; returning <c>true</c> proceeds to <c>FindOneAndUpdateAsync</c>.
    /// </param>
    /// <param name="writeFilter">
    /// Filter identifying the document AND gating the concurrency-sensitive element (e.g.
    /// ExternalId + owner + an <c>ElemMatch</c> requiring the target array element still be in
    /// its expected pre-mutation state). Zero matches here means a genuine concurrency conflict.
    /// </param>
    /// <param name="update">The targeted <c>$set</c>/<c>$inc</c> update definition.</param>
    /// <param name="arrayFilters">
    /// Array filters identifying which array element(s) the positional <c>$[identifier]</c> tokens
    /// in <paramref name="update"/> refer to.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<PlanConcurrencyResult<TDoc>> UpdateWithArrayFilterGuardAsync<TDoc>(
        IMongoCollection<TDoc> collection,
        FilterDefinition<TDoc> lookupFilter,
        Func<TDoc, CancellationToken, Task<bool>> validate,
        FilterDefinition<TDoc> writeFilter,
        UpdateDefinition<TDoc> update,
        IEnumerable<ArrayFilterDefinition> arrayFilters,
        CancellationToken ct)
    {
        var cursor = await collection.FindAsync(lookupFilter, cancellationToken: ct);
        var doc = await cursor.FirstOrDefaultAsync(ct);

        if (doc is null)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.NotFound };
        }

        var shouldContinue = await validate(doc, ct);

        if (!shouldContinue)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.HandledByMutator };
        }

        var options = new FindOneAndUpdateOptions<TDoc>
        {
            ReturnDocument = ReturnDocument.After,
            ArrayFilters = arrayFilters?.ToList()
        };

        var updated = await collection.FindOneAndUpdateAsync(writeFilter, update, options, ct);

        if (updated is null)
        {
            return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.ReplaceConflict };
        }

        return new PlanConcurrencyResult<TDoc> { Outcome = PlanConcurrencyOutcome.Success, Document = updated };
    }
}
