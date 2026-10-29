namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// Config shape for scale questions. Parsed for answer validation only; missing bounds default to 1-10.
/// </summary>
public class ScaleQuestionConfig
{
    /// <summary>Lowest accepted value.</summary>
    public decimal? Min { get; set; }

    /// <summary>Highest accepted value.</summary>
    public decimal? Max { get; set; }
}
