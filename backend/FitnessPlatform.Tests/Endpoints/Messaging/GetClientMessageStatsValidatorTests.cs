using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Messaging.GetClientMessageStats;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Unit tests for <see cref="GetClientMessageStatsValidator"/>. No host needed.
/// </summary>
public class GetClientMessageStatsValidatorTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    [InlineData(26)]
    public void Validate_WeeksInRange_Passes(int weeks)
    {
        var result = new GetClientMessageStatsValidator().TestValidate(
            new GetClientMessageStatsRequest { ClientId = Guid.NewGuid(), Weeks = weeks });

        result.ShouldNotHaveValidationErrorFor(x => x.Weeks);
    }

    [Fact]
    public void Validate_WeeksZero_FailsWithMessage()
    {
        var result = new GetClientMessageStatsValidator().TestValidate(
            new GetClientMessageStatsRequest { ClientId = Guid.NewGuid(), Weeks = 0 });

        result.ShouldHaveValidationErrorFor(x => x.Weeks)
            .WithErrorMessage("weeks must be between 1 and 26.");
    }

    [Fact]
    public void Validate_WeeksOverTwentySix_FailsWithMessage()
    {
        var result = new GetClientMessageStatsValidator().TestValidate(
            new GetClientMessageStatsRequest { ClientId = Guid.NewGuid(), Weeks = 27 });

        result.ShouldHaveValidationErrorFor(x => x.Weeks)
            .WithErrorMessage("weeks must be between 1 and 26.");
    }

    [Fact]
    public void Validate_WeeksNegative_FailsWithMessage()
    {
        var result = new GetClientMessageStatsValidator().TestValidate(
            new GetClientMessageStatsRequest { ClientId = Guid.NewGuid(), Weeks = -1 });

        result.ShouldHaveValidationErrorFor(x => x.Weeks)
            .WithErrorMessage("weeks must be between 1 and 26.");
    }
}
