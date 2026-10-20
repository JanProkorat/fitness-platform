using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Shape rules for the message, trigger and options of an automation rule.
/// </summary>
/// <typeparam name="T">The request type carrying a trigger body.</typeparam>
public abstract class AutomationTriggerBodyValidator<T> : Validator<T>
    where T : AutomationTriggerBody
{
    /// <summary>
    /// Initializes the shared trigger and option rules.
    /// </summary>
    protected AutomationTriggerBodyValidator()
    {
        RuleFor(x => x.Message).MaximumLength(1000);

        RuleFor(x => x.TriggerKind).IsInEnum();

        When(x => x.TriggerKind == AutomationTriggerKind.Schedule, () =>
        {
            RuleFor(x => x.ScheduleInterval)
                .Must(v => v is >= 1 and <= 365)
                .WithErrorCode(ErrorCodes.AutomationScheduleInvalid)
                .WithMessage("Schedule interval must be between 1 and 365.");

            RuleFor(x => x.ScheduleUnit)
                .Must(v => v.HasValue && Enum.IsDefined(v.Value))
                .WithErrorCode(ErrorCodes.AutomationScheduleInvalid)
                .WithMessage("Schedule unit must be Days or Weeks.");

            RuleFor(x => x.LocalTime)
                .Must(v => v.HasValue && v.Value >= TimeSpan.Zero && v.Value < TimeSpan.FromHours(24))
                .WithErrorCode(ErrorCodes.AutomationScheduleInvalid)
                .WithMessage("Local time must be between 00:00 and 23:59.");

            RuleFor(x => x.EventType)
                .Null()
                .WithErrorCode(ErrorCodes.AutomationScheduleInvalid)
                .WithMessage("A schedule trigger cannot carry an event.");

            RuleFor(x => x.OncePerPlan)
                .Equal(false)
                .WithErrorCode(ErrorCodes.AutomationOncePerPlanNeedsPlanEvent)
                .WithMessage("Once per plan applies to plan events only.");
        });

        When(x => x.TriggerKind == AutomationTriggerKind.Event, () =>
        {
            RuleFor(x => x.EventType)
                .Must(v => v.HasValue && Enum.IsDefined(v.Value))
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("An event trigger needs a valid event.");

            RuleFor(x => x.EventOffsetDays)
                .Must(v => v is null or (>= 0 and <= 365))
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("Event offset must be between 0 and 365 days.");

            RuleFor(x => x.EventOffsetDirection)
                .Must(v => v is null || Enum.IsDefined(v.Value))
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("Event offset direction is not valid.");

            RuleFor(x => x)
                .Must(x => x.EventOffsetDirection != AutomationOffsetDirection.Before
                           || x.EventType is AutomationEventType.PlanStarted or AutomationEventType.PlanEnded)
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("Only plan events can send before the event.");

            RuleFor(x => x)
                .Must(x => x.EventOffsetDays is >= 1)
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("Client inactive needs an offset of at least 1 day.")
                .When(x => x.EventType == AutomationEventType.ClientInactive);

            RuleFor(x => x)
                .Must(x => x.ScheduleInterval is null && x.ScheduleUnit is null)
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("An event trigger cannot carry a schedule interval or unit.");

            RuleFor(x => x.LocalTime)
                .Must(v => v is null || (v.Value >= TimeSpan.Zero && v.Value < TimeSpan.FromHours(24)))
                .WithErrorCode(ErrorCodes.AutomationEventInvalid)
                .WithMessage("Local time must be between 00:00 and 23:59.");

            RuleFor(x => x.OncePerPlan)
                .Equal(false)
                .WithErrorCode(ErrorCodes.AutomationOncePerPlanNeedsPlanEvent)
                .WithMessage("Once per plan applies to plan events only.")
                .When(x => x.EventType is not (AutomationEventType.PlanStarted or AutomationEventType.PlanEnded));
        });

        RuleFor(x => x.StopAfterSends)
            .Must(v => v is null or (>= 1 and <= 1000))
            .WithErrorCode(ErrorCodes.AutomationStopAfterInvalid)
            .WithMessage("Stop after must be between 1 and 1000.");
    }
}
