namespace FitnessPlatform.Application.Features.MealTemplates.GetMealTemplate;

/// <summary>
/// Request model for retrieving a single meal template.
/// </summary>
public class GetMealTemplateRequest
{
    /// <summary>
    /// Public identifier of the meal template.
    /// </summary>
    public Guid TemplateId { get; set; }
}
