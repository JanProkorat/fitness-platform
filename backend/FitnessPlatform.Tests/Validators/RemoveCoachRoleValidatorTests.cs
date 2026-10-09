using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Users.RemoveCoachRole;
using FluentAssertions;

namespace FitnessPlatform.Tests.Validators;

public class RemoveCoachRoleValidatorTests
{
    private readonly RemoveCoachRoleValidator _validator = new();

    [Theory]
    [InlineData(AppRoles.Trainer)]
    [InlineData(AppRoles.Nutritionist)]
    [InlineData("trainer")]
    public void Validate_CoachRole_Passes(string role)
    {
        _validator.Validate(new RemoveCoachRoleRequest { Role = role }).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(AppRoles.Admin)]
    [InlineData(AppRoles.Client)]
    [InlineData("garbage")]
    public void Validate_NonCoachRole_Fails(string role)
    {
        _validator.Validate(new RemoveCoachRoleRequest { Role = role }).IsValid.Should().BeFalse();
    }
}
