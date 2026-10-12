using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCheckInHistory;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Unit tests for <see cref="GetClientCheckInHistoryValidator"/>.
/// </summary>
public class GetClientCheckInHistoryValidatorTests
{
    private readonly GetClientCheckInHistoryValidator _validator = new();

    [Fact]
    public void Validate_DefaultWeeks_Passes()
    {
        var result = _validator.TestValidate(new GetClientCheckInHistoryRequest());

        result.IsValid.Should().BeTrue();
        new GetClientCheckInHistoryRequest().Weeks.Should().Be(8);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(26)]
    public void Validate_WeeksOnBoundary_Passes(int weeks)
    {
        var result = _validator.TestValidate(new GetClientCheckInHistoryRequest { Weeks = weeks });

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(27)]
    [InlineData(-1)]
    public void Validate_WeeksOutOfRange_FailsWithOutOfRangeCode(int weeks)
    {
        var result = _validator.TestValidate(new GetClientCheckInHistoryRequest { Weeks = weeks });

        result.Errors.Should().ContainSingle()
            .Which.ErrorCode.Should().Be(ErrorCodes.OutOfRange);
    }
}
