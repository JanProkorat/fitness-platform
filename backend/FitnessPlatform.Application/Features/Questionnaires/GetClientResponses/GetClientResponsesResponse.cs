using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Questionnaires.GetClientResponse;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientResponses;

public class GetClientResponsesResponse
{
    public List<ClientResponseItem> Responses { get; set; } = [];
}

public class ClientResponseItem
{
    public Guid ResponsePublicId { get; set; }
    public string QuestionnaireTitle { get; set; } = null!;
    public string Status { get; set; } = null!;
    public DateTime? SubmittedAt { get; set; }
    public DateTime DateCreated { get; set; }

    /// <summary>Plan type the response was sent for; null when it was assigned without one.</summary>
    public LinkCapabilityScope? Scope { get; set; }

    public int AnswerCount { get; set; }
    public List<ResponseAnswerDto> Answers { get; set; } = [];
}
