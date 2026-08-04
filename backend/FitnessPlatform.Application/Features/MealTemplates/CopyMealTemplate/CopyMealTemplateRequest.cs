namespace FitnessPlatform.Application.Features.MealTemplates.CopyMealTemplate;

/// <summary>
/// Request model for copying a readable meal template to the caller's own library.
/// </summary>
public class CopyMealTemplateRequest
{
    /// <summary>
    /// Public identifier of the source meal template to copy.
    /// </summary>
    public Guid TemplateId { get; set; }
}
