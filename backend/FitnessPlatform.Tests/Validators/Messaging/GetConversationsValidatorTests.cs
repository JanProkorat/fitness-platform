using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Messaging.GetConversations;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators.Messaging;

/// <summary>
/// Tests for <see cref="GetConversationsValidator"/>.
/// </summary>
public class GetConversationsValidatorTests
{
    private readonly GetConversationsValidator _validator = new();

    private static GetConversationsRequest ValidRequest() => new();

    [Fact]
    public void ValidRequest_Defaults_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Filter_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.Filter = null;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Filter);
    }

    [Fact]
    public void Filter_ValidEnumValue_PassesValidation()
    {
        var req = ValidRequest();
        req.Filter = ClientListFilter.UnreadMessages;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Filter);
    }

    [Fact]
    public void Filter_InvalidEnumValue_FailsValidation()
    {
        var req = ValidRequest();
        req.Filter = (ClientListFilter)999;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Filter);
    }
}
