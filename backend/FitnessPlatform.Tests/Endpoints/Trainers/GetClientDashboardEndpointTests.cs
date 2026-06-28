using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class GetClientDashboardEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();
    private readonly IComplianceService _complianceService = Substitute.For<IComplianceService>();

    // Returns a mock IMongoContext with no active plans — plan-first path
    // falls back to onboarding data without affecting the assertion.
    private static IMongoContext EmptyMongo() => PlanTestHelpers.CreateMockMongo();

    [Fact]
    public async Task HandleAsync_LinkedClient_ReturnsDashboard()
    {
        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("Dash").WithLastName("Client").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(99)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, EmptyMongo());

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.Response.Email.Should().Be("client@test.com");
        ep.Response.FirstName.Should().Be("Dash");
        ep.Response.LastName.Should().Be("Client");
        ep.Response.IsActive.Should().BeTrue();
        ep.Response.TotalMeasurements.Should().Be(0);
        ep.Response.TotalProgressPhotos.Should().Be(0);
        ep.Response.LinkId.Should().Be(99);
        ep.Response.ClientUserId.Should().Be(clientUser.Id);
    }

    [Fact]
    public async Task HandleAsync_LinkedClient_ReturnsClientUserId_MatchingApplicationUserId()
    {
        // ClientUserId must equal the ApplicationUser.Id (the FK on ClientProfile),
        // which differs from ClientPublicId. This is the identifier the weekly-check-in
        // endpoint filters on.
        var clientUser = EntityBuilder.User.WithEmail("checkin@test.com")
            .WithFirstName("Check").WithLastName("In").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(2).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(100)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, EmptyMongo());

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.Response.ClientUserId.Should().Be(clientUser.Id);
        ep.Response.ClientPublicId.Should().Be(clientProfile.PublicId);
        ep.Response.ClientUserId.Should().NotBe(clientProfile.PublicId);
    }

    [Fact]
    public async Task HandleAsync_UnlinkedClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var otherUser = EntityBuilder.User.WithEmail("other@test.com")
            .WithFirstName("Other").WithLastName("User").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(otherUser).Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, EmptyMongo());

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NonexistentClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, EmptyMongo());

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<GetClientDashboardEndpoint>(db, _audit, _complianceService, EmptyMongo());

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_ComplianceServiceThrows_Returns200_WithNullCompliance()
    {
        // Arrange: compliance service throws — endpoint must degrade gracefully
        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("Dash").WithLastName("Client").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(99)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        _complianceService
            .CalculateComplianceAsync(Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("No active nutrition plan"));

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, EmptyMongo());

        // Act — must not throw
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert — graceful degradation: 200 with null compliance fields
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().BeNull();
        ep.Response.CurrentStreak.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_LinkedClient_WritesAuditLog()
    {
        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("Dash").WithLastName("Client").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, _audit, _complianceService, EmptyMongo());

        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        await _audit.Received(1).LogAsync(
            _trainerId,
            "Read",
            "ClientProfile",
            clientProfile.PublicId,
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }
}
