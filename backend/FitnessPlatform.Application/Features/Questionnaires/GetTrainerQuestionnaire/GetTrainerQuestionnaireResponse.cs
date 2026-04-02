using FitnessPlatform.Application.Features.Questionnaires.Dtos;

namespace FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;

public class GetTrainerQuestionnaireResponse
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public List<QuestionDto> Questions { get; set; } = [];
}
