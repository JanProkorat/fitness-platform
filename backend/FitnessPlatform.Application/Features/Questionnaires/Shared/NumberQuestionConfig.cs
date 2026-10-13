namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// Config shape for number questions. Parsed for validation only; unknown keys such as step are ignored.
/// </summary>
public class NumberQuestionConfig
{
    /// <summary>Lowest accepted value.</summary>
    public decimal? Min { get; set; }

    /// <summary>Highest accepted value.</summary>
    public decimal? Max { get; set; }

    /// <summary>Unit label shown next to the input.</summary>
    public string? Unit { get; set; }
}
