using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.ListWorkoutTemplates;

/// <summary>
/// Response DTO for a single public workout template — surfaced in the trainer's
/// workout-templates "template library" alongside their own <see cref="Shared.WorkoutTemplateResponse"/> list.
/// Embeds full workouts -> exercises -> sets so the web client can render a complete
/// detail view without a second call (only ~10 seeded templates; payload size is acceptable).
/// </summary>
public class PublicSessionTemplateResponse
{
    /// <summary>Template's public identifier.</summary>
    public Guid ExternalId { get; set; }

    /// <summary>Display name of the template.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Localized template names (en, cs, de), when available.</summary>
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>Optional description of the template.</summary>
    public string? Description { get; set; }

    /// <summary>Difficulty level of the template.</summary>
    public string Difficulty { get; set; } = string.Empty;

    /// <summary>Estimated total duration of the session in minutes.</summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>Session-level workout format / scoring methodology.</summary>
    public string Format { get; set; } = string.Empty;

    /// <summary>Format configuration for the session. Null when Format is Standard.</summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>Ordered workouts making up the template, each with its exercises and set prescriptions.</summary>
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>Maps a <see cref="SessionTemplate"/> document to the response DTO.</summary>
    public static PublicSessionTemplateResponse FromDocument(SessionTemplate t) => new()
    {
        ExternalId = t.ExternalId,
        Name = t.Name,
        LocalizedNames = t.LocalizedNames,
        Description = t.Description,
        Difficulty = t.Difficulty.ToString(),
        EstimatedDurationMinutes = t.EstimatedDurationMinutes,
        Format = t.Format.ToString(),
        FormatConfig = t.FormatConfig,
        Workouts = t.Workouts
    };
}
