using System.Net;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.MealTemplates;

/// <summary>
/// Full-pipeline role-gate tests for the meal-template feature (#859). <c>LibraryAccessGuard</c>'s
/// own remarks state that role authorization is the endpoint's precondition, not something the
/// guard enforces — <c>CanRead</c> returns <c>true</c> for any caller on a Public entry. Without
/// an explicit <c>Roles(AppRoles.Nutritionist)</c> check on every route, a Trainer could enumerate
/// and read nutritionist meal templates through search and detail. These tests exercise the real
/// ASP.NET Core authorization pipeline (unlike the Testcontainers <c>HandleAsync</c>-direct tests
/// in <c>MealTemplateEndpointTests</c>, which bypass role middleware entirely), so this is the
/// only place the role gate is actually proven, not merely assumed from <c>Configure()</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class MealTemplateRoleGateIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@mealtemplate-rolegate-{tag}.com";

    private async Task<HttpClient> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        return http;
    }

    [Fact]
    public async Task Search_TrainerRole_Returns403()
    {
        var http = await SetupTrainerAsync();

        var response = await http.GetAsync(
            "/nutrition/meal-templates", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetDetail_TrainerRoleOnPublicTemplate_Returns403()
    {
        var http = await SetupTrainerAsync();

        // A Trainer must be refused before any ownership/visibility check runs — even against
        // a route param for a template that does not exist, the role gate rejects first.
        var response = await http.GetAsync(
            $"/nutrition/meal-templates/{Guid.NewGuid()}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
