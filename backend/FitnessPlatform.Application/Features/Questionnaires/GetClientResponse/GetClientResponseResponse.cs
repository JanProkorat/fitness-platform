namespace FitnessPlatform.Application.Features.Questionnaires.GetClientResponse;

public class GetClientResponseResponse
{
    public Guid ResponsePublicId { get; set; }
    public string QuestionnaireTitle { get; set; } = null!;
    public DateTime? SubmittedAt { get; set; }
    public int AnswerCount { get; set; }
    public List<ResponseAnswerDto> Answers { get; set; } = [];
}

public class ResponseAnswerDto
{
    public Guid QuestionPublicId { get; set; }
    public string QuestionLabel { get; set; } = null!;
    public string QuestionType { get; set; } = null!;
    public string? MappedField { get; set; }
    public string? ValueText { get; set; }
    public decimal? ValueNumber { get; set; }
    public string? ValueJson { get; set; }
    public string? FileUrl { get; set; }

    /// <summary>
    /// Label of the questionnaire section (a Type="section" question) this
    /// answer's question falls under, or null if it appears before the first
    /// section header. Computed server-side via
    /// <see cref="Dtos.QuestionSectionResolver"/> — additive field, #713.
    /// </summary>
    public string? SectionLabel { get; set; }

    /// <summary>
    /// 0-based order of <see cref="SectionLabel"/> relative to the other
    /// sections in the questionnaire, or null when <see cref="SectionLabel"/>
    /// is null. Additive field, #713.
    /// </summary>
    public int? SectionOrder { get; set; }
}
