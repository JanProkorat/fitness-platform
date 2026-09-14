using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single week within a <see cref="TrainingPlanTemplate"/>. Slim compared to
/// <see cref="TrainingWeek"/> — no <c>Status</c> or <c>DatePublished</c>, both meaningless
/// outside a client plan. Everything below the week — <see cref="TrainingDay"/>,
/// <see cref="TrainingSession"/>, <see cref="TrainingWorkout"/>, <see cref="SessionExercise"/>,
/// <see cref="ExerciseSet"/> — is reused unchanged from the client-plan shape, so copying either
/// direction (template ↔ plan) is a straight clone of the same types.
/// </summary>
public class TrainingTemplateWeek
{
    /// <summary>
    /// Week number within the template (1-based).
    /// </summary>
    [BsonElement("weekNumber")]
    public int WeekNumber { get; set; }

    /// <summary>
    /// Days in this week. Always 7 entries (Monday through Sunday) — see
    /// <see cref="TrainingDay"/>.
    /// </summary>
    [BsonElement("days")]
    public List<TrainingDay> Days { get; set; } = [];
}
