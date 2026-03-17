namespace FitnessPlatform.Application.Features.Foods.GetCustomFoods;

/// <summary>
/// Request model for retrieving a nutritionist's custom foods.
/// </summary>
public class GetCustomFoodsRequest
{
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
