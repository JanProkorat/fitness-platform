using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.Shared;

/// <summary>
/// Response DTO for a single section template.
/// </summary>
public class WorkoutTemplateResponse
{
    /// <summary>Template's public identifier.</summary>
    public Guid TemplateId { get; set; }

    /// <summary>Display name of the template.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional coach notes describing the workout as a whole.</summary>
    public string? Notes { get; set; }

    /// <summary>Default workout format. Null means no format override.</summary>
    public string? DefaultFormat { get; set; }

    /// <summary>Default format configuration.</summary>
    public WodConfig? DefaultFormatConfig { get; set; }

    /// <summary>Default exercises pre-populated when applying this template.</summary>
    public List<SessionExercise> DefaultExercises { get; set; } = [];

    /// <summary>Optimistic concurrency version.</summary>
    public int Version { get; set; }

    /// <summary>When this template was created.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>When this template was last updated.</summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>Maps a <see cref="WorkoutTemplate"/> document to the response DTO.</summary>
    public static WorkoutTemplateResponse FromDocument(WorkoutTemplate t) => new()
    {
        TemplateId = t.ExternalId,
        Name = t.Name,
        Notes = t.Notes,
        DefaultFormat = t.DefaultFormat?.ToString(),
        DefaultFormatConfig = t.DefaultFormatConfig,
        DefaultExercises = t.DefaultExercises,
        Version = t.Version,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };
}
