using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Trainers.CreateCollaboration;

namespace FitnessPlatform.Tests.Validators;

public class CreateCollaborationValidatorTests
{
    private readonly CreateCollaborationValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new CreateCollaborationRequest
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = Guid.NewGuid()
        });
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ClientPublicId_Empty_Fails()
    {
        var result = _validator.TestValidate(new CreateCollaborationRequest
        {
            ClientPublicId = Guid.Empty,
            CollaboratorPublicId = Guid.NewGuid()
        });
        result.ShouldHaveValidationErrorFor(x => x.ClientPublicId);
    }

    [Fact]
    public void CollaboratorPublicId_Empty_Fails()
    {
        var result = _validator.TestValidate(new CreateCollaborationRequest
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = Guid.Empty
        });
        result.ShouldHaveValidationErrorFor(x => x.CollaboratorPublicId);
    }
}
