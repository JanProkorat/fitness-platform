namespace FitnessPlatform.Application.Features.Trainers.GetClientTimeline;

/// <summary>
/// A single event in a client's activity timeline.
/// </summary>
public class ClientTimelineItem
{
    /// <summary>
    /// Stable unique identifier for this timeline entry.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Event kind — used on the client to pick icon/colour.
    /// One of: meal_day, workout, measurement, questionnaire,
    /// nutrition_plan_published, training_plan_published, linked,
    /// personal_record.
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// When this event occurred (UTC).
    /// </summary>
    public DateTime OccurredAt { get; set; }

    /// <summary>
    /// Short, human-readable title (e.g. "Splnil jídelníček").
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Optional secondary text (e.g. "5 z 5 jídel zaznamenáno").
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional emoji/icon hint for the client.
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Structured payload for <c>personal_record</c> items.
    /// Null for all other event types.
    /// Exposed as typed fields so the web/mobile i18n layer can compose
    /// locale-specific copy without depending on server-side strings.
    /// </summary>
    public PersonalRecordPayload? PersonalRecord { get; set; }

    /// <summary>Structured payload for <c>meal_day</c> items. Null for all other types.</summary>
    public TimelineMealDayPayload? MealDay { get; set; }

    /// <summary>Structured payload for <c>workout</c> items. Null for all other types.</summary>
    public TimelineWorkoutPayload? Workout { get; set; }

    /// <summary>Structured payload for <c>measurement</c> items. Null for all other types.</summary>
    public TimelineMeasurementPayload? Measurement { get; set; }

    /// <summary>Structured payload for <c>questionnaire</c> items. Null for all other types.</summary>
    public TimelineQuestionnairePayload? Questionnaire { get; set; }

    /// <summary>
    /// Structured payload for <c>nutrition_plan_published</c> and <c>training_plan_published</c>
    /// items. Null for all other types.
    /// </summary>
    public TimelinePlanPublishedPayload? PlanPublished { get; set; }
}

/// <summary>
/// Structured payload embedded in a <c>meal_day</c> timeline item.
/// </summary>
public class TimelineMealDayPayload
{
    /// <summary>Number of distinct planned meals logged that day.</summary>
    public int MealsLogged { get; set; }

    /// <summary>
    /// Planned meals for that day. Null when the day's plan was not authored by the caller
    /// or the day has no planned meals.
    /// </summary>
    public int? MealsPlanned { get; set; }
}

/// <summary>
/// Structured payload embedded in a <c>workout</c> timeline item.
/// </summary>
public class TimelineWorkoutPayload
{
    /// <summary>Public identifier of the session execution.</summary>
    public Guid SessionExecutionId { get; set; }

    /// <summary>
    /// Name of the planned session. Null for ad-hoc workouts and for plans the caller did not author.
    /// </summary>
    public string? SessionName { get; set; }

    /// <summary>Number of exercises recorded in the workout.</summary>
    public int ExerciseCount { get; set; }
}

/// <summary>
/// Structured payload embedded in a <c>measurement</c> timeline item.
/// </summary>
public class TimelineMeasurementPayload
{
    /// <summary>Body weight in kilograms, when recorded.</summary>
    public decimal? WeightKg { get; set; }

    /// <summary>Body fat percentage, when recorded.</summary>
    public decimal? BodyFatPercentage { get; set; }
}

/// <summary>
/// Structured payload embedded in a <c>questionnaire</c> timeline item.
/// </summary>
public class TimelineQuestionnairePayload
{
    /// <summary>Title of the submitted questionnaire.</summary>
    public string QuestionnaireTitle { get; set; } = string.Empty;
}

/// <summary>
/// Structured payload embedded in a plan-published timeline item (one item per published week).
/// </summary>
public class TimelinePlanPublishedPayload
{
    /// <summary>Public identifier of the plan.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Plan name, when set.</summary>
    public string? PlanName { get; set; }

    /// <summary>Number of the week that was published.</summary>
    public int WeekNumber { get; set; }
}

/// <summary>
/// Structured payload embedded in a <c>personal_record</c> timeline item.
/// </summary>
public class PersonalRecordPayload
{
    /// <summary>Public-facing identifier of the personal record document.</summary>
    public Guid ExternalId { get; set; }

    /// <summary>ExternalId of the exercise for which the PR was achieved.</summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>Snapshot of the exercise name at the time the PR was set.</summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>Weight lifted in kilograms.</summary>
    public decimal WeightKg { get; set; }

    /// <summary>Repetitions completed in the PR set.</summary>
    public int Reps { get; set; }

    /// <summary>ExternalId of the workout log that contains this PR set.</summary>
    public Guid WorkoutLogId { get; set; }
}

/// <summary>
/// Response returning a client's activity timeline, ordered newest first.
/// </summary>
public class GetClientTimelineResponse
{
    /// <summary>
    /// Timeline items, ordered by <see cref="ClientTimelineItem.OccurredAt"/> descending.
    /// </summary>
    public List<ClientTimelineItem> Items { get; set; } = [];

    /// <summary>
    /// Whether the caller's link permits viewing the client's nutrition-domain timeline
    /// entries. Mirrors <c>ClientProfessionalLink.CanViewNutritionPlans</c>.
    /// </summary>
    public bool CanViewNutritionPlans { get; set; }

    /// <summary>
    /// Whether the caller's link permits viewing the client's training-domain timeline
    /// entries. Mirrors <c>ClientProfessionalLink.CanViewTrainingPlans</c>.
    /// </summary>
    public bool CanViewTrainingPlans { get; set; }
}
