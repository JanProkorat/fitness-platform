using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Integration tests for <c>GET /trainer/clients/pending</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class GetPendingClientsEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@get-pending-clients-{tag}.com";

    [Fact]
    public async Task Get_MergesInvitesAndRequests_OrderedBySentAtDescending()
    {
        var (http, trainerId) = await SetupTrainerAsync();

        var invitePublicId = await SeedInviteAsync(trainerId, "invited@test.com", sentAt: DateTime.UtcNow.AddDays(-2));
        var requestPublicId = await SeedRequestAsync(trainerId, sentAt: DateTime.UtcNow.AddDays(-1));

        var response = await http.GetAsync("/trainer/clients/pending", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Deserialize(response);

        body!.Rows.Should().HaveCount(2);
        body.Rows[0].PublicId.Should().Be(requestPublicId, "the more recent row (the request) sorts first");
        body.Rows[0].Kind.Should().Be("Request");
        body.Rows[1].PublicId.Should().Be(invitePublicId);
        body.Rows[1].Kind.Should().Be("Invite");
    }

    [Fact]
    public async Task Get_AcceptedInviteAndNonPendingRequest_AreExcluded()
    {
        var (http, trainerId) = await SetupTrainerAsync();

        await SeedInviteAsync(trainerId, "accepted@test.com", sentAt: DateTime.UtcNow, isAccepted: true);
        await SeedRequestAsync(trainerId, sentAt: DateTime.UtcNow, status: ClientRequestStatus.Accepted);

        var response = await http.GetAsync("/trainer/clients/pending", TestContext.Current.CancellationToken);
        var body = await Deserialize(response);

        body!.Rows.Should().BeEmpty();
    }

    [Fact]
    public async Task Get_NoProfessionalProfile_Returns404NotEmptyList()
    {
        // Deliberately NOT the 200-empty shape GetIncomingRequestsEndpoint uses for this case —
        // both tabs of one page must behave alike.
        var http = factory.CreateClient();
        var email = UniqueEmail("no-profile");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            var profile = await db.ProfessionalProfiles
                .FirstAsync(pp => pp.UserId == user.Id, TestContext.Current.CancellationToken);
            db.ProfessionalProfiles.Remove(profile);
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await http.GetAsync("/trainer/clients/pending", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PendingRoute_ResolvesToPendingEndpoint_NotToClientIdRouteParam()
    {
        // Literal segments outrank route parameters in FastEndpoints, so /trainer/clients/pending
        // must reach THIS endpoint rather than GET /trainer/clients/{clientId} (which would try
        // to parse "pending" as a client id and 404/400 in an unrelated way). Asserting the
        // response carries this endpoint's own "rows" shape (not a client-dashboard shape) proves
        // the route resolved correctly.
        var (http, _) = await SetupTrainerAsync();

        var response = await http.GetAsync("/trainer/clients/pending", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        json.Should().Contain("rows", "the pending endpoint's own response shape must be reached, not the client dashboard's");
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

    private async Task<Guid> SeedInviteAsync(
        Guid professionalUserId, string email, DateTime sentAt, bool isAccepted = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var professionalProfile = await db.ProfessionalProfiles
            .FirstAsync(pp => pp.UserId == professionalUserId, TestContext.Current.CancellationToken);

        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = professionalProfile.Id,
            Email = email,
            SentAt = sentAt,
            IsAccepted = isAccepted
        };
        db.PendingInvites.Add(invite);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return invite.PublicId;
    }

    private async Task<Guid> SeedRequestAsync(
        Guid professionalUserId, DateTime sentAt, ClientRequestStatus status = ClientRequestStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var professionalProfile = await db.ProfessionalProfiles
            .FirstAsync(pp => pp.UserId == professionalUserId, TestContext.Current.CancellationToken);

        var requesterEmail = UniqueEmail("requester");
        var requesterHttp = factory.CreateClient();
        await TestHelpers.RegisterAsync(requesterHttp, requesterEmail, "TestPass1!", "Requester", "Client", "Client");

        var requesterUser = await db.Users.FirstAsync(
            u => u.Email == requesterEmail, TestContext.Current.CancellationToken);
        var requesterProfile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == requesterUser.Id, TestContext.Current.CancellationToken);

        var request = new ClientRequest
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = requesterProfile.Id,
            ProfessionalProfileId = professionalProfile.Id,
            Status = status,
            SentAt = sentAt
        };
        db.ClientRequests.Add(request);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return request.PublicId;
    }

    private static async Task<GetPendingClientsResponseDto?> Deserialize(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<GetPendingClientsResponseDto>(
            JsonOptions, TestContext.Current.CancellationToken);

    private sealed class GetPendingClientsResponseDto
    {
        public List<PendingClientRowDto> Rows { get; set; } = [];
    }

    private sealed class PendingClientRowDto
    {
        public string Kind { get; set; } = string.Empty;
        public Guid PublicId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Message { get; set; }
        public DateTime SentAt { get; set; }
    }
}
