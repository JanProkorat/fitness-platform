namespace FitnessPlatform.Application.Features.SessionTemplates.DeleteSessionTemplate;

/// <summary>
/// Request model for deleting a session template.
/// </summary>
public class DeleteSessionTemplateRequest
{
    /// <summary>
    /// Public identifier of the session template to delete.
    /// </summary>
    public Guid TemplateId { get; set; }
}
