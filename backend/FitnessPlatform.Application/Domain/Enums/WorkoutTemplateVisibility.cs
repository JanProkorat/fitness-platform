namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Controls who can see a workout template. Mirrors <see cref="RecipeVisibility"/>.
/// </summary>
public enum WorkoutTemplateVisibility
{
    /// <summary>
    /// Visible to all trainers.
    /// </summary>
    Public = 0,

    /// <summary>
    /// Only the owning trainer can see the template.
    /// </summary>
    Private = 1
}
