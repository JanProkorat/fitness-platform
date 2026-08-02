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
/// <see cref="ExternalId"/> and <see cref="DateCreated"/> are on the interface deliberately:
/// <see cref="Services.LibrarySearchHelper"/> sorts on <see cref="DateCreated"/> descending
/// with <see cref="ExternalId"/> ascending as a tiebreaker, and a generic constraint cannot
/// sort on members the interface does not declare. This interface intentionally does not
/// extend to any other document — every other document in the codebase uses
/// <c>NutritionistId</c> / <c>TrainerId</c> / <c>OwnerTrainerId</c> instead of a uniform
/// <see cref="OwnerId"/>, and retrofitting those is out of scope here (issue #766).
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
