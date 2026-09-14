namespace FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;

/// <summary>
/// Request model for retrieving a single session template.
/// </summary>
public class GetSessionTemplateRequest
{
    /// <summary>
    /// Public identifier of the session template.
    /// </summary>
    public Guid TemplateId { get; set; }
}
