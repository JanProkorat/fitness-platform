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
/// Testcontainers integration tests (real PostgreSQL + MongoDB) for the nutrition-plan-template
/// sharing library (#861) — the read/write/read-guarded-write visibility matrix across the
/// three guard classes (<c>GET</c>/search, <c>PUT</c>/<c>DELETE</c>, <c>copy</c>), the
/// Nutritionist role gate, hard-delete semantics, and server-computed <c>WeekCount</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class NutritionPlanTemplateEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@plan-templates-{tag}.com";

    private async Task<(HttpClient Client, Guid UserId)> RegisterAsync(string role, string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", role, role);
        var (token, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    private async Task<Guid> SeedOwnerAsync(string tag)
    {
        var (_, ownerId) = await RegisterAsync("Nutritionist", tag);
        return ownerId;
    }

    private async Task SeedTemplateAsync(NutritionPlanTemplate template)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.NutritionPlanTemplates.InsertOneAsync(
            template, cancellationToken: TestContext.Current.CancellationToken);
    }

    private async Task<NutritionPlanTemplate?> FetchTemplateAsync(Guid externalId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.NutritionPlanTemplates
            .Find(t => t.ExternalId == externalId)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    private static NutritionPlanTemplate BuildTemplate(
        Guid ownerId, LibraryVisibility visibility = LibraryVisibility.Private, int weekCount = 1) => new()
    {
        ExternalId = Guid.NewGuid(),
        OwnerId = ownerId,
        Name = "Test Template",
        Visibility = visibility,
        Version = 1,
        DateCreated = DateTime.UtcNow,
        Weeks =
        [
            new TemplateWeek
            {
                WeekNumber = 1,
                Days = Enumerable.Range(1, 7).Select(d => new PlanDay { DayOfWeek = d, Meals = [] }).ToList()
            }
        ],
        WeekCount = weekCount
    };

    // ── role gate ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Search_TrainerRole_Returns403()
    {
        var (trainer, _) = await RegisterAsync("Trainer", "trainer-search");

        var response = await trainer.GetAsync("/nutrition/plan-templates");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetTemplate_TrainerRoleOnPublicTemplate_Returns403()
    {
        var ownerId = await SeedOwnerAsync("owner-role-gate");
        var template = BuildTemplate(ownerId, LibraryVisibility.Public);
        await SeedTemplateAsync(template);

        var (trainer, _) = await RegisterAsync("Trainer", "trainer-get");

        var response = await trainer.GetAsync($"/nutrition/plan-templates/{template.ExternalId}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── visibility matrix: GET (read-guarded read) ───────────────────────────

    [Fact]
    public async Task GetTemplate_OwnPrivate_Returns200()
    {
        var (owner, ownerId) = await RegisterAsync("Nutritionist", "owner-get-private");
        var template = BuildTemplate(ownerId);
        await SeedTemplateAsync(template);

        var response = await owner.GetAsync($"/nutrition/plan-templates/{template.ExternalId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetTemplate_OtherOwnersPublic_Returns200()
    {
        var ownerId = await SeedOwnerAsync("owner-public-readable");
        var template = BuildTemplate(ownerId, LibraryVisibility.Public);
        await SeedTemplateAsync(template);

        var (caller, _) = await RegisterAsync("Nutritionist", "caller-read-public");

        var response = await caller.GetAsync($"/nutrition/plan-templates/{template.ExternalId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetTemplate_OtherOwnersPrivate_Returns404WithNotFoundCode()
    {
        var ownerId = await SeedOwnerAsync("owner-private-hidden");
        var template = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(template);

        var (caller, _) = await RegisterAsync("Nutritionist", "caller-read-private");

        var response = await caller.GetAsync($"/nutrition/plan-templates/{template.ExternalId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NUTRITION_PLAN_TEMPLATE_NOT_FOUND");
    }

    [Fact]
    public async Task GetTemplate_GenuinelyMissing_Returns404ByteIdenticalCodeToPrivateDenial()
    {
        var (caller, _) = await RegisterAsync("Nutritionist", "caller-missing");

        var response = await caller.GetAsync($"/nutrition/plan-templates/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NUTRITION_PLAN_TEMPLATE_NOT_FOUND");
    }

    // ── visibility matrix: PUT / DELETE (write-guarded) ──────────────────────

    [Fact]
    public async Task Put_OtherOwnersPublic_Returns403NotOwned()
    {
        var ownerId = await SeedOwnerAsync("owner-public-put");
        var template = BuildTemplate(ownerId, LibraryVisibility.Public);
        await SeedTemplateAsync(template);

        var (caller, _) = await RegisterAsync("Nutritionist", "caller-put-public");

        var response = await caller.PutAsJsonAsync(
            $"/nutrition/plan-templates/{template.ExternalId}",
            new
            {
                Name = "Hijacked",
                Weeks = new[] { new { WeekNumber = 1, Days = Array.Empty<object>() } },
                Supplements = Array.Empty<object>(),
                Version = template.Version
            });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NUTRITION_PLAN_TEMPLATE_NOT_OWNED");
    }

    /// <summary>
    /// The load-bearing test named explicitly in issue #861: PUT on another owner's Private
    /// template with a STALE Version must still return 404, never 409 — proving the ownership
    /// denial is evaluated before any version comparison.
    /// </summary>
    [Fact]
    public async Task Put_OtherOwnersPrivate_StaleVersion_Returns404NotVersionConflict()
    {
        var ownerId = await SeedOwnerAsync("owner-private-put");
        var template = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(template);

        var (caller, _) = await RegisterAsync("Nutritionist", "caller-put-private-stale");

        var response = await caller.PutAsJsonAsync(
            $"/nutrition/plan-templates/{template.ExternalId}",
            new
            {
                Name = "Hijacked",
                Weeks = new[] { new { WeekNumber = 1, Days = Array.Empty<object>() } },
                Supplements = Array.Empty<object>(),
                Version = 999 // deliberately stale
            });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NUTRITION_PLAN_TEMPLATE_NOT_FOUND");
    }

    [Fact]
    public async Task Put_OwnTemplate_StaleVersion_Returns409()
    {
        var (owner, ownerId) = await RegisterAsync("Nutritionist", "owner-put-own-stale");
        var template = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(template);

        var response = await owner.PutAsJsonAsync(
            $"/nutrition/plan-templates/{template.ExternalId}",
            new
            {
                Name = "Updated",
                Weeks = new[] { new { WeekNumber = 1, Days = Array.Empty<object>() } },
                Supplements = Array.Empty<object>(),
                Version = 999
            });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NUTRITION_PLAN_TEMPLATE_VERSION_CONFLICT");
    }

    [Fact]
    public async Task Delete_OtherOwnersPrivate_Returns404()
    {
        var ownerId = await SeedOwnerAsync("owner-private-delete");
        var template = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(template);

        var (caller, _) = await RegisterAsync("Nutritionist", "caller-delete-private");

        var response = await caller.DeleteAsync($"/nutrition/plan-templates/{template.ExternalId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var stillThere = await FetchTemplateAsync(template.ExternalId);
        stillThere.Should().NotBeNull("a denied delete must not remove the document");
    }

    [Fact]
    public async Task Delete_OwnTemplate_HardDeletes()
    {
        var (owner, ownerId) = await RegisterAsync("Nutritionist", "owner-delete-own");
        var template = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(template);

        var response = await owner.DeleteAsync($"/nutrition/plan-templates/{template.ExternalId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var afterDelete = await FetchTemplateAsync(template.ExternalId);
        afterDelete.Should().BeNull("DELETE must hard-delete — no soft-delete tombstone");
    }

    // ── visibility matrix: copy (read-guarded WRITE) ─────────────────────────

    [Fact]
    public async Task Copy_OtherOwnersPublic_Returns201PrivateClone()
    {
        var ownerId = await SeedOwnerAsync("owner-public-copy");
        var template = BuildTemplate(ownerId, LibraryVisibility.Public);
        await SeedTemplateAsync(template);

        var (caller, callerId) = await RegisterAsync("Nutritionist", "caller-copy-public");

        var response = await caller.PostAsync($"/nutrition/plan-templates/{template.ExternalId}/copy", null);

        response.StatusCode.Should().Be(
            HttpStatusCode.Created,
            "copy is read-guarded, not write-guarded — another owner's Public template must stay copyable");

        var body = await response.Content.ReadFromJsonAsync<TemplateSummaryDto>(
            cancellationToken: TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        body!.OwnerId.Should().Be(callerId);
        body.Visibility.Should().Be("Private");
        body.TemplateId.Should().NotBe(template.ExternalId, "the copy must have a fresh ExternalId");

        var sourceUntouched = await FetchTemplateAsync(template.ExternalId);
        sourceUntouched!.OwnerId.Should().Be(ownerId, "the source template must be untouched");
    }

    [Fact]
    public async Task Copy_OtherOwnersPrivate_Returns404()
    {
        var ownerId = await SeedOwnerAsync("owner-private-copy");
        var template = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(template);

        var (caller, _) = await RegisterAsync("Nutritionist", "caller-copy-private");

        var response = await caller.PostAsync($"/nutrition/plan-templates/{template.ExternalId}/copy", null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── search + WeekCount ────────────────────────────────────────────────────

    [Fact]
    public async Task Search_ReturnsOwnAndPublicOnly()
    {
        var (owner, ownerId) = await RegisterAsync("Nutritionist", "owner-search");

        var ownPrivate = BuildTemplate(ownerId, LibraryVisibility.Private);
        await SeedTemplateAsync(ownPrivate);

        var otherOwnerId = await SeedOwnerAsync("other-owner-search");
        var otherPublic = BuildTemplate(otherOwnerId, LibraryVisibility.Public);
        await SeedTemplateAsync(otherPublic);
        var otherPrivate = BuildTemplate(otherOwnerId, LibraryVisibility.Private);
        await SeedTemplateAsync(otherPrivate);

        var response = await owner.GetAsync("/nutrition/plan-templates?pageSize=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<SearchResponseDto>(
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().NotBeNull();
        var ids = result!.Templates.Select(t => t.TemplateId).ToList();
        ids.Should().Contain(ownPrivate.ExternalId);
        ids.Should().Contain(otherPublic.ExternalId);
        ids.Should().NotContain(otherPrivate.ExternalId);
    }

    [Fact]
    public async Task CreateTemplate_WithWeekCount_ServerComputesWeekCount()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-weekcount");

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Materialized Template",
            WeekCount = 3
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<TemplateSummaryDto>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.WeekCount.Should().Be(3);
    }

    [Fact]
    public async Task CreateTemplate_BothWeekCountAndWeeks_Returns400()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-mutex");

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Invalid Template",
            WeekCount = 2,
            Weeks = new[] { new { WeekNumber = 1, Days = Array.Empty<object>() } }
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── create with a genuinely populated week tree (#861 review — BLOCKING) ─

    [Fact]
    public async Task CreateTemplate_WithPopulatedWeekTree_PersistsFullShape()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-populated");

        var mealId = Guid.NewGuid();
        var foodExternalId = Guid.NewGuid();

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Populated Template",
            Weeks = new[]
            {
                new
                {
                    WeekNumber = 1,
                    Days = new[]
                    {
                        new
                        {
                            DayOfWeek = 1,
                            Meals = new[]
                            {
                                new
                                {
                                    MealId = mealId,
                                    Kind = "Breakfast",
                                    Order = 1,
                                    Foods = new[]
                                    {
                                        new
                                        {
                                            FoodExternalId = foodExternalId,
                                            FoodName = "Oats",
                                            AmountGrams = 80m
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<TemplateSummaryDto>(
            cancellationToken: TestContext.Current.CancellationToken);
        body.Should().NotBeNull();

        var persisted = await FetchTemplateAsync(body!.TemplateId);
        persisted.Should().NotBeNull();
        persisted!.Weeks.Should().ContainSingle().Which.WeekNumber.Should().Be(1);

        var day = persisted.Weeks[0].Days.Should().ContainSingle().Subject;
        day.DayOfWeek.Should().Be(1);

        var meal = day.Meals.Should().ContainSingle().Subject;
        meal.MealId.Should().Be(mealId);
        meal.Kind.Should().Be(MealKind.Breakfast);
        meal.Order.Should().Be(1);

        var food = meal.Foods.Should().ContainSingle().Subject;
        food.FoodExternalId.Should().Be(foodExternalId);
        food.FoodName.Should().Be("Oats");
        food.AmountGrams.Should().Be(80m);
    }

    [Fact]
    public async Task CreateTemplate_DayOfWeekOutOfRange_Returns400()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-dow-invalid");

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Invalid Day",
            Weeks = new[]
            {
                new
                {
                    WeekNumber = 1,
                    Days = new[] { new { DayOfWeek = 99, Meals = Array.Empty<object>() } }
                }
            }
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("OUT_OF_RANGE");
    }

    [Fact]
    public async Task CreateTemplate_DuplicateDayOfWeekWithinWeek_Returns400()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-dow-dup");

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Duplicate Day",
            Weeks = new[]
            {
                new
                {
                    WeekNumber = 1,
                    Days = new[]
                    {
                        new { DayOfWeek = 1, Meals = Array.Empty<object>() },
                        new { DayOfWeek = 1, Meals = Array.Empty<object>() }
                    }
                }
            }
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("OUT_OF_RANGE");
    }

    [Fact]
    public async Task CreateTemplate_DuplicateWeekNumber_Returns400()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-week-dup");

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Duplicate Week",
            Weeks = new[]
            {
                new { WeekNumber = 1, Days = Array.Empty<object>() },
                new { WeekNumber = 1, Days = Array.Empty<object>() }
            }
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("OUT_OF_RANGE");
    }

    [Fact]
    public async Task CreateTemplate_AmountGramsNotPositive_Returns400()
    {
        var (owner, _) = await RegisterAsync("Nutritionist", "owner-create-amount-invalid");

        var response = await owner.PostAsJsonAsync("/nutrition/plan-templates", new
        {
            Name = "Invalid Amount",
            Weeks = new[]
            {
                new
                {
                    WeekNumber = 1,
                    Days = new[]
                    {
                        new
                        {
                            DayOfWeek = 1,
                            Meals = new[]
                            {
                                new
                                {
                                    Kind = "Breakfast",
                                    Order = 1,
                                    Foods = new[]
                                    {
                                        new
                                        {
                                            FoodExternalId = Guid.NewGuid(),
                                            FoodName = "Oats",
                                            AmountGrams = 0m
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("OUT_OF_RANGE");
    }

    private sealed class TemplateSummaryDto
    {
        public Guid TemplateId { get; set; }
        public Guid OwnerId { get; set; }
        public string Visibility { get; set; } = string.Empty;
        public int WeekCount { get; set; }
    }

    private sealed class SearchResponseDto
    {
        public List<TemplateSummaryDto> Templates { get; set; } = [];
    }
}
