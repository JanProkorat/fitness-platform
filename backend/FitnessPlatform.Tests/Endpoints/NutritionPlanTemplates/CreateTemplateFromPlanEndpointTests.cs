using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlanTemplates;

/// <summary>
/// Testcontainers integration tests for <c>POST /nutrition/plan-templates/from-plan</c> (#861) —
/// verbatim content copy with client-only fields stripped, and the shaped 404 for a plan the
/// caller doesn't own (identical for missing vs. unowned, since <c>NutritionPlan</c> is not an
/// <see cref="Application.Domain.Documents.ILibraryDocument"/>).
/// </summary>
[Collection(TestCollection.Name)]
public class CreateTemplateFromPlanEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@from-plan-{tag}.com";

    private async Task<(HttpClient Client, Guid UserId)> RegisterNutritionistAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Nutritionist", "Nutritionist");
        var (token, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    private async Task SeedPlanAsync(NutritionPlan plan)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
    }

    private async Task<NutritionPlanTemplate> FetchTemplateAsync(Guid externalId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.NutritionPlanTemplates
            .Find(t => t.ExternalId == externalId)
            .FirstAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task FromPlan_OwnedPlan_CopiesContentAndStripsClientOnlyFields()
    {
        var (nutritionist, nutritionistId) = await RegisterNutritionistAsync("owned");

        // The route authorizes on the caller's live link to the plan's client, not on authorship
        // alone, so the source plan needs a real linked client rather than a fabricated id.
        var clientUserId = await TestHelpers.RegisterLinkedClientAsync(
            factory, nutritionistId, TestContext.Current.CancellationToken);

        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            NutritionistId = nutritionistId,
            Name = "Source Plan",
            Status = NutritionPlanStatus.Active,
            Goal = PrimaryGoal.LoseFat,
            TargetWeightKg = 70,
            StartDate = DateTime.UtcNow.Date,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Supplements = [new Supplement { ExternalId = Guid.NewGuid(), Name = "Omega-3" }],
            Weeks =
            [
                new PlanWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days =
                    [
                        new PlanDay
                        {
                            DayOfWeek = 1,
                            Meals = [new PlanMeal { MealId = Guid.NewGuid(), Kind = MealKind.Breakfast, Order = 1 }]
                        }
                    ]
                }
            ]
        };
        await SeedPlanAsync(plan);

        var response = await nutritionist.PostAsJsonAsync("/nutrition/plan-templates/from-plan", new
        {
            PlanId = plan.ExternalId,
            Name = "Template From Plan"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<TemplateSummaryDto>(
            cancellationToken: TestContext.Current.CancellationToken);
        body.Should().NotBeNull();

        var template = await FetchTemplateAsync(body!.TemplateId);
        template.Goal.Should().Be(PrimaryGoal.LoseFat, "Goal copies through from the plan");
        template.Weeks.Should().HaveCount(1);
        template.Weeks[0].Days[0].Meals.Should().ContainSingle();
        template.Supplements.Should().ContainSingle(s => s.Name == "Omega-3");
        template.Supplements[0].ExternalId.Should().NotBe(
            plan.Supplements[0].ExternalId, "from-plan mints a fresh Supplement.ExternalId");
    }

    [Fact]
    public async Task FromPlan_PlanOwnedByAnotherNutritionist_Returns404()
    {
        var otherOwnerId = Guid.NewGuid();
        var (nutritionist, _) = await RegisterNutritionistAsync("unowned");

        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            NutritionistId = otherOwnerId,
            Name = "Other's Plan",
            Status = NutritionPlanStatus.Draft,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Weeks = [new PlanWeek { WeekNumber = 1 }]
        };
        await SeedPlanAsync(plan);

        var response = await nutritionist.PostAsJsonAsync("/nutrition/plan-templates/from-plan", new
        {
            PlanId = plan.ExternalId,
            Name = "Stolen Template"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var responseBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        responseBody.Should().Contain("NUTRITION_PLAN_TEMPLATE_NOT_FOUND");
    }

    [Fact]
    public async Task FromPlan_MissingPlan_Returns404SameCodeAsUnowned()
    {
        var (nutritionist, _) = await RegisterNutritionistAsync("missing");

        var response = await nutritionist.PostAsJsonAsync("/nutrition/plan-templates/from-plan", new
        {
            PlanId = Guid.NewGuid(),
            Name = "Template"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var responseBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        responseBody.Should().Contain("NUTRITION_PLAN_TEMPLATE_NOT_FOUND");
    }

    private sealed class TemplateSummaryDto
    {
        public Guid TemplateId { get; set; }
    }
}
