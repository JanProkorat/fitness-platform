using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Users.Shared;
using FitnessPlatform.Application.Features.Users.UpdateNotificationPreferences;

namespace FitnessPlatform.Tests.Validators;

public class UpdateNotificationPreferencesValidatorTests
{
    private readonly UpdateNotificationPreferencesValidator _validator = new();

    private static UpdateNotificationPreferencesRequest ValidRequest() => new()
    {
        Preferences = NotificationPreferenceDefaults.AllEvents
            .Select(e => new NotificationPreferenceDto { Event = e, Email = false, Push = true })
            .ToList(),
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        _validator.TestValidate(ValidRequest()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Preferences_Null_Fails()
    {
        var req = new UpdateNotificationPreferencesRequest { Preferences = null! };

        var result = _validator.TestValidate(req);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == "Preferences are required.");
    }

    [Fact]
    public void Preferences_MissingEvent_Fails()
    {
        var req = ValidRequest();
        req.Preferences.RemoveAt(0);

        var result = _validator.TestValidate(req);

        result.Errors.Should().Contain(e => e.ErrorMessage == "Every notification event must be present.");
    }

    [Fact]
    public void Preferences_DuplicateEvent_Fails()
    {
        var req = ValidRequest();
        req.Preferences[1].Event = req.Preferences[0].Event;

        var result = _validator.TestValidate(req);

        result.Errors.Should().Contain(e => e.ErrorMessage == "Each notification event may appear only once.");
    }

    [Fact]
    public void Preferences_UnknownEvent_Fails()
    {
        var req = ValidRequest();
        req.Preferences[0].Event = (NotificationEvent)999;

        _validator.TestValidate(req).IsValid.Should().BeFalse();
    }
}
