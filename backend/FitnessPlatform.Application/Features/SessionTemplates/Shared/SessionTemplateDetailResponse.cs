using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SessionTemplates.Shared;

/// <summary>
/// Full session template detail returned by get, create, update, copy, and from-plan endpoints.
/// </summary>
public class SessionTemplateDetailResponse
{
    /// <summary>
    /// Public identifier of the session template.
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Display name of the template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Localized template names (en, cs, de), when available.
    /// </summary>
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>
    /// Optional description of the template.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Difficulty level of the template.
    /// </summary>
    public ExerciseDifficulty Difficulty { get; set; }

    /// <summary>
    /// Estimated total duration of the session in minutes.
    /// </summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Session-level workout format / scoring methodology.
    /// </summary>
    public WorkoutFormat Format { get; set; }

    /// <summary>
    /// Format configuration for the session. Null when Format is Standard.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Ordered workouts making up the template — the same <see cref="TrainingWorkout"/> shape
    /// used inside a training plan session, so this response maps write-side to
    /// <c>UpdateSessionRequest.Workouts</c> verbatim.
    /// </summary>
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Standalone exercises directly on this template (not grouped under any workout) — the
    /// same <see cref="SessionExercise"/> shape used inside a training plan session, so this
    /// response maps write-side to <c>UpdateSessionRequest.StandaloneExercises</c> verbatim.
    /// </summary>
    public List<SessionExercise> StandaloneExercises { get; set; } = [];

    /// <summary>
    /// Flat, read-only view of every exercise in this template — <see cref="StandaloneExercises"/>
    /// plus every workout's nested exercises. Never send this back on a write: it has no
    /// corresponding member on the write-side session request, and sending it as standalone would
    /// persist every nested workout exercise a second time, compounding on each save.
    /// </summary>
    public IReadOnlyList<SessionExercise> AllExercises { get; set; } = [];

    /// <summary>
    /// Who can read this template besides its owner.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// True when the authenticated caller is the trainer who owns this template.
    /// </summary>
    public bool IsOwnedByCurrentUser { get; set; }

    /// <summary>
    /// When the template was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When the template was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Optimistic concurrency version, required on <c>PUT</c> requests.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// Maps a <see cref="SessionTemplate"/> document to a <see cref="SessionTemplateDetailResponse"/>.
    /// </summary>
    /// <param name="template">The source session template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    /// <returns>A full detail response.</returns>
    public static SessionTemplateDetailResponse FromDocument(SessionTemplate template, Guid currentUserId) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        LocalizedNames = template.LocalizedNames,
        Description = template.Description,
        Difficulty = template.Difficulty,
        EstimatedDurationMinutes = template.EstimatedDurationMinutes,
        Format = template.Format,
        FormatConfig = template.FormatConfig,
        Workouts = template.Workouts,
        StandaloneExercises = template.StandaloneExercises,
        AllExercises = template.AllExercises,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated,
        Version = template.Version
    };
}
