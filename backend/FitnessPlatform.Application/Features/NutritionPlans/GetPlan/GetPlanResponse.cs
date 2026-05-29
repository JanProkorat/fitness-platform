using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Per-meal eaten state derived from a <see cref="MealLog"/> document.
/// Lets the web layer render eaten/not-touched indicators and lock editing
/// affordances on meals the client has already confirmed as eaten.
/// </summary>
/// <remarks>
/// Disambiguation rule (derived, never stored):
/// <list type="bullet">
///   <item><description>
///     <b>eaten</b> — <see cref="IsEaten"/> is <c>true</c>, meaning the corresponding
///     <see cref="MealLog.EatenAt"/> was non-null at read time.
///   </description></item>
///   <item><description>
///     <b>not-touched</b> — no <see cref="MealLogDto"/> row exists for the meal,
///     or <see cref="IsEaten"/> is <c>false</c> (photo-only / note-only stub).
///   </description></item>
/// </list>
/// Day-level state (all-eaten vs not-touched) is derived client-side by
/// inspecting every meal in the day — no separate aggregate field is stored here.
/// </remarks>
public class MealLogDto
{
    /// <summary>
    /// The <see cref="PlanMeal.MealId"/> this log belongs to.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// The calendar date (UTC) this log entry belongs to, as a date-only value.
    /// Matches <see cref="MealLog.LogDate"/> truncated to day precision.
    /// </summary>
    public DateOnly LogDate { get; set; }

    /// <summary>
    /// Whether the meal has been confirmed as eaten by the client.
    /// <c>true</c> iff <see cref="MealLog.EatenAt"/> was non-null in the document.
    /// A log with <c>EatenAt == null</c> is a photo-only or note-only stub —
    /// it is NOT considered eaten.
    /// </summary>
    public bool IsEaten { get; set; }

    /// <summary>
    /// When the meal was eaten, if eaten. Null for photo-only / note-only stubs.
    /// </summary>
    public DateTime? EatenAt { get; set; }
}

/// <summary>
/// Detailed nutrition plan response including all weeks, days, meals, and foods.
/// </summary>
public class GetPlanResponse
{
    /// <summary>
    /// Plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Client's public user identifier.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Nutritionist's public user identifier.
    /// </summary>
    public Guid NutritionistId { get; set; }

    /// <summary>
    /// Display name of the plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Current plan status as string (Draft, Active, Archived).
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// All weeks in the plan with their days, meals, and foods.
    /// </summary>
    public List<PlanWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Optimistic concurrency version.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// When the plan was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When the plan was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// The Monday when Week 1 begins, if set.
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// When this plan was marked as completed, if applicable.
    /// </summary>
    public DateTime? DateCompleted { get; set; }

    /// <summary>
    /// Linked questionnaire response (cross-DB reference to PostgreSQL QuestionnaireResponse.PublicId).
    /// Null if no questionnaire is linked to this plan.
    /// </summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>
    /// Per-meal eaten state for all <see cref="MealLog"/> documents associated with this plan.
    /// One entry per (MealId, LogDate) pair that has a log record; meals without a log entry
    /// are absent (equivalent to not-touched / no badge).
    /// Populated by the endpoint after loading the plan. Ownership is guaranteed by the
    /// plan ownership gate above the MealLog query — filtering by PlanId is safe.
    /// </summary>
    public List<MealLogDto> MealLogs { get; set; } = [];

    /// <summary>
    /// Maps a <see cref="NutritionPlan"/> document to a detailed response DTO.
    /// </summary>
    /// <param name="plan">The nutrition plan document.</param>
    /// <returns>A detailed response DTO.</returns>
    public static GetPlanResponse FromDocument(NutritionPlan plan) => new()
    {
        PlanId = plan.ExternalId,
        ClientId = plan.ClientId,
        NutritionistId = plan.NutritionistId,
        Name = plan.Name,
        Status = plan.Status.ToString(),
        GlobalSettings = plan.GlobalSettings,
        Weeks = plan.Weeks,
        Version = plan.Version,
        DateCreated = plan.DateCreated,
        DateUpdated = plan.DateUpdated,
        StartDate = plan.StartDate,
        DateCompleted = plan.DateCompleted,
        QuestionnaireResponseId = plan.QuestionnaireResponseId
    };
}
