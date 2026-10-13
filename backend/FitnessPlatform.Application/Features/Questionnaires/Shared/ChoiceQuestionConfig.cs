namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// Config shape for single_choice and multi_select questions. Parsed for validation only.
/// </summary>
public class ChoiceQuestionConfig
{
    /// <summary>The selectable options.</summary>
    public List<string?>? Options { get; set; }

    /// <summary>Whether the client may type an "Other" answer. Optional.</summary>
    public bool? AllowOther { get; set; }
}
