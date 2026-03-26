using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Validates <see cref="UpdateTrainingPlanRequest"/> including all nested weeks, sessions, exercises, and sets.
/// </summary>
public class UpdateTrainingPlanValidator : Validator<UpdateTrainingPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for a full-state training plan update.
    /// </summary>
    public UpdateTrainingPlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.Description)
            .MaximumLength(2000)
            .When(x => x.Description is not null);

        RuleFor(x => x.Weeks)
            .NotEmpty().WithMessage("At least one week is required.")
            .Must(weeks => weeks.Count <= 52).WithMessage("A plan may not exceed 52 weeks.")
            .Must(weeks => weeks.Select(w => w.WeekNumber).Distinct().Count() == weeks.Count)
                .WithMessage("Duplicate WeekNumber values are not allowed.");

        RuleForEach(x => x.Weeks).ChildRules(week =>
        {
            week.RuleFor(w => w.WeekNumber)
                .GreaterThanOrEqualTo(1).WithMessage("WeekNumber must be >= 1.");

            week.RuleFor(w => w.Sessions)
                .Must(sessions => sessions.Count <= 14).WithMessage("A week may not have more than 14 sessions.");

            week.RuleFor(w => w.Sessions)
                .Must(sessions =>
                {
                    var withId = sessions.Where(s => s.SessionId.HasValue).Select(s => s.SessionId!.Value).ToList();
                    return withId.Distinct().Count() == withId.Count;
                }).WithMessage("Duplicate SessionId values are not allowed within a week.");

            week.RuleForEach(w => w.Sessions).ChildRules(session =>
            {
                session.RuleFor(s => s.DayOfWeek)
                    .InclusiveBetween(1, 7).WithMessage("DayOfWeek must be between 1 and 7.");

                session.RuleFor(s => s.Name)
                    .NotEmpty()
                    .MaximumLength(200);

                session.RuleFor(s => s.Order)
                    .GreaterThanOrEqualTo(1).WithMessage("Session Order must be >= 1.");

                session.RuleFor(s => s.Exercises)
                    .Must(exercises => exercises.Count <= 30).WithMessage("A session may not have more than 30 exercises.");

                session.RuleForEach(s => s.Exercises).ChildRules(exercise =>
                {
                    exercise.RuleFor(e => e.ExerciseExternalId)
                        .NotEmpty().WithMessage("ExerciseExternalId must not be empty.");

                    exercise.RuleFor(e => e.ExerciseName)
                        .NotEmpty().WithMessage("ExerciseName must not be empty.");

                    exercise.RuleFor(e => e.Order)
                        .GreaterThanOrEqualTo(1).WithMessage("Exercise Order must be >= 1.");

                    exercise.RuleFor(e => e.RestSeconds)
                        .InclusiveBetween(0, 600).When(e => e.RestSeconds.HasValue)
                        .WithMessage("RestSeconds must be between 0 and 600.");

                    exercise.RuleFor(e => e.Sets)
                        .Must(sets => sets.Count <= 20).WithMessage("An exercise may not have more than 20 sets.");

                    exercise.RuleForEach(e => e.Sets).ChildRules(set =>
                    {
                        set.RuleFor(s => s.SetNumber)
                            .GreaterThanOrEqualTo(1).WithMessage("SetNumber must be >= 1.");

                        set.RuleFor(s => s.Reps)
                            .InclusiveBetween(1, 1000).When(s => s.Reps.HasValue)
                            .WithMessage("Reps must be between 1 and 1000.");

                        set.RuleFor(s => s.WeightKg)
                            .GreaterThanOrEqualTo(0).When(s => s.WeightKg.HasValue)
                            .WithMessage("WeightKg must be >= 0.");

                        set.RuleFor(s => s.Rpe)
                            .InclusiveBetween(1, 10).When(s => s.Rpe.HasValue)
                            .WithMessage("RPE must be between 1 and 10.");
                    });
                });
            });
        });
    }
}
