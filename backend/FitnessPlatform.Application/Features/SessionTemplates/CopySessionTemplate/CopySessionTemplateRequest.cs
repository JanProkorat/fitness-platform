namespace FitnessPlatform.Application.Features.SessionTemplates.CopySessionTemplate;

/// <summary>
/// Request model for copying a readable session template to the caller's own library.
/// </summary>
public class CopySessionTemplateRequest
{
    /// <summary>
    /// Public identifier of the source session template to copy.
    /// </summary>
    public Guid TemplateId { get; set; }
}
