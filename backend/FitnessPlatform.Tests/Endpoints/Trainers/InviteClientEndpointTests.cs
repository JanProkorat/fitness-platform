using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.InviteClient;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class InviteClientEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidTrainer_CreatesInvitation()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.TrainerProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<InviteClientEndpoint>>();

        var ep = Factory.Create<InviteClientEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, emailService, logger);

        await ep.HandleAsync(new InviteClientRequest { Email = "client@test.com" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.Message.Should().Be("Invitation sent successfully.");
        ep.Response.InvitationToken.Should().NotBeNullOrEmpty();

        db.InvitationTokens.Received(1).Add(Arg.Is<InvitationToken>(t => t.Email == "client@test.com"));
        await emailService.Received(1).SendInvitationEmailAsync(
            "client@test.com", "Train Er", Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoTrainerProfile_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<InviteClientEndpoint>>();

        var ep = Factory.Create<InviteClientEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, emailService, logger);

        var act = () => ep.HandleAsync(new InviteClientRequest { Email = "client@test.com" }, default);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<InviteClientEndpoint>>();

        var ep = Factory.Create<InviteClientEndpoint>(db, emailService, logger);

        await ep.HandleAsync(new InviteClientRequest { Email = "client@test.com" }, default);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_TokenExpiresIn7Days()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.TrainerProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<InviteClientEndpoint>>();

        InvitationToken? capturedInvitation = null;
        db.InvitationTokens.When(x => x.Add(Arg.Any<InvitationToken>()))
            .Do(ci => capturedInvitation = ci.Arg<InvitationToken>());

        var ep = Factory.Create<InviteClientEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, emailService, logger);

        await ep.HandleAsync(new InviteClientRequest { Email = "client@test.com" }, default);

        capturedInvitation.Should().NotBeNull();
        capturedInvitation!.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), TimeSpan.FromSeconds(5));
    }
}
