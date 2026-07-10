using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Features.Questionnaires.Dtos;

/// <summary>
/// Resolves which questionnaire section (a Type="section" question — a
/// display-only header that produces no answer row) each answerable question
/// falls under. Shared by <c>GetClientResponseEndpoint</c> and
/// <c>GetClientResponsesEndpoint</c> so trainer/nutritionist-facing response
/// reads can group a client's flat answer list under the same section headers
/// the questionnaire builder shows (#713 — unblocks the section grouping
/// deferred from #697/#698).
/// </summary>
public static class QuestionSectionResolver
{
    /// <summary>
    /// The question type used for a non-answerable section header. Matches the
    /// literal already used by <c>GetClientResponseByIdEndpoint</c> /
    /// <c>GetClientSubmittedResponse(s)Endpoint</c> (<c>a.Question.Type != "section"</c>).
    /// </summary>
    private const string SectionQuestionType = "section";

    /// <summary>
    /// Walks <paramref name="questions"/> in <see cref="QuestionnaireQuestion.OrderIndex"/>
    /// order, building a QuestionId → (SectionLabel, SectionOrder) lookup. A section
    /// header sets the section context for every subsequent question until the next
    /// section header; questions appearing before the first section header resolve to
    /// <c>(null, null)</c>. Section headers themselves are never added to the lookup —
    /// they produce no answer row, so there is nothing to key them by.
    /// </summary>
    /// <param name="questions">All questions belonging to the questionnaire (including section headers).</param>
    /// <returns>A lookup keyed by the question's long primary key (<c>QuestionnaireQuestion.Id</c>).</returns>
    public static Dictionary<long, (string? SectionLabel, int? SectionOrder)> Resolve(
        IEnumerable<QuestionnaireQuestion> questions)
    {
        var map = new Dictionary<long, (string?, int?)>();
        string? currentLabel = null;
        int? currentOrder = null;
        var nextSectionOrder = 0;

        foreach (var question in questions.OrderBy(q => q.OrderIndex))
        {
            if (question.Type == SectionQuestionType)
            {
                currentLabel = question.Label;
                currentOrder = nextSectionOrder++;
                continue;
            }

            map[question.Id] = (currentLabel, currentOrder);
        }

        return map;
    }
}
