using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// The rule for which questions the client answers in the app. Kept as an expression so EF can
/// translate it into SQL.
/// </summary>
public static class ClientAnswerableQuestion
{
    /// <summary>Not hidden, not a section heading, and not a file upload.</summary>
    public static readonly Expression<Func<QuestionnaireQuestion, bool>> Predicate = question =>
        !question.IsHidden
        && question.Type != QuestionTypes.Section
        // File answers cannot be uploaded yet, so they are not counted or enforced; #1850 removes this.
        && question.Type != QuestionTypes.FileUpload;
}
