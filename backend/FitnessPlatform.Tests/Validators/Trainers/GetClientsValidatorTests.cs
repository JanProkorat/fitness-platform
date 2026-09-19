using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.GetClients;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators.Trainers;

/// <summary>
/// Tests for <see cref="GetClientsValidator"/>.
/// </summary>
public class GetClientsValidatorTests
{
    private readonly GetClientsValidator _validator = new();

    private static GetClientsRequest ValidRequest() => new();

    [Fact]
    public void ValidRequest_Defaults_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Page_Zero_FailsValidation()
    {
        var req = ValidRequest();
        req.Page = 0;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Page);
    }

    [Fact]
    public void Page_Negative_FailsValidation()
    {
        var req = ValidRequest();
        req.Page = -1;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Page);
    }

    [Fact]
    public void PageSize_Zero_FailsValidation()
    {
        var req = ValidRequest();
        req.PageSize = 0;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void PageSize_101_FailsValidation()
    {
        var req = ValidRequest();
        req.PageSize = 101;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void PageSize_100_PassesValidation()
    {
        var req = ValidRequest();
        req.PageSize = 100;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void Status_ValidEnumValue_PassesValidation()
    {
        var req = ValidRequest();
        req.Status = ClientListStatus.Active;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Status_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.Status = null;
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Status_InvalidEnumValue_FailsValidation()
    {
        var req = ValidRequest();
        req.Status = (ClientListStatus)999;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Filter_InvalidEnumValue_FailsValidation()
    {
        var req = ValidRequest();
        req.Filter = (ClientListFilter)999;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Filter);
    }

    [Fact]
    public void TagIds_TwentyIds_PassesValidation()
    {
        var req = ValidRequest();
        req.TagIds = Enumerable.Range(0, 20).Select(_ => Guid.NewGuid()).ToList();
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }

    [Fact]
    public void TagIds_TwentyOneIds_FailsValidation()
    {
        var req = ValidRequest();
        req.TagIds = Enumerable.Range(0, 21).Select(_ => Guid.NewGuid()).ToList();
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.TagIds);
    }
}
