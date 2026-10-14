using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.PhotoDiaryRequests;

/// <summary>
/// Unit tests for <see cref="CreateRequestValidator"/>. Assertions use ErrorCode / ErrorMessage,
/// never PropertyName (it flakes once any test boots the app).
/// </summary>
public class CreateRequestValidatorTests
{
    private static CreateRequestRequest Valid(Action<CreateRequestRequest>? tweak = null)
    {
        var request = new CreateRequestRequest
        {
            ClientId = Guid.NewGuid(),
            Mode = PhotoDiaryMode.Workflow,
            DurationDays = 7,
        };
        tweak?.Invoke(request);
        return request;
    }

    [Fact]
    public void Validate_ValidEveryDayRequest_Passes()
    {
        new CreateRequestValidator().TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    [InlineData(-1)]
    public void Validate_EveryDayDurationOutOfRange_FailsWithOutOfRange(int durationDays)
    {
        var result = new CreateRequestValidator().TestValidate(Valid(r => r.DurationDays = durationDays));

        result.Errors.Should().ContainSingle().Which.ErrorCode.Should().Be(ErrorCodes.OutOfRange);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(30)]
    public void Validate_EveryDayDurationAtTheBounds_Passes(int durationDays)
    {
        new CreateRequestValidator().TestValidate(Valid(r => r.DurationDays = durationDays))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(99)]
    public void Validate_OnceDurationIsIgnored_Passes(int durationDays)
    {
        new CreateRequestValidator()
            .TestValidate(Valid(r =>
            {
                r.Mode = PhotoDiaryMode.Bulk;
                r.DurationDays = durationDays;
            }))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    public void Validate_ModeMissingOrNotAnEnumValue_FailsWithOutOfRange(int mode)
    {
        var result = new CreateRequestValidator().TestValidate(Valid(r => r.Mode = (PhotoDiaryMode)mode));

        result.Errors.Should().ContainSingle(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_Message501Characters_Fails()
    {
        var result = new CreateRequestValidator().TestValidate(Valid(r => r.Message = new string('a', 501)));

        result.Errors.Should().ContainSingle().Which.ErrorMessage.Should().Contain("500");
    }

    [Fact]
    public void Validate_Message500Characters_Passes()
    {
        new CreateRequestValidator().TestValidate(Valid(r => r.Message = new string('a', 500)))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BothClientAndInvite_FailsWithLinkXorInvite()
    {
        var result = new CreateRequestValidator().TestValidate(Valid(r => r.PendingInviteId = 5));

        result.Errors.Should().ContainSingle().Which.ErrorCode.Should().Be(ErrorCodes.PhotoDiaryRequestLinkXorInvite);
    }
}
