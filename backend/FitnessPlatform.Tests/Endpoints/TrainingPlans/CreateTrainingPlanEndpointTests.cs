using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="CreateTrainingPlanEndpoint"/>.
/// </summary>
public class CreateTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesPlan()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(true);

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Hypertrophy Block",
            WeekCount = 4
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.TrainingPlans.Received(1).InsertOneAsync(
            Arg.Is<TrainingPlan>(p =>
                p.Name == "Hypertrophy Block" &&
                p.ClientId == _clientId &&
                p.TrainerId == _trainerId &&
                p.Weeks.Count == 4 &&
                p.Version == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_Returns404()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(false);

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        await ep.HandleAsync(new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Test"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper();
        var ep = Factory.Create<CreateTrainingPlanEndpoint>(mongo, authHelper);

        await ep.HandleAsync(new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Test"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
