using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientTags.ReplaceClientTagAssignments;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators.ClientTags;

/// <summary>
/// Tests for <see cref="ReplaceClientTagAssignmentsValidator"/>.
/// </summary>
public class ReplaceClientTagAssignmentsValidatorTests
{
    private readonly ReplaceClientTagAssignmentsValidator _validator = new();

    private static ReplaceClientTagAssignmentsRequest ValidRequest() => new()
    {
        ClientId = Guid.NewGuid(),
        TagIds = [Guid.NewGuid(), Guid.NewGuid()],
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void EmptyTagIds_PassesValidation()
    {
        var req = ValidRequest();
        req.TagIds = [];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ClientId_Empty_FailsWithRequired()
    {
        var req = ValidRequest();
        req.ClientId = Guid.Empty;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ClientId).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void TagIds_ContainsDuplicates_FailsWithOutOfRange()
    {
        var duplicateId = Guid.NewGuid();
        var req = ValidRequest();
        req.TagIds = [duplicateId, duplicateId];

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TagIds).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void TagIds_ExceedsCap_FailsWithOutOfRange()
    {
        var req = ValidRequest();
        req.TagIds = Enumerable.Range(0, 51).Select(_ => Guid.NewGuid()).ToList();

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TagIds).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void TagIds_AtCap_PassesValidation()
    {
        var req = ValidRequest();
        req.TagIds = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToList();

        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }
}
