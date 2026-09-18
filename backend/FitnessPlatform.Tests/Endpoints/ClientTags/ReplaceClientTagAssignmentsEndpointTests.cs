using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.ClientTags;

/// <summary>
/// Integration tests for <c>PUT /trainer/clients/{ClientId}/tags</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class ReplaceClientTagAssignmentsEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@replace-client-tags-{tag}.com";

    [Fact]
    public async Task Replace_ValidTagIds_Returns200AndAssignsTags()
    {
        var (http, professionalUserId) = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP");
        var clientPublicId = await SetupLinkedClientAsync(professionalUserId, true, true);

        var response = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = new[] { tagId } },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ReplaceResponseDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Tags.Should().ContainSingle(t => t.TagId == tagId);
    }

    [Fact]
    public async Task Replace_ConcurrentIdenticalReplace_NeverReturns500()
    {
        // Two overlapping replace calls for the same client/link with the same desired tag set
        // both compute the same insert for (ClientTagId, ClientProfessionalLinkId) and race on the
        // unique index. The endpoint treats the collision as "the desired state is already true"
        // rather than a conflict, so both calls must succeed with 200 — never 500, never 409.
        var (http, professionalUserId) = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP");
        var clientPublicId = await SetupLinkedClientAsync(professionalUserId, true, true);
        var payload = new { TagIds = new[] { tagId } };

        var firstCall = http.PutAsJsonAsync(
            $"/trainer/clients/{clientPublicId}/tags", payload, TestContext.Current.CancellationToken);
        var secondCall = http.PutAsJsonAsync(
            $"/trainer/clients/{clientPublicId}/tags", payload, TestContext.Current.CancellationToken);

        var responses = await Task.WhenAll(firstCall, secondCall);

        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
    }

    [Fact]
    public async Task Replace_EmptyTagIds_ClearsAssignments()
    {
        var (http, professionalUserId) = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP");
        var clientPublicId = await SetupLinkedClientAsync(professionalUserId, true, true);

        var assign = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = new[] { tagId } },
            TestContext.Current.CancellationToken);
        assign.StatusCode.Should().Be(HttpStatusCode.OK);

        var clear = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = Array.Empty<Guid>() },
            TestContext.Current.CancellationToken);

        clear.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await clear.Content.ReadFromJsonAsync<ReplaceResponseDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Tags.Should().BeEmpty();
    }

    [Fact]
    public async Task Replace_UnknownTagId_Returns404NoPartialAssignment()
    {
        var (http, professionalUserId) = await SetupTrainerAsync();
        var realTagId = await CreateTagAsync(http, "VIP");
        var clientPublicId = await SetupLinkedClientAsync(professionalUserId, true, true);

        var response = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = new[] { realTagId, Guid.NewGuid() } },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientProfile = await db.ClientProfiles.AsNoTracking()
            .FirstAsync(cp => cp.PublicId == clientPublicId, TestContext.Current.CancellationToken);
        var link = await db.ClientProfessionalLinks.AsNoTracking()
            .FirstAsync(l => l.ClientProfileId == clientProfile.Id, TestContext.Current.CancellationToken);
        var assignmentCount = await db.ClientTagAssignments.AsNoTracking()
            .CountAsync(a => a.ClientProfessionalLinkId == link.Id, TestContext.Current.CancellationToken);
        assignmentCount.Should().Be(0, "a rejected request must not partially assign the valid tag");
    }

    [Fact]
    public async Task Replace_OtherProfessionalsTag_Returns404()
    {
        var (owner, _) = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(owner, "VIP");

        var (otherTrainer, otherUserId) = await SetupTrainerAsync();
        var clientPublicId = await SetupLinkedClientAsync(otherUserId, true, true);

        var response = await otherTrainer.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = new[] { tagId } },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Replace_ClientNotFound_Returns404()
    {
        var (http, _) = await SetupTrainerAsync();

        var response = await http.PutAsJsonAsync($"/trainer/clients/{Guid.NewGuid()}/tags",
            new { TagIds = Array.Empty<Guid>() },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Replace_NoActiveLink_Returns404()
    {
        var (http, _) = await SetupTrainerAsync();
        var (_, unrelatedUserId) = await SetupTrainerAsync();
        var clientPublicId = await SetupLinkedClientAsync(unrelatedUserId, true, true);

        var response = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = Array.Empty<Guid>() },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Replace_ArchivedLink_Returns404()
    {
        var (http, professionalUserId) = await SetupTrainerAsync();
        var clientPublicId = await SetupLinkedClientAsync(professionalUserId, true, true);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var clientProfile = await db.ClientProfiles
                .FirstAsync(cp => cp.PublicId == clientPublicId, TestContext.Current.CancellationToken);
            var link = await db.ClientProfessionalLinks
                .FirstAsync(l => l.ClientProfileId == clientProfile.Id, TestContext.Current.CancellationToken);
            link.IsActive = false;
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = Array.Empty<Guid>() },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Replace_LinkGrantsNoCapabilityFlags_StillSucceeds()
    {
        // Tagging is coach-private relationship metadata, not plan data — a live link is
        // enough, neither CanViewNutritionPlans nor CanViewTrainingPlans is required.
        var (http, professionalUserId) = await SetupTrainerAsync();
        var tagId = await CreateTagAsync(http, "VIP");
        var clientPublicId = await SetupLinkedClientAsync(
            professionalUserId, canViewNutritionPlans: false, canViewTrainingPlans: false);

        var response = await http.PutAsJsonAsync($"/trainer/clients/{clientPublicId}/tags",
            new { TagIds = new[] { tagId } },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private async Task<(HttpClient Http, Guid UserId)> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.AsNoTracking()
            .FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);

        return (http, user.Id);
    }

    private async Task<Guid> SetupLinkedClientAsync(
        Guid professionalUserId, bool canViewNutritionPlans, bool canViewTrainingPlans)
    {
        var clientUserId = await TestHelpers.RegisterLinkedClientAsync(
            factory, professionalUserId, TestContext.Current.CancellationToken,
            canViewNutritionPlans, canViewTrainingPlans);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientProfile = await db.ClientProfiles.AsNoTracking()
            .FirstAsync(cp => cp.UserId == clientUserId, TestContext.Current.CancellationToken);

        return clientProfile.PublicId;
    }

    private static async Task<Guid> CreateTagAsync(HttpClient http, string name)
    {
        var response = await http.PostAsJsonAsync("/trainer/client-tags",
            new { Name = name, Description = (string?)null, ColorHex = "#3b82f6" },
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

    private sealed class ReplaceResponseDto
    {
        public Guid ClientId { get; set; }
        public List<ClientTagDto> Tags { get; set; } = [];
    }
}
