using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Automations.CreateAutomationRule;
using FitnessPlatform.Application.Features.Automations.CreateClientAutomationRule;
using FitnessPlatform.Application.Features.Automations.PauseClientAutomation;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Automations;

/// <summary>
/// Validator tests for the automation request bodies.
/// </summary>
public class AutomationValidatorTests
{
    private static CreateAutomationRuleRequest ValidSchedule() => new()
    {
        Name = "Measurements",
        ActionType = AutomationActionType.RequestMeasurements,
        TriggerKind = AutomationTriggerKind.Schedule,
        ScheduleInterval = 2,
        ScheduleUnit = AutomationScheduleUnit.Weeks,
        LocalTime = TimeSpan.FromHours(8),
    };

    private static CreateAutomationRuleRequest ValidEvent() => new()
    {
        Name = "Plan review",
        ActionType = AutomationActionType.SendForm,
        QuestionnaireId = Guid.NewGuid(),
        TriggerKind = AutomationTriggerKind.Event,
        EventType = AutomationEventType.PlanEnded,
        EventOffsetDays = 3,
        EventOffsetDirection = AutomationOffsetDirection.Before,
    };

    private static TestValidationResult<CreateAutomationRuleRequest> Validate(CreateAutomationRuleRequest request) =>
        new CreateAutomationRuleValidator().TestValidate(request);

    [Fact]
    public void Validate_ValidScheduleAndEventRules_Pass()
    {
        Validate(ValidSchedule()).ShouldNotHaveAnyValidationErrors();
        Validate(ValidEvent()).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("a", true)]
    public void Validate_Name_IsRequired(string name, bool valid)
    {
        var request = ValidSchedule();
        request.Name = name;

        var result = Validate(request);

        if (valid)
        {
            result.ShouldNotHaveValidationErrorFor(x => x.Name);
        }
        else
        {
            result.ShouldHaveValidationErrorFor(x => x.Name);
        }
    }

    [Fact]
    public void Validate_NameOver100AndMessageOver1000_Fail()
    {
        var request = ValidSchedule();
        request.Name = new string('n', 101);
        request.Message = new string('m', 1001);

        var result = Validate(request);

        result.ShouldHaveValidationErrorFor(x => x.Name);
        result.ShouldHaveValidationErrorFor(x => x.Message);
    }

    [Fact]
    public void Validate_NameAt100AndMessageAt1000_Pass()
    {
        var request = ValidSchedule();
        request.Name = new string('n', 100);
        request.Message = new string('m', 1000);

        Validate(request).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_SendFormWithoutQuestionnaire_Fails()
    {
        var request = ValidEvent();
        request.QuestionnaireId = null;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationQuestionnaireRequired);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(366)]
    public void Validate_ScheduleIntervalOutOfRange_Fails(int interval)
    {
        var request = ValidSchedule();
        request.ScheduleInterval = interval;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationScheduleInvalid);
    }

    [Fact]
    public void Validate_ScheduleUnitNotDaysOrWeeks_Fails()
    {
        var request = ValidSchedule();
        request.ScheduleUnit = (AutomationScheduleUnit)7;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationScheduleInvalid);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1440)]
    public void Validate_LocalTimeOutsideTheDay_Fails(int minutes)
    {
        var request = ValidSchedule();
        request.LocalTime = TimeSpan.FromMinutes(minutes);

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationScheduleInvalid);
    }

    [Fact]
    public void Validate_ScheduleWithoutLocalTime_Fails()
    {
        var request = ValidSchedule();
        request.LocalTime = null;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationScheduleInvalid);
    }

    [Fact]
    public void Validate_EventWithoutEventType_Fails()
    {
        var request = ValidEvent();
        request.EventType = null;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationEventInvalid);
    }

    [Fact]
    public void Validate_NegativeEventOffset_Fails()
    {
        var request = ValidEvent();
        request.EventOffsetDays = -1;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationEventInvalid);
    }

    [Fact]
    public void Validate_OncePerPlanOnNonPlanEvent_Fails()
    {
        var request = ValidEvent();
        request.EventType = AutomationEventType.ClientJoined;
        request.EventOffsetDirection = AutomationOffsetDirection.After;
        request.OncePerPlan = true;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationOncePerPlanNeedsPlanEvent);
    }

    [Fact]
    public void Validate_OncePerPlanOnPlanEvent_Passes()
    {
        var request = ValidEvent();
        request.OncePerPlan = true;

        Validate(request).ShouldNotHaveAnyValidationErrors();
    }

    private static CreateAutomationRuleRequest EventRule(
        AutomationEventType eventType, int? offset, AutomationOffsetDirection? direction)
    {
        var request = ValidEvent();
        request.EventType = eventType;
        request.EventOffsetDays = offset;
        request.EventOffsetDirection = direction;
        return request;
    }

    [Theory]
    [InlineData(AutomationEventType.CheckInMissed, 0, AutomationOffsetDirection.After)]
    [InlineData(AutomationEventType.CheckInMissed, 2, AutomationOffsetDirection.After)]
    [InlineData(AutomationEventType.FormAnswered, 0, AutomationOffsetDirection.After)]
    [InlineData(AutomationEventType.FormAnswered, null, null)]
    [InlineData(AutomationEventType.ClientInactive, 1, AutomationOffsetDirection.After)]
    [InlineData(AutomationEventType.ClientInactive, 14, null)]
    [InlineData(AutomationEventType.PlanStarted, 2, AutomationOffsetDirection.Before)]
    public void Validate_NewEventShapes_Accepted(AutomationEventType eventType, int? offset, AutomationOffsetDirection? direction)
    {
        Validate(EventRule(eventType, offset, direction)).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(AutomationEventType.CheckInMissed, 1, AutomationOffsetDirection.Before)]
    [InlineData(AutomationEventType.FormAnswered, 1, AutomationOffsetDirection.Before)]
    [InlineData(AutomationEventType.ClientInactive, 3, AutomationOffsetDirection.Before)]
    [InlineData(AutomationEventType.ClientInactive, 0, AutomationOffsetDirection.After)]
    [InlineData(AutomationEventType.ClientInactive, null, null)]
    [InlineData(AutomationEventType.ClientJoined, 1, AutomationOffsetDirection.Before)]
    public void Validate_NewEventShapes_Rejected(AutomationEventType eventType, int? offset, AutomationOffsetDirection? direction)
    {
        Validate(EventRule(eventType, offset, direction)).Errors
            .Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationEventInvalid);
    }

    [Theory]
    [InlineData(AutomationEventType.CheckInMissed)]
    [InlineData(AutomationEventType.ClientInactive)]
    [InlineData(AutomationEventType.FormAnswered)]
    public void Validate_OncePerPlanOnNewEvents_Fails(AutomationEventType eventType)
    {
        var request = EventRule(eventType, 1, AutomationOffsetDirection.After);
        request.OncePerPlan = true;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationOncePerPlanNeedsPlanEvent);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void Validate_StopAfterBelowOne_Fails(int stopAfter)
    {
        var request = ValidSchedule();
        request.StopAfterSends = stopAfter;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationStopAfterInvalid);
    }

    [Fact]
    public void Validate_TagAudienceWithoutTag_Fails()
    {
        var request = ValidSchedule();
        request.Audience = AutomationAudience.Tag;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationAudienceTagRequired);
    }

    [Fact]
    public void Validate_ChosenAudienceWithEmptyList_Fails()
    {
        var request = ValidSchedule();
        request.Audience = AutomationAudience.Chosen;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationAudienceClientsRequired);
    }

    [Fact]
    public void ValidateClientOnlyRule_UsesTheSameBodyRules()
    {
        var result = new CreateClientAutomationRuleValidator().TestValidate(new CreateClientAutomationRuleRequest
        {
            ClientId = Guid.NewGuid(),
            Name = string.Empty,
            ActionType = AutomationActionType.RequestProgressPhotos,
            TriggerKind = AutomationTriggerKind.Schedule,
            ScheduleInterval = 1,
            ScheduleUnit = AutomationScheduleUnit.Weeks,
            LocalTime = TimeSpan.FromHours(9),
        });

        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void ValidatePause_NoteOver200_Fails()
    {
        var result = new PauseClientAutomationValidator().TestValidate(Pause(note: new string('x', 201)));

        result.ShouldHaveValidationErrorFor(x => x.PauseNote);
    }

    [Fact]
    public void ValidatePause_EndDateInThePast_Fails()
    {
        var past = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);

        new PauseClientAutomationValidator().TestValidate(Pause(until: past))
            .Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationPausedUntilInPast);
    }

    [Fact]
    public void ValidatePause_EndDateOrNoteWithoutPause_Fails()
    {
        new PauseClientAutomationValidator()
            .TestValidate(Pause(isPaused: false, until: DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5)))
            .Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationPauseDetailsWithoutPause);

        new PauseClientAutomationValidator()
            .TestValidate(Pause(isPaused: false, note: "knee"))
            .Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.AutomationPauseDetailsWithoutPause);
    }

    [Fact]
    public void ValidatePause_PausedWithFutureEndDateAndNote_Passes()
    {
        new PauseClientAutomationValidator()
            .TestValidate(Pause(until: DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5), note: "knee injury"))
            .ShouldNotHaveAnyValidationErrors();
    }

    private static PauseClientAutomationRequest Pause(bool isPaused = true, DateOnly? until = null, string? note = null) => new()
    {
        ClientId = Guid.NewGuid(),
        RuleId = Guid.NewGuid(),
        IsPaused = isPaused,
        PausedUntil = until,
        PauseNote = note,
    };
}
