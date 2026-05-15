namespace FitnessPlatform.Application.Features.SectionTemplates.DeleteSectionTemplate;

/// <summary>
/// Request for deleting a section template.
/// </summary>
public class DeleteSectionTemplateRequest
{
    /// <summary>The template's public identifier (route parameter).</summary>
    public Guid TemplateId { get; set; }
}
