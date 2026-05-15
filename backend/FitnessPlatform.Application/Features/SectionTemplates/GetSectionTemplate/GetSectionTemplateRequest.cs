namespace FitnessPlatform.Application.Features.SectionTemplates.GetSectionTemplate;

/// <summary>
/// Request for retrieving a single section template by its public identifier.
/// </summary>
public class GetSectionTemplateRequest
{
    /// <summary>The template's public identifier (route parameter).</summary>
    public Guid TemplateId { get; set; }
}
