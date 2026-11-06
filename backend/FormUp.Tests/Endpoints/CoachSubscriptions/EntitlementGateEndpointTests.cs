using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Domain.Services;
using FormUp.Application.Features.NutritionPlans.CopyPlan;
using FormUp.Application.Features.NutritionPlans.CreatePlan;
using FormUp.Application.Features.NutritionPlans.PublishWeek;
using FormUp.Application.Features.NutritionPlans.UpdatePlan;
using FormUp.Application.Features.NutritionPlanTemplates.InstantiateTemplate;
using FormUp.Application.Features.Trainers.AssignQuestionnaire;
using FormUp.Application.Features.Trainers.ReplaceQuestionnaire;
using FormUp.Application.Features.TrainingPlans.CreateTrainingPlan;
using FormUp.Application.Features.TrainingPlans.PublishTrainingWeek;
using FormUp.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FormUp.Application.Features.TrainingPlanTemplates.InstantiateTemplate;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Data.MongoDb;
using FormUp.Tests.Builders;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FormUp.Tests.Endpoints.CoachSubscriptions;

/// <summary>
/// Every endpoint gated on a subscription feature answers 403 SUBSCRIPTION_REQUIRED when the coach's plan lacks
/// that feature. The gate runs before any lookup, so each case calls <c>HandleAsync</c> with an empty request
/// and stubbed dependencies.
/// </summary>
public class EntitlementGateEndpointTests
{
    private const long ProfileId = 41;

    private readonly Guid _userId = Guid.NewGuid();

    /// <summary>A database where the caller's coach is Active on a plan with every feature off.</summary>
    private IApplicationDbContext DbOnAPlanWithoutFeatures()
    {
        var plan = new SubscriptionPlan
        {
            Id = 9,
            Code = "no-features",
            NameCs = "Plan",
            NameEn = "Plan",
            NameDe = "Plan",
            Currency = "CZK",
            BothRolesIncluded = true,
        };
        var subscription = new CoachSubscription
        {
            ProfessionalProfileId = ProfileId,
            SubscriptionPlanId = plan.Id,
            SubscriptionPlanPriceId = 1,
            SubscriptionPlan = plan,
            Status = SubscriptionStatus.Active,
        };

        return new MockDbBuilder()
            .With(EntityBuilder.ProfessionalProfile.WithId(ProfileId).WithUserId(_userId).Build())
            .With(plan)
            .With(subscription)
            .Build();
    }

    private Action<DefaultHttpContext> Caller(string role, MemoryStream body) => ctx =>
    {
        ctx.Request.HttpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_userId, role)));
        ctx.Request.HttpContext.Response.Body = body;
    };

    private static async Task AssertSubscriptionRequiredAsync(IEndpoint endpoint, MemoryStream body)
    {
        endpoint.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        body.Position = 0;
        (await new StreamReader(body).ReadToEndAsync(TestContext.Current.CancellationToken))
            .Should().Contain(ErrorCodes.SubscriptionRequired);
    }

    private static IMongoContext Mongo() => Substitute.For<IMongoContext>();

    private static IClientLinkAuthorizationService Links() => Substitute.For<IClientLinkAuthorizationService>();

    [Fact]
    public async Task CreatePlan_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<CreatePlanEndpoint>(Caller(AppRoles.Nutritionist, body), Mongo(), Links(), DbOnAPlanWithoutFeatures());

        await ep.HandleAsync(new CreatePlanRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task UpdatePlan_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<UpdatePlanEndpoint>(
            Caller(AppRoles.Nutritionist, body), Mongo(), Substitute.For<IMacroCalculatorService>(), DbOnAPlanWithoutFeatures(),
            Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(), Links(), TimeProvider.System);

        await ep.HandleAsync(new UpdatePlanRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task PublishWeek_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<PublishWeekEndpoint>(
            Caller(AppRoles.Nutritionist, body), Mongo(), DbOnAPlanWithoutFeatures(), Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(), Links());

        await ep.HandleAsync(new PublishWeekRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task CopyNutritionPlan_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<CopyNutritionPlanEndpoint>(
            Caller(AppRoles.Nutritionist, body), Mongo(), Links(), DbOnAPlanWithoutFeatures(), TimeProvider.System);

        await ep.HandleAsync(new CopyNutritionPlanRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task InstantiateNutritionPlanTemplate_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<InstantiateTemplateEndpoint>(
            Caller(AppRoles.Nutritionist, body), Mongo(), Links(), DbOnAPlanWithoutFeatures(), TimeProvider.System);

        await ep.HandleAsync(new InstantiateNutritionPlanTemplateRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task CreateTrainingPlan_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<CreateTrainingPlanEndpoint>(Caller(AppRoles.Trainer, body), Mongo(), Links(), DbOnAPlanWithoutFeatures());

        await ep.HandleAsync(new CreateTrainingPlanRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task UpdateTrainingPlan_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            Caller(AppRoles.Trainer, body), Mongo(), Substitute.For<ISessionLockService>(), Substitute.For<IRealtimeNotifier>(),
            new PlanConcurrencyGuard(), DbOnAPlanWithoutFeatures(), Links());

        await ep.HandleAsync(new UpdateTrainingPlanRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task PublishTrainingWeek_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<PublishTrainingWeekEndpoint>(
            Caller(AppRoles.Trainer, body), Mongo(), DbOnAPlanWithoutFeatures(), Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(), Substitute.For<ISessionLockService>(), new PlanConcurrencyGuard(), Links());

        await ep.HandleAsync(new PublishTrainingWeekRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task InstantiateTrainingPlanTemplate_PlanWithoutCanCreatePlans_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<InstantiateTrainingPlanTemplateEndpoint>(
            Caller(AppRoles.Trainer, body), Mongo(), Links(), DbOnAPlanWithoutFeatures(), TimeProvider.System);

        await ep.HandleAsync(new InstantiateTrainingPlanTemplateRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task AssignQuestionnaire_PlanWithoutCanSendQuestionnaires_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<AssignQuestionnaireEndpoint>(
            Caller(AppRoles.Trainer, body), DbOnAPlanWithoutFeatures(), Substitute.For<IRealtimeNotifier>(),
            Substitute.For<INotificationService>(), Substitute.For<ILogger<AssignQuestionnaireEndpoint>>());

        await ep.HandleAsync(new AssignQuestionnaireRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }

    [Fact]
    public async Task ReplaceQuestionnaire_PlanWithoutCanSendQuestionnaires_Returns403SubscriptionRequired()
    {
        var body = new MemoryStream();
        var ep = Factory.Create<ReplaceQuestionnaireEndpoint>(
            Caller(AppRoles.Trainer, body), DbOnAPlanWithoutFeatures(), Substitute.For<IRealtimeNotifier>(),
            Substitute.For<INotificationService>(), Substitute.For<ILogger<ReplaceQuestionnaireEndpoint>>());

        await ep.HandleAsync(new ReplaceQuestionnaireRequest(), TestContext.Current.CancellationToken);

        await AssertSubscriptionRequiredAsync(ep, body);
    }
}
