using FluentAssertions;
using FormUp.Application.Features.Auth.Shared;

namespace FormUp.Tests.Endpoints.Auth;

/// <summary>
/// Role resolution for new social accounts must stay inside the allowlist even without a validator.
/// </summary>
public class SocialSignUpRolesTests
{
    [Fact]
    public void Resolve_AdminOnly_NeverReturnsAdmin()
    {
        var resolved = SocialSignUpRoles.Resolve(["Admin"]);

        resolved.Should().NotContain("Admin");
        resolved.Should().Equal("Client");
    }

    [Fact]
    public void Resolve_AdminAlongsideTrainer_DropsAdminOnly()
    {
        SocialSignUpRoles.Resolve(["admin", "trainer"]).Should().Equal("Trainer");
    }

    [Fact]
    public void Resolve_EmptyOrNull_ReturnsClient()
    {
        SocialSignUpRoles.Resolve([]).Should().Equal("Client");
        SocialSignUpRoles.Resolve(null).Should().Equal("Client");
    }
}
