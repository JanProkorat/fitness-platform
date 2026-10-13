namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// Config shape for smiley_rating questions (five faces with a low and a high label).
/// </summary>
public class SmileyRatingQuestionConfig
{
    /// <summary>Label for the lowest face.</summary>
    public string? LowLabel { get; set; }

    /// <summary>Label for the highest face.</summary>
    public string? HighLabel { get; set; }
}
