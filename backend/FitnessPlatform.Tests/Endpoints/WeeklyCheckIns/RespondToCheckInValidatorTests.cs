using FitnessPlatform.Application.Features.WeeklyCheckIns.RespondToCheckIn;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Unit tests for <see cref="RespondToCheckInValidator"/> hunger-score rules.
/// </summary>
public class RespondToCheckInValidatorTests
{
    private static RespondToCheckInRequest Request(int? hungerScore) =>
        new() { Id = Guid.NewGuid(), HungerScore = hungerScore };

    [Theory]
    [InlineData(null)]
    [InlineData(1)]
    [InlineData(5)]
    public void Validate_HungerScoreAbsentOrInRange_Passes(int? hungerScore)
    {
        var result = new RespondToCheckInValidator().TestValidate(Request(hungerScore));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public void Validate_HungerScoreOutOfRange_Fails(int hungerScore)
    {
        var result = new RespondToCheckInValidator().TestValidate(Request(hungerScore));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.ErrorMessage.Should().Be("Hunger score must be between 1 and 5.");
    }
}
