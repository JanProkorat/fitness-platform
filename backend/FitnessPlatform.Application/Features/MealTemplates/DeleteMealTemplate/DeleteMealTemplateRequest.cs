namespace FitnessPlatform.Application.Features.MealTemplates.DeleteMealTemplate;

/// <summary>
/// Request model for deleting a meal template.
/// </summary>
public class DeleteMealTemplateRequest
{
    /// <summary>
    /// Public identifier of the meal template to delete.
    /// </summary>
    public Guid TemplateId { get; set; }
}
