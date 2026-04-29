using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Trainers.GetClients;
using FitnessPlatform.Tests.Builders;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class GetClientsEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_TrainerWithClients_ReturnsList()
    {
        var clientUser = EntityBuilder.User.WithEmail("linked-client@test.com")
            .WithFirstName("Linked").WithLastName("Client").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(new GetClientsRequest(), CancellationToken.None);

        ep.Response.TotalCount.Should().Be(1);
        ep.Response.Clients.Should().ContainSingle(c => c.Email == "linked-client@test.com");
        ep.Response.Clients[0].LinkId.Should().Be(42);
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetClientsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(new GetClientsRequest(), CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<GetClientsEndpoint>(db);

        await ep.HandleAsync(new GetClientsRequest(), CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_TrainerWithNoClients_ReturnsEmptyList()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();

        var ep = Factory.Create<GetClientsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(new GetClientsRequest(), CancellationToken.None);

        ep.Response.TotalCount.Should().Be(0);
        ep.Response.Clients.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_Pagination_RespectsPageSize()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();

        var dbBuilder = new MockDbBuilder().With(trainerProfile);

        for (var i = 0; i < 3; i++)
        {
            var clientUser = EntityBuilder.User.WithEmail($"client{i}@test.com")
                .WithFirstName($"Client{i}").WithLastName("User").Build();
            var clientProfile = EntityBuilder.ClientProfile.WithId(i + 1).WithUser(clientUser).Build();
            var link = EntityBuilder.ClientProfessionalLink
                .WithClientProfile(clientProfile)
                .WithProfessionalProfile(trainerProfile)
                .Build();

            dbBuilder.With(clientUser).With(clientProfile).With(link);
        }

        var db = dbBuilder.Build();

        var ep = Factory.Create<GetClientsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(new GetClientsRequest { Page = 1, PageSize = 2 }, TestContext.Current.CancellationToken);

        ep.Response.TotalCount.Should().Be(3);
        ep.Response.Clients.Should().HaveCount(2);
        ep.Response.Page.Should().Be(1);
        ep.Response.PageSize.Should().Be(2);
    }
}
