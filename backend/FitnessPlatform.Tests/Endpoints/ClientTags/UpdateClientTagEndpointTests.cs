using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.ClientTags;

/// <summary>
/// Integration tests for <c>PUT /trainer/client-tags/{TagId}</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class UpdateClientTagEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@update-client-tag-{tag}.com";

    [Fact]
    public async Task Update_ValidRequest_Returns200AndUpdatesFields()
    {
        var http = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP", "#3b82f6");

        var response = await http.PutAsJsonAsync($"/trainer/client-tags/{tagId}",
            new { Name = "Renamed", Description = "Updated", ColorHex = "#EF4444" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ClientTagDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Name.Should().Be("Renamed");
        body.Description.Should().Be("Updated");
        body.ColorHex.Should().Be("#ef4444");
    }

    [Fact]
    public async Task Update_OtherProfessionalsTag_Returns404()
    {
        var owner = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(owner, "VIP", "#3b82f6");

        var otherTrainer = await SetupTrainerAsync();

        var response = await otherTrainer.PutAsJsonAsync($"/trainer/client-tags/{tagId}",
            new { Name = "Hijacked", Description = (string?)null, ColorHex = "#ef4444" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_NonexistentTag_Returns404()
    {
        var http = await SetupTrainerAsync();

        var response = await http.PutAsJsonAsync($"/trainer/client-tags/{Guid.NewGuid()}",
            new { Name = "Ghost", Description = (string?)null, ColorHex = "#3b82f6" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_DuplicateName_Returns409()
    {
        var http = await SetupTrainerAsync();
        await CreateTagAsync(http, "VIP", "#3b82f6");
        var otherTagId = await CreateTagAsync(http, "New", "#22c55e");

        var response = await http.PutAsJsonAsync($"/trainer/client-tags/{otherTagId}",
            new { Name = "VIP", Description = (string?)null, ColorHex = "#22c55e" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Update_SameTagSameName_Returns200()
    {
        var http = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP", "#3b82f6");

        var response = await http.PutAsJsonAsync($"/trainer/client-tags/{tagId}",
            new { Name = "VIP", Description = "New description", ColorHex = "#3b82f6" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Update_InvalidColorHex_Returns400()
    {
        var http = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP", "#3b82f6");

        var response = await http.PutAsJsonAsync($"/trainer/client-tags/{tagId}",
            new { Name = "VIP", Description = (string?)null, ColorHex = "not-a-color" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<HttpClient> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        return http;
    }

    private static async Task<Guid> CreateTagAsync(HttpClient http, string name, string colorHex)
    {
        var response = await http.PostAsJsonAsync("/trainer/client-tags",
            new { Name = name, Description = (string?)null, ColorHex = colorHex },
            TestContext.Current.CancellationToken);
        var body = await response.Content.ReadFromJsonAsync<ClientTagDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        return body!.TagId;
    }

    private sealed class ClientTagDto
    {
        public Guid TagId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string ColorHex { get; set; } = string.Empty;
    }
}
