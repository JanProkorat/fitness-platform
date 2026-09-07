using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// End-to-end coverage for the profession-occupancy pre-check on BOTH coach-initiated invite
/// paths — POST /trainer/pending-invites and POST /trainer/clients/invite: a professional may
/// only invite a client who has no active coach in the profession the invite would grant.
/// </summary>
/// <remarks>
/// The authoritative occupancy check is the one at accept time — it runs inside the row lock
/// (#1009) and is what protects the invariant, since the client's links can change between
/// invite and accept. This pre-check exists so the inviting professional is told immediately
/// instead of the client hitting a 400 days later on a link they were never able to form.
/// These tests therefore pin *when* the rejection happens, not just that it happens.
///
/// Both paths are covered deliberately. They are separate endpoints with separate accept flows
/// (a PendingInvite redeemed by AcceptClientInviteEndpoint, and an InvitationToken redeemed by
/// AcceptInvitationEndpoint), and a rule enforced on only one of them is not enforced at all.
/// </remarks>
[Collection(TestCollection.Name)]
public class CreatePendingInviteProfessionSlotTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.com";

    /// <summary>
    /// Registers a coach in <paramref name="role"/> and returns an authenticated client for them.
    /// </summary>
    private async Task<HttpClient> RegisterCoachAsync(string role)
    {
        var http = factory.CreateClient();
        var email = UniqueEmail($"slot-coach-{role.ToLower()}");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Slot", "Coach", role);
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);
        return http;
    }

    private static async Task<HttpResponseMessage> InviteAsync(HttpClient coach, string clientEmail) =>
        await coach.PostAsJsonAsync("/trainer/pending-invites", new
        {
            FirstName = "Slot",
            LastName = "Client",
            Email = clientEmail
        }, TestContext.Current.CancellationToken);

    private static async Task<HttpResponseMessage> InviteViaTokenAsync(HttpClient coach, string clientEmail) =>
        await coach.PostAsJsonAsync("/trainer/clients/invite", new
        {
            Email = clientEmail
        }, TestContext.Current.CancellationToken);

    /// <summary>
    /// Gives <paramref name="clientEmail"/> a live link to a fresh coach in
    /// <paramref name="role"/>, by the real invite-then-accept route rather than a seeded row.
    /// </summary>
    private async Task EstablishLinkAsync(string clientEmail, string role)
    {
        var ct = TestContext.Current.CancellationToken;

        var coach = await RegisterCoachAsync(role);
        var inviteResponse = await InviteAsync(coach, clientEmail);
        inviteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var invite = await inviteResponse.Content.ReadFromJsonAsync<CreatePendingInviteResult>(
            cancellationToken: ct);

        var clientHttp = factory.CreateClient();
        var (clientToken, _) = await TestHelpers.LoginAsync(clientHttp, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientHttp, clientToken);

        var acceptResponse = await clientHttp.PostAsJsonAsync(
            $"/client/invites/{invite!.PublicId}/accept", new { }, ct);
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    private async Task<string> RegisterClientAsync(string prefix)
    {
        var email = UniqueEmail(prefix);
        var response = await TestHelpers.RegisterAsync(
            factory.CreateClient(), email, "TestPass1!", "Slot", "Client", "Client");
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return email;
    }

    /// <summary>
    /// The case this pre-check was added for: the client already has a live nutritionist, so a
    /// second nutritionist's invite is refused up front rather than at accept time.
    /// </summary>
    [Fact]
    public async Task CreateInvite_ClientAlreadyHasNutritionist_SecondNutritionistIsRejected()
    {
        var clientEmail = await RegisterClientAsync("slot-taken-client");
        await EstablishLinkAsync(clientEmail, "Nutritionist");

        var secondNutritionist = await RegisterCoachAsync("Nutritionist");
        var response = await InviteAsync(secondNutritionist, clientEmail);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest,
            "the nutrition slot is occupied, so the invite can never be accepted");

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("PROFESSION_ALREADY_OCCUPIED",
            "the rejection must carry the same coded error the accept path uses, so clients can "
            + "branch on it identically wherever it surfaces");
    }

    /// <summary>
    /// The rule is per-profession, not per-client: a client with a trainer is still invitable by
    /// a nutritionist. Without this, the pre-check would block the platform's normal shape.
    /// </summary>
    [Fact]
    public async Task CreateInvite_ClientHasTrainerOnly_NutritionistInviteIsAllowed()
    {
        var clientEmail = await RegisterClientAsync("slot-trainer-client");
        await EstablishLinkAsync(clientEmail, "Trainer");

        var nutritionist = await RegisterCoachAsync("Nutritionist");
        var response = await InviteAsync(nutritionist, clientEmail);

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "the training slot being taken says nothing about the nutrition slot");
    }

    /// <summary>
    /// The overwhelmingly common case, and the one that must not regress: a prospective client
    /// with no account at all. There is no ClientProfile and no link, so the pre-check is
    /// skipped rather than tripping on a missing row.
    /// </summary>
    [Fact]
    public async Task CreateInvite_InviteeHasNoAccountYet_IsAllowed()
    {
        var coach = await RegisterCoachAsync("Nutritionist");
        var response = await InviteAsync(coach, UniqueEmail("slot-prospective"));

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "a prospective client has no links to collide with");
    }

    /// <summary>
    /// A registered client who simply has no coach yet — distinct from the case above, because
    /// here the ClientProfile row DOES exist and the link query actually runs.
    /// </summary>
    [Fact]
    public async Task CreateInvite_RegisteredClientWithNoCoach_IsAllowed()
    {
        var clientEmail = await RegisterClientAsync("slot-free-client");

        var coach = await RegisterCoachAsync("Nutritionist");
        var response = await InviteAsync(coach, clientEmail);

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "the profile exists but occupies no profession slot");
    }

    /// <summary>
    /// The token-based invite path (<c>POST /trainer/clients/invite</c>) must refuse the same
    /// case. It is a separate endpoint feeding a separate accept flow, so leaving it unguarded
    /// would leave the rule enforceable only at accept time on that route.
    /// </summary>
    [Fact]
    public async Task InviteViaToken_ClientAlreadyHasNutritionist_SecondNutritionistIsRejected()
    {
        var clientEmail = await RegisterClientAsync("token-slot-taken-client");
        await EstablishLinkAsync(clientEmail, "Nutritionist");

        var secondNutritionist = await RegisterCoachAsync("Nutritionist");
        var response = await InviteViaTokenAsync(secondNutritionist, clientEmail);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest,
            "the nutrition slot is occupied, so the token could never be redeemed");

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("PROFESSION_ALREADY_OCCUPIED",
            "both invite paths must emit the same coded error");
    }

    /// <summary>
    /// Per-profession on the token path too — a client with a trainer is still invitable by a
    /// nutritionist.
    /// </summary>
    [Fact]
    public async Task InviteViaToken_ClientHasTrainerOnly_NutritionistInviteIsAllowed()
    {
        var clientEmail = await RegisterClientAsync("token-slot-trainer-client");
        await EstablishLinkAsync(clientEmail, "Trainer");

        var nutritionist = await RegisterCoachAsync("Nutritionist");
        var response = await InviteViaTokenAsync(nutritionist, clientEmail);

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "the training slot being taken says nothing about the nutrition slot");
    }

    /// <summary>
    /// The common case on the token path: a prospective client with no account at all.
    /// </summary>
    [Fact]
    public async Task InviteViaToken_InviteeHasNoAccountYet_IsAllowed()
    {
        var coach = await RegisterCoachAsync("Nutritionist");
        var response = await InviteViaTokenAsync(coach, UniqueEmail("token-slot-prospective"));

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "a prospective client has no links to collide with");
    }

    private record CreatePendingInviteResult(Guid PublicId);
}
