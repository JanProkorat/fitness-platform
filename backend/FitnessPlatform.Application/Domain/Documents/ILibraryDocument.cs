using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Shared contract for the four sharing-library MongoDB documents (meal, session,
/// nutrition-plan, and training-plan templates). Pins the members
/// <see cref="Services.LibraryAccessGuard"/> and <see cref="Services.LibrarySearchHelper"/>
/// operate on generically, so the four consuming features do not each invent their own
/// guard/search convention.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="ExternalId"/> and <see cref="DateCreated"/> are on the interface deliberately:
/// <see cref="Services.LibrarySearchHelper"/> sorts on <see cref="DateCreated"/> descending
/// with <see cref="ExternalId"/> ascending as a tiebreaker, and a generic constraint cannot
/// sort on members the interface does not declare. This interface intentionally does not
/// extend to any other document — every other document in the codebase uses
/// <c>NutritionistId</c> / <c>TrainerId</c> / <c>OwnerTrainerId</c> instead of a uniform
/// <see cref="OwnerId"/>, and retrofitting those is out of scope here (issue #766).
/// </para>
/// <para>
/// <b>Required indexes (each implementing library must create these for its own collection —
/// this interface only mandates them, it does not create them).</b> With
/// <see cref="ExternalId"/> now the sole lookup key for
/// <see cref="Extensions.LibraryDenialExtensions.LoadLibraryEntryForReadOrRespondAsync{TDoc}"/>
/// and <see cref="Extensions.LibraryDenialExtensions.LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/>,
/// a duplicate <see cref="ExternalId"/> in a collection makes <c>FirstOrDefaultAsync</c> return
/// an arbitrary matching document, and the read/write guard then evaluates the <i>wrong</i>
/// document's owner and visibility — a correctness bug, not just a performance one. Every
/// sharing-library collection MUST carry:
/// <list type="bullet">
/// <item><c>{ externalId: 1 }</c>, <b>unique</b> — the invariant the lookup depends on.</item>
/// <item><c>{ dateCreated: -1, externalId: 1 }</c> — matches
/// <see cref="Services.LibrarySearchHelper"/>'s sort, so paged search doesn't collection-scan.</item>
/// </list>
/// Create these alongside the other collection index declarations (see
/// <c>MongoIndexInitializer</c>'s per-collection index list) when a library's collection is
/// registered — this repo's index initializer is out of scope for issue #858 itself.
/// </para>
/// <para>
/// <b>Delete semantics: hard delete, not soft delete.</b> This interface has no deleted/archived
/// member, and the fetch behind <c>LoadLibraryEntryForReadOrRespondAsync</c>/
/// <c>LoadLibraryEntryForWriteOrRespondAsync</c> filters on <see cref="ExternalId"/> alone with
/// no status exclusion — unlike this repo's plan-delete precedent
/// (<c>DeleteTrainingPlanEndpoint.cs:62-67</c>), which soft-deletes via a <c>Status = Archived</c>
/// field. A sharing-library delete endpoint must remove the document from its collection (e.g.
/// <c>DeleteOneAsync</c>); flipping a status flag instead would leave the loader and
/// <see cref="Services.LibrarySearchHelper.SearchAsync{TDoc}"/> returning tombstones.
/// </para>
/// </remarks>
public interface ILibraryDocument
{
    /// <summary>The public-facing identifier used in API requests and responses.</summary>
    Guid ExternalId { get; set; }

    /// <summary>The user who owns this entry.</summary>
    Guid OwnerId { get; set; }

    /// <summary>Who can read this entry besides its owner.</summary>
    LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// When this document was created. Used as the primary sort key for library search;
    /// must be set from the injected <c>TimeProvider</c> on a newly created document, never
    /// from <c>DateTime.UtcNow</c>.
    /// </summary>
    DateTime DateCreated { get; set; }

    /// <summary>Optimistic concurrency version. Incremented on each update.</summary>
    int Version { get; set; }
}
