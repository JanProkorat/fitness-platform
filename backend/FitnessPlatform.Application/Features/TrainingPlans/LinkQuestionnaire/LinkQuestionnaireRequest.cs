namespace FitnessPlatform.Application.Features.TrainingPlans.LinkQuestionnaire;

/// <summary>
/// Request to link or unlink a questionnaire response to/from a training plan.
/// </summary>
public class LinkQuestionnaireRequest
{
    /// <summary>Plan identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Questionnaire response PublicId to link. Set to null to unlink.
    /// </summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>Optimistic concurrency version.</summary>
    public int Version { get; set; }
}
