using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.CoachSubscriptions.SetCoachSubscription;
using FormUp.Application.Infrastructure.Data;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FormUp.Tests.Endpoints.CoachSubscriptions;

/// <summary>
/// Integration tests for <c>PUT /admin/coaches/{CoachId}/subscription</c> (<see cref="SetCoachSubscriptionEndpoint"/>).
/// </summary>
[Collection(TestCollection.Name)]
public class SetCoachSubscriptionEndpointTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private Task<Actor> CreateCoachAsync() => TestActors.Trainer(factory).CreateAsync(Ct);

    private static object Body(string planCode, SubscriptionStatus status = SubscriptionStatus.Active,
        DateTimeOffset? freeUntil = null, bool paysSecondRoleAddOn = false) =>
        new { PlanCode = planCode, Status = status.ToString(), FreeUntil = freeUntil, PaysSecondRoleAddOn = paysSecondRoleAddOn };

    [Fact]
    public async Task Put_CoachWithoutARow_CreatesItOnThePlansOpenPriceRow()
    {
        var admin = await TestHelpers.RegisterAdminAsync(factory, Ct);
        var coach = await CreateCoachAsync();
        var freeUntil = DateTimeOffset.UtcNow.AddDays(30);

        var response = await admin.PutAsJsonAsync(
            $"/admin/coaches/{coach.UserId}/subscription", Body("pro", freeUntil: freeUntil, paysSecondRoleAddOn: true), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var row = await db.CoachSubscriptions.AsNoTracking()
            .Include(cs => cs.SubscriptionPlanPrice)
            .Include(cs => cs.SubscriptionPlan)
            .SingleAsync(cs => cs.ProfessionalProfileId == coach.ProfileId, Ct);
        row.SubscriptionPlan.Code.Should().Be("pro");
        row.SubscriptionPlanPrice.ValidTo.Should().BeNull();
        row.SubscriptionPlanPrice.SubscriptionPlanId.Should().Be(row.SubscriptionPlanId);
        row.Status.Should().Be(SubscriptionStatus.Active);
        row.PaysSecondRoleAddOn.Should().BeTrue();
        row.FreeUntil.Should().BeCloseTo(freeUntil, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Put_CoachWithARow_ReplacesPlanAndStatusEvenForAnInactivePlan()
    {
        var admin = await TestHelpers.RegisterAdminAsync(factory, Ct);
        var coach = await CreateCoachAsync();
        await CoachSubscriptionBuilder.SubscribeToPlanAsync(factory, coach, "pro");
        var inactiveCode = await CreateInactivePlanAsync();

        var response = await admin.PutAsJsonAsync(
            $"/admin/coaches/{coach.UserId}/subscription", Body(inactiveCode, SubscriptionStatus.PastDue), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rows = await db.CoachSubscriptions.AsNoTracking()
            .Where(cs => cs.ProfessionalProfileId == coach.ProfileId)
            .Select(cs => new { cs.SubscriptionPlan.Code, cs.Status })
            .ToListAsync(Ct);
        rows.Should().ContainSingle().Which.Should().Be(new { Code = inactiveCode, Status = SubscriptionStatus.PastDue });
    }

    [Fact]
    public async Task Put_UnknownCoach_Returns404()
    {
        var admin = await TestHelpers.RegisterAdminAsync(factory, Ct);

        var response = await admin.PutAsJsonAsync($"/admin/coaches/{Guid.NewGuid()}/subscription", Body("pro"), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_UnknownPlanCode_Returns404()
    {
        var admin = await TestHelpers.RegisterAdminAsync(factory, Ct);
        var coach = await CreateCoachAsync();

        var response = await admin.PutAsJsonAsync($"/admin/coaches/{coach.UserId}/subscription", Body("no-such-plan"), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_EmptyPlanCode_Returns400()
    {
        var admin = await TestHelpers.RegisterAdminAsync(factory, Ct);
        var coach = await CreateCoachAsync();

        var response = await admin.PutAsJsonAsync($"/admin/coaches/{coach.UserId}/subscription", Body(string.Empty), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<string> CreateInactivePlanAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = new SubscriptionPlan
        {
            Code = $"inactive-{Guid.NewGuid():N}"[..30],
            NameCs = "Plán",
            NameEn = "Plan",
            NameDe = "Plan",
            Currency = "CZK",
            PriceMinorUnits = 1000,
            BillingInterval = BillingInterval.Monthly,
            IsActive = false,
        };
        SubscriptionPlanPriceBuilder.OpenPriceFor(plan);
        db.SubscriptionPlans.Add(plan);
        await db.SaveChangesAsync(Ct);

        return plan.Code;
    }
}
