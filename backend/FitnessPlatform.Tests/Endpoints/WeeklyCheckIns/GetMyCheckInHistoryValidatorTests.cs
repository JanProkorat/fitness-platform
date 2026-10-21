using FitnessPlatform.Application.Features.WeeklyCheckIns.GetMyCheckInHistory;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Unit tests for <see cref="GetMyCheckInHistoryValidator"/>.
/// </summary>
public class GetMyCheckInHistoryValidatorTests
{
    private readonly GetMyCheckInHistoryValidator _validator = new();

    [Fact]
    public void Validate_Defaults_Passes()
    {
        var result = _validator.TestValidate(new GetMyCheckInHistoryRequest());

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_PageBelowOne_FailsWithOutOfRange(int page)
    {
        var result = _validator.TestValidate(new GetMyCheckInHistoryRequest { Page = page });

        result.Errors.Should().ContainSingle(e => e.ErrorCode == "OUT_OF_RANGE");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_PageSizeOutsideRange_FailsWithOutOfRange(int pageSize)
    {
        var result = _validator.TestValidate(new GetMyCheckInHistoryRequest { PageSize = pageSize });

        result.Errors.Should().ContainSingle(e => e.ErrorCode == "OUT_OF_RANGE");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    public void Validate_PageSizeAtBoundary_Passes(int pageSize)
    {
        var result = _validator.TestValidate(new GetMyCheckInHistoryRequest { PageSize = pageSize });

        result.ShouldNotHaveAnyValidationErrors();
    }
}
