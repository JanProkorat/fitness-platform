using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// Fluent test builder for <see cref="TrainingPlanTemplate"/> Mongo documents (#862).
/// </summary>
public class TrainingPlanTemplateBuilder
{
    private Guid _externalId = Guid.NewGuid();
    private Guid _ownerId = Guid.NewGuid();
    private string _name = "Test Template";
    private string? _description;
    private PrimaryGoal? _goal;
    private ExerciseDifficulty? _difficulty;
    private LibraryVisibility _visibility = LibraryVisibility.Private;
    private int _version = 1;
    private DateTime _dateCreated = DateTime.UtcNow;
    private DateTime? _dateUpdated;
    private List<TrainingTemplateWeek>? _weeks;
    private int _weekCount = 1;

    /// <summary>Sets the public identifier.</summary>
    public TrainingPlanTemplateBuilder WithExternalId(Guid id) { _externalId = id; return this; }

    /// <summary>Sets the owning trainer's id.</summary>
    public TrainingPlanTemplateBuilder WithOwnerId(Guid id) { _ownerId = id; return this; }

    /// <summary>Sets the display name.</summary>
    public TrainingPlanTemplateBuilder WithName(string name) { _name = name; return this; }

    /// <summary>Sets the free-text description.</summary>
    public TrainingPlanTemplateBuilder WithDescription(string? description) { _description = description; return this; }

    /// <summary>Sets the primary fitness goal filter.</summary>
    public TrainingPlanTemplateBuilder WithGoal(PrimaryGoal? goal) { _goal = goal; return this; }

    /// <summary>Sets the difficulty filter.</summary>
    public TrainingPlanTemplateBuilder WithDifficulty(ExerciseDifficulty? difficulty) { _difficulty = difficulty; return this; }

    /// <summary>Sets who besides the owner can read this entry.</summary>
    public TrainingPlanTemplateBuilder WithVisibility(LibraryVisibility visibility) { _visibility = visibility; return this; }

    /// <summary>Sets the optimistic-concurrency version.</summary>
    public TrainingPlanTemplateBuilder WithVersion(int version) { _version = version; return this; }

    /// <summary>Sets the creation timestamp.</summary>
    public TrainingPlanTemplateBuilder WithDateCreated(DateTime dateCreated) { _dateCreated = dateCreated; return this; }

    /// <summary>Sets the last-updated timestamp.</summary>
    public TrainingPlanTemplateBuilder WithDateUpdated(DateTime? dateUpdated) { _dateUpdated = dateUpdated; return this; }

    /// <summary>
    /// Sets the number of empty weeks to materialize when no explicit week tree is supplied via
    /// <see cref="WithWeeks"/> or <see cref="WithSession"/>.
    /// </summary>
    public TrainingPlanTemplateBuilder WithWeekCount(int weekCount) { _weekCount = weekCount; return this; }

    /// <summary>
    /// Supplies a full week tree directly, overriding the default empty-week materialisation.
    /// <see cref="Build"/> sets <c>WeekCount</c> from this list's length.
    /// </summary>
    public TrainingPlanTemplateBuilder WithWeeks(List<TrainingTemplateWeek> weeks) { _weeks = weeks; return this; }

    /// <summary>
    /// Adds a single session (with whatever standalone exercises and workouts the caller
    /// supplies) to week 1, day 1 — convenience for pinning the cloning-ban and id-freshness
    /// tests without hand-building the whole week/day tree.
    /// </summary>
    public TrainingPlanTemplateBuilder WithSession(TrainingSession session)
    {
        _weeks ??=
        [
            new TrainingTemplateWeek
            {
                WeekNumber = 1,
                Days = Enumerable.Range(1, 7).Select(d => new TrainingDay { DayOfWeek = d, Sessions = [] }).ToList()
            }
        ];

        _weeks[0].Days[0].Sessions.Add(session);
        return this;
    }

    /// <summary>
    /// Builds the <see cref="TrainingPlanTemplate"/> instance.
    /// </summary>
    public TrainingPlanTemplate Build()
    {
        var weeks = _weeks ?? Enumerable.Range(1, _weekCount).Select(weekNumber => new TrainingTemplateWeek
        {
            WeekNumber = weekNumber,
            Days = Enumerable.Range(1, 7).Select(d => new TrainingDay { DayOfWeek = d, Sessions = [] }).ToList()
        }).ToList();

        return new TrainingPlanTemplate
        {
            ExternalId = _externalId,
            OwnerId = _ownerId,
            Name = _name,
            Description = _description,
            Goal = _goal,
            Difficulty = _difficulty,
            Weeks = weeks,
            WeekCount = weeks.Count,
            Visibility = _visibility,
            Version = _version,
            DateCreated = _dateCreated,
            DateUpdated = _dateUpdated
        };
    }
}
