using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Trainers;

/// <summary>
/// Integration tests for the collaboration endpoint: POST /trainer/collaborations.
/// </summary>
[Collection(TestCollection.Name)]
public class CollaborationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@test.com";

    [Fact]
    public async Task CreateCollaboration_ValidRequest_Returns201()
    {
        var client = factory.CreateClient();

        // Set up trainer A with a linked client
        var trainerAEmail = UniqueEmail();
        var trainerAToken = await RegisterAndLoginTrainer(client, trainerAEmail);

        // Set up trainer B
        var trainerBEmail = UniqueEmail();
        await RegisterAndLoginTrainer(client, trainerBEmail);

        // Create a client and link to trainer A
        var clientEmail = UniqueEmail();
        TestHelpers.SetBearerToken(client, trainerAToken);
        var inviteResp = await client.PostAsJsonAsync("/trainer/clients/invite", new { Email = clientEmail }, cancellationToken: TestContext.Current.CancellationToken);
        var invite = await inviteResp.Content.ReadFromJsonAsync<InviteResult>(cancellationToken: TestContext.Current.CancellationToken);

        await TestHelpers.RegisterAsync(client, clientEmail, "TestPass1!", "Client", "User", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(client, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(client, clientToken);
        await client.PostAsJsonAsync("/auth/invite/accept", new { Token = invite!.InvitationToken }, cancellationToken: TestContext.Current.CancellationToken);

        // Get IDs
        TestHelpers.SetBearerToken(client, trainerAToken);
        var clientsResp = await client.GetAsync("/trainer/clients", TestContext.Current.CancellationToken);
        var clients = await clientsResp.Content.ReadFromJsonAsync<ClientsResult>(cancellationToken: TestContext.Current.CancellationToken);
        var clientPublicId = clients!.Clients.First(c => c.Email == clientEmail).PublicId;

        var trainerBPublicId = await GetTrainerPublicId(trainerBEmail);

        // Trainer A creates collaboration with trainer B
        var response = await client.PostAsJsonAsync("/trainer/collaborations", new
        {
            ClientPublicId = clientPublicId,
            CollaboratorPublicId = trainerBPublicId
        }, cancellationToken: TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateCollaboration_NoActiveLink_Returns400()
    {
        var client = factory.CreateClient();

        // Set up two trainers, neither linked to any client
        var trainerAEmail = UniqueEmail();
        var trainerAToken = await RegisterAndLoginTrainer(client, trainerAEmail);

        var trainerBEmail = UniqueEmail();
        await RegisterAndLoginTrainer(client, trainerBEmail);

        var trainerBPublicId = await GetTrainerPublicId(trainerBEmail);

        TestHelpers.SetBearerToken(client, trainerAToken);

        var response = await client.PostAsJsonAsync("/trainer/collaborations", new
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = trainerBPublicId
        }, cancellationToken: TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateCollaboration_AsClient_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Client", "User", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PostAsJsonAsync("/trainer/collaborations", new
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = Guid.NewGuid()
        }, cancellationToken: TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateCollaboration_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/trainer/collaborations", new
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = Guid.NewGuid()
        }, cancellationToken: TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private async Task<string> RegisterAndLoginTrainer(HttpClient client, string email)
    {
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Trainer", "User", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<Application.Infrastructure.Data.ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email);

        if (!await db.TrainerProfiles.AnyAsync(tp => tp.UserId == user.Id))
        {
            db.TrainerProfiles.Add(new Application.Domain.Entities.TrainerProfile
            {
                UserId = user.Id,
                Bio = "Test trainer",
                Specialization = "Testing"
            });
            await db.SaveChangesAsync();
        }

        return accessToken;
    }

    private async Task<Guid> GetTrainerPublicId(string email)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<Application.Infrastructure.Data.ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email);
        var profile = await db.TrainerProfiles.FirstAsync(tp => tp.UserId == user.Id);
        return profile.PublicId;
    }

    private record InviteResult(string Message, string InvitationToken);
    private record ClientSummary(Guid PublicId, string Email, string FirstName, string LastName, bool IsActive);
    private record ClientsResult(List<ClientSummary> Clients, int TotalCount, int Page, int PageSize);
}
