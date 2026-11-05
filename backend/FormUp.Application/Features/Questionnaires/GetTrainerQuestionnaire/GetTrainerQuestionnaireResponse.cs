using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.Questionnaires.Dtos;

namespace FormUp.Application.Features.Questionnaires.GetTrainerQuestionnaire;

public class GetTrainerQuestionnaireResponse
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public QuestionnaireType Type { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public List<QuestionDto> Questions { get; set; } = [];
}
