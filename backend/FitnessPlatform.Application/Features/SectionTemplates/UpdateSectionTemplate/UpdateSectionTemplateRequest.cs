using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SectionTemplates.CreateSectionTemplate;

namespace FitnessPlatform.Application.Features.SectionTemplates.UpdateSectionTemplate;

/// <summary>
/// Request for updating an existing section template.
/// </summary>
public class UpdateSectionTemplateRequest
{
    /// <summary>The template's public identifier (route parameter).</summary>
    public Guid TemplateId { get; set; }

    /// <summary>Updated display name of the template.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Updated default workout format. Null means no format override.</summary>
    public WorkoutFormat? DefaultFormat { get; set; }

    /// <summary>Updated default format configuration.</summary>
    public WodConfig? DefaultFormatConfig { get; set; }

    /// <summary>Updated default exercises.</summary>
    public List<CreateSectionTemplateExerciseRequest> DefaultExercises { get; set; } = [];

    /// <summary>Expected version for optimistic concurrency control.</summary>
    public int Version { get; set; }
}
