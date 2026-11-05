using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// A supplement entry in a nutrition plan response DTO.
/// </summary>
public class SupplementDto
{
    /// <summary>Stable public identifier for the supplement.</summary>
    public Guid ExternalId { get; set; }

    /// <summary>Name of the supplement.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional dosage instruction.</summary>
    public string? Dose { get; set; }

    /// <summary>Optional additional notes.</summary>
    public string? Notes { get; set; }
}

/// <summary>
/// Per-meal eaten state derived from the <see cref="MealLog"/> rows of one meal on one day.
/// Lets the web layer render eaten/partly eaten/not-touched indicators.
/// </summary>
/// <remarks>
/// Derived from the live plan meal's current items, never stored:
/// <list type="bullet">
///   <item><description>
///     <b>eaten</b> — <see cref="EatenState"/> is <c>Eaten</c>: every current item is eaten
///     (<see cref="IsEaten"/> is <c>true</c>).
///   </description></item>
///   <item><description>
///     <b>partly eaten</b> — <see cref="EatenState"/> is <c>PartlyEaten</c>: some, not all, current items.
///   </description></item>
///   <item><description>
///     <b>not-touched</b> — no <see cref="MealEatenStatusDto"/> row exists for the meal,
///     or <see cref="EatenState"/> is <c>NotEaten</c> (photo-only / note-only stub).
///   </description></item>
/// </list>
/// Day-level state is derived client-side by inspecting every meal in the day.
/// </remarks>
public class MealEatenStatusDto
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
    /// Whether the meal is fully eaten: <c>true</c> iff <see cref="EatenState"/> is <c>Eaten</c>.
    /// A partly eaten meal is <c>false</c>; read <see cref="EatenState"/> to tell it from not eaten.
    /// </summary>
    public bool IsEaten { get; set; }

    /// <summary>
    /// Derived eaten state of the meal: NotEaten, PartlyEaten or Eaten.
    /// </summary>
    public MealEatenState EatenState { get; set; }

    /// <summary>
    /// Ids of the meal's current items (foods and recipes) that are eaten. Items the coach
    /// has since removed are not listed.
    /// </summary>
    public List<Guid> EatenItemIds { get; set; } = [];

    /// <summary>
    /// When the meal was eaten. Set only when <see cref="EatenState"/> is <c>Eaten</c>.
    /// </summary>
    public DateTime? EatenAt { get; set; }
}

/// <summary>
/// One item whose eaten version differs from the coach's current meal.
/// </summary>
public class MealItemConflictTagDto
{
    /// <summary>The plan item id the tag belongs to.</summary>
    public Guid ItemId { get; set; }

    /// <summary>How the item differs: changed, added by the coach, or removed by the coach.</summary>
    public MealItemConflictTag Tag { get; set; }
}

/// <summary>
/// The offline-sync conflict behind a locked meal: the client ate one version of the meal while the
/// coach's plan moved on to another.
/// </summary>
public class MealLockConflictDto
{
    /// <summary>Public id of the conflict; the id the review endpoints take.</summary>
    public Guid ConflictId { get; set; }

    /// <summary>Why the client's action collided with the plan.</summary>
    public OfflineSyncConflictKind Kind { get; set; }

    /// <summary>The plan version the client ate (the one it saw offline).</summary>
    public int BasedOnPlanVersion { get; set; }

    /// <summary>The coach's current plan version.</summary>
    public int CurrentPlanVersion { get; set; }

    /// <summary>Whether a coach has marked the conflict reviewed.</summary>
    public bool Reviewed { get; set; }

    /// <summary>
    /// Per-item differences between the eaten snapshot and the coach's meal, computed on the server.
    /// Empty when the client sent no seen items.
    /// </summary>
    public List<MealItemConflictTagDto> ItemTags { get; set; } = [];
}

/// <summary>
/// Whether the coach may edit one stored plan meal, and why not.
/// </summary>
public class MealLockDto
{
    /// <summary>The <see cref="PlanMeal.MealId"/> this verdict belongs to.</summary>
    public Guid MealId { get; set; }

    /// <summary>Week the meal sits in.</summary>
    public int WeekNumber { get; set; }

    /// <summary>Day of the week the meal sits in (1 = Monday).</summary>
    public int DayOfWeek { get; set; }

    /// <summary>Calendar date of the slot; null when the plan has no start date.</summary>
    public DateOnly? Date { get; set; }

    /// <summary>Whether the meal may not be changed, moved or deleted.</summary>
    public bool IsLocked { get; set; }

    /// <summary>Why the meal is locked, or Open.</summary>
    public MealLockState LockState { get; set; }

    /// <summary>Ids of the meal's items the client ate.</summary>
    public List<Guid> EatenItemIds { get; set; } = [];

    /// <summary>Items as they stood when first eaten. Set only for a locked meal that has a snapshot.</summary>
    public List<EatenMealItem>? EatenSnapshot { get; set; }

    /// <summary>
    /// True for a meal the client ate that the coach has since removed from the plan. It is not in
    /// <c>Weeks</c>; it is placed by <see cref="WeekNumber"/>, <see cref="DayOfWeek"/> and <see cref="MealKind"/>.
    /// </summary>
    public bool IsRemovedFromPlan { get; set; }

    /// <summary>Kind of the meal; for a removed meal, the kind stored when it was logged.</summary>
    public MealKind MealKind { get; set; }

    /// <summary>The offline-sync conflict behind this meal; null when it was not eaten offline against a changed plan.</summary>
    public MealLockConflictDto? Conflict { get; set; }
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
    /// The client's <c>ClientProfile.PublicId</c> — the client-facing identifier consumed by
    /// web/mobile to build routes like <c>/trainer/clients/{clientId}/...</c>. NOT the
    /// internal Mongo storage key (<c>ApplicationUser.Id</c> since #840) — see
    /// <see cref="FromDocument"/>.
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
    /// Id of the template this plan was created from. Null when not made from a template.
    /// </summary>
    public Guid? SourceTemplateId { get; set; }

    /// <summary>
    /// Per-meal eaten state for all <see cref="MealLog"/> documents associated with this plan.
    /// One entry per (MealId, LogDate) pair that has a log record; meals without a log entry
    /// are absent (equivalent to not-touched / no badge).
    /// Populated by the endpoint after loading the plan. Ownership is guaranteed by the
    /// plan ownership gate above the MealLog query — filtering by PlanId is safe.
    /// </summary>
    public List<MealEatenStatusDto> MealLogs { get; set; } = [];

    /// <summary>
    /// The client's local calendar date today, the cut-off after which a day is locked.
    /// Populated by the get endpoint only.
    /// </summary>
    public DateOnly ClientToday { get; set; }

    /// <summary>
    /// One lock verdict per stored meal. Populated by the get endpoint only.
    /// </summary>
    public List<MealLockDto> MealLocks { get; set; } = [];

    /// <summary>
    /// Supplement recommendations attached to this plan.
    /// </summary>
    public List<SupplementDto> Supplements { get; set; } = [];

    /// <summary>
    /// Maps a <see cref="NutritionPlan"/> document to a detailed response DTO.
    /// </summary>
    /// <param name="plan">The nutrition plan document.</param>
    /// <param name="clientPublicId">
    /// The client's <c>ClientProfile.PublicId</c> to expose as <see cref="ClientId"/> —
    /// NOT <paramref name="plan"/>.ClientId directly, which is the internal
    /// <c>ApplicationUser.Id</c> storage key since #840. Callers resolve this via
    /// <see cref="FormUp.Application.Domain.Extensions.ClientProfileLookupExtensions.ResolveClientPublicIdAsync"/>
    /// (or the batch variant for list endpoints) before calling this factory.
    /// </param>
    /// <returns>A detailed response DTO.</returns>
    public static GetPlanResponse FromDocument(NutritionPlan plan, Guid clientPublicId) => new()
    {
        PlanId = plan.ExternalId,
        ClientId = clientPublicId,
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
        QuestionnaireResponseId = plan.QuestionnaireResponseId,
        SourceTemplateId = plan.SourceTemplateId,
        Supplements = plan.Supplements.Select(s => new SupplementDto
        {
            ExternalId = s.ExternalId,
            Name = s.Name,
            Dose = s.Dose,
            Notes = s.Notes
        }).ToList()
    };
}
