using FormUp.Application.Domain.Constants;
using FormUp.Application.Features.Trainers.ClientRequests.ProposeClientRequestPackage;
using FluentAssertions;

namespace FormUp.Tests.Endpoints.Trainers.ClientRequests;

/// <summary>
/// Tests for <see cref="ProposeClientRequestPackageValidator"/>: a package is required and the statement matches the entity column.
/// </summary>
public class ProposeClientRequestPackageValidatorTests
{
    private readonly ProposeClientRequestPackageValidator _validator = new();

    private static ProposeClientRequestPackageRequest Valid(string? statement = null) => new()
    {
        PublicId = Guid.NewGuid(),
        PackagePublicId = Guid.NewGuid(),
        Statement = statement,
    };

    [Theory]
    [InlineData(null)]
    [InlineData("Welcome")]
    public void Statement_WithinLimit_IsValid(string? statement)
    {
        _validator.Validate(Valid(statement)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Statement_AtLimit_IsValid()
    {
        _validator.Validate(Valid(new string('a', 1000))).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Statement_OverLimit_IsInvalid()
    {
        _validator.Validate(Valid(new string('a', 1001))).IsValid.Should().BeFalse();
    }

    [Fact]
    public void SkipOnboardingForm_WithQuestionnaire_FailsWithItsOwnCode()
    {
        var request = Valid();
        request.SkipOnboardingForm = true;
        request.QuestionnairePublicId = Guid.NewGuid();

        _validator.Validate(request).Errors.Should().ContainSingle(
            error => error.ErrorCode == ErrorCodes.SkipOnboardingFormWithQuestionnaire);
    }

    [Fact]
    public void SkipOnboardingForm_WithoutQuestionnaire_IsValid()
    {
        var request = Valid();
        request.SkipOnboardingForm = true;

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Package_Missing_IsInvalid()
    {
        var request = Valid();
        request.PackagePublicId = Guid.Empty;

        _validator.Validate(request).IsValid.Should().BeFalse();
    }
}
