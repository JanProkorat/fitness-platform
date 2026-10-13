using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;

/// <summary>
/// Optional filters for listing the caller's questionnaires.
/// </summary>
public class GetTrainerQuestionnairesRequest
{
    /// <summary>Only forms of this type.</summary>
    public QuestionnaireType? Type { get; set; }

    /// <summary>Case-insensitive substring match on the title.</summary>
    public string? Search { get; set; }
}
