using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Verifies that GetClientDashboardResponse correctly surfaces the
/// CanViewNutritionPlans and CanViewTrainingPlans flags from the
/// ClientProfessionalLink row — matching the seeded link value on the wire.
/// </summary>
public class GetClientDashboardPermissionFlagsTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    // Stub the compliance service to return a non-null ComplianceResult so the happy path
    // is exercised in all three permission-flag tests. The endpoint has a catch path that
    // logs a warning on compliance failure; providing a real stub keeps the test focused on
    // the CanViewNutritionPlans/CanViewTrainingPlans assertions rather than graceful degradation.
    // Pattern matches TrainingCompletionTestHelpers.CreateStubComplianceService().
    private readonly IComplianceService _complianceService = CreateStubComplianceService();

    private static IComplianceService CreateStubComplianceService()
    {
        var svc = Substitute.For<IComplianceService>();
        svc.CalculateComplianceAsync(
                Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult { CompliancePercent = 0m });
        svc.CalculateStreakAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(0);
        return svc;
    }

    private static System.Security.Claims.ClaimsPrincipal TrainerPrincipal(Guid trainerId) =>
        new(new System.Security.Claims.ClaimsIdentity(
            EndpointTestHelpers.FakeUserClaims(trainerId, AppRoles.Trainer)));

    [Fact]
    public async Task HandleAsync_LinkWithCanViewNutritionPlansFalse_ReturnsFalseOnWire()
    {
        // Arrange: link with CanViewNutritionPlans=false, CanViewTrainingPlans=true
        var clientUser = EntityBuilder.User.WithEmail("noplans@test.com")
            .WithFirstName("No").WithLastName("Plans").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(10).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(200)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CanViewNutritionPlans.Should().BeFalse();
        ep.Response.CanViewTrainingPlans.Should().BeTrue();
    }

    [Fact]
    public async Task HandleAsync_LinkWithCanViewNutritionPlansTrue_ReturnsTrueOnWire()
    {
        // Arrange: link with CanViewNutritionPlans=true, CanViewTrainingPlans=true (default)
        var clientUser = EntityBuilder.User.WithEmail("withplans@test.com")
            .WithFirstName("With").WithLastName("Plans").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(11).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(11).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(201)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CanViewNutritionPlans.Should().BeTrue();
        ep.Response.CanViewTrainingPlans.Should().BeTrue();
    }

    [Fact]
    public async Task HandleAsync_LinkWithBothFlagsFalse_Returns403()
    {
        // Arrange: link where both plan types are forbidden. Per #916 AC4, an active link
        // carrying neither capability flag must be denied outright (403), matching
        // ProfessionalAuthHelper.HasAnyPlanAccessAsync semantics from #903 — it must not
        // fall through to a 200 with both flags reported false on the wire.
        var clientUser = EntityBuilder.User.WithEmail("noaccess@test.com")
            .WithFirstName("No").WithLastName("Access").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(12).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(12).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(202)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(false)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }
}
