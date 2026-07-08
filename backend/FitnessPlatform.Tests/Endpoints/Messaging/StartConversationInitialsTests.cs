using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Integration tests for the initials-fallback fix in
/// <c>StartConversationEndpoint</c> (issue #653). Apple Sign-In lets a user
/// decline to share their name, persisting <c>FirstName</c>/<c>LastName</c>
/// as <c>""</c>. Naively slicing the first character
/// (<c>otherUser.FirstName[..1]</c>) threw <see cref="ArgumentOutOfRangeException"/>
/// on empty strings, producing an uncaught 500. <c>RegisterEndpoint</c>
/// rejects empty names, so the repro user is seeded directly via a DB scope
/// (the <c>ParticipantAvatarTests</c> pattern) after normal registration.
/// </summary>
[Collection(TestCollection.Name)]
public class StartConversationInitialsTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@msg-initials-test.com";
    private const string Password = "TestPass1!";

    private async Task BlankOutNameAsync(string email, string? firstName, string? lastName)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider
            .GetRequiredService<FitnessPlatform.Application.Infrastructure.Data.ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email,
            TestContext.Current.CancellationToken);
        if (firstName is not null) user.FirstName = firstName;
        if (lastName is not null) user.LastName = lastName;
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Both FirstName and LastName empty (Apple name decline), new
    /// conversation path (StartConversationEndpoint.cs ~line 122). Must
    /// return 200 with a fallback initial instead of a 500.
    /// </summary>
    [Fact]
    public async Task StartConversation_BothNamesEmpty_NewConversation_Returns200WithFallbackInitial()
    {
        var http = factory.CreateClient();

        var trainerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(http, trainerEmail, Password, "Placeholder", "Name", "Trainer");
        await BlankOutNameAsync(trainerEmail, firstName: "", lastName: "");

        Guid profPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<FitnessPlatform.Application.Infrastructure.Data.ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(
                p => p.UserId == userId,
                TestContext.Current.CancellationToken);
            profPublicId = profile.PublicId;
        }

        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, Password, "Bob", "Client", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(clientHttp, clientEmail, Password);
        TestHelpers.SetBearerToken(clientHttp, clientToken);

        var resp = await clientHttp.PostAsJsonAsync(
            "/conversations",
            new { ParticipantId = profPublicId },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.OK,
            "an empty-named participant must produce a fallback initial, not an uncaught 500");
        var body = await resp.Content.ReadFromJsonAsync<ConversationResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Participant.Initials.Should().NotBeNullOrEmpty();
        body.Participant.Initials.Should().Be(trainerEmail[..1].ToUpperInvariant(),
            "with both names empty the fallback uses the participant's email initial");
    }

    /// <summary>
    /// Both names empty on an ALREADY-EXISTING conversation — exercises the
    /// existing-conversation branch (StartConversationEndpoint.cs ~line 94),
    /// which must be guarded identically to the new-conversation branch.
    /// </summary>
    [Fact]
    public async Task StartConversation_BothNamesEmpty_ExistingConversation_Returns200WithFallbackInitial()
    {
        var http = factory.CreateClient();

        var trainerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(http, trainerEmail, Password, "Placeholder", "Name", "Trainer");
        await BlankOutNameAsync(trainerEmail, firstName: "", lastName: "");

        Guid profPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<FitnessPlatform.Application.Infrastructure.Data.ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(
                p => p.UserId == userId,
                TestContext.Current.CancellationToken);
            profPublicId = profile.PublicId;
        }

        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, Password, "Bob", "Client", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(clientHttp, clientEmail, Password);
        TestHelpers.SetBearerToken(clientHttp, clientToken);

        // First call creates the conversation (new-conversation branch).
        var createResp = await clientHttp.PostAsJsonAsync(
            "/conversations",
            new { ParticipantId = profPublicId },
            TestContext.Current.CancellationToken);
        createResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // Second call hits the existing-conversation branch.
        var existingResp = await clientHttp.PostAsJsonAsync(
            "/conversations",
            new { ParticipantId = profPublicId },
            TestContext.Current.CancellationToken);

        existingResp.StatusCode.Should().Be(HttpStatusCode.OK,
            "the existing-conversation branch must be guarded identically to the new-conversation branch");
        var body = await existingResp.Content.ReadFromJsonAsync<ConversationResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Participant.Initials.Should().Be(trainerEmail[..1].ToUpperInvariant());
    }

    /// <summary>
    /// Partial-empty: only LastName is blank. The fallback must surface the
    /// single available initial rather than crashing on the empty side.
    /// </summary>
    [Fact]
    public async Task StartConversation_LastNameEmpty_ReturnsSingleAvailableInitial()
    {
        var http = factory.CreateClient();

        var trainerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(http, trainerEmail, Password, "Zoe", "Placeholder", "Trainer");
        await BlankOutNameAsync(trainerEmail, firstName: null, lastName: "");

        Guid profPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<FitnessPlatform.Application.Infrastructure.Data.ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(
                p => p.UserId == userId,
                TestContext.Current.CancellationToken);
            profPublicId = profile.PublicId;
        }

        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, Password, "Bob", "Client", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(clientHttp, clientEmail, Password);
        TestHelpers.SetBearerToken(clientHttp, clientToken);

        var resp = await clientHttp.PostAsJsonAsync(
            "/conversations",
            new { ParticipantId = profPublicId },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<ConversationResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Participant.Initials.Should().Be("Z", "only FirstName is available so its single initial is used");
    }

    /// <summary>
    /// Happy path: both names populated normally — unaffected by the fix.
    /// </summary>
    [Fact]
    public async Task StartConversation_BothNamesPresent_ReturnsTwoLetterInitials()
    {
        var http = factory.CreateClient();

        var trainerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(http, trainerEmail, Password, "Alice", "Trainer", "Trainer");

        Guid profPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<FitnessPlatform.Application.Infrastructure.Data.ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(
                p => p.UserId == userId,
                TestContext.Current.CancellationToken);
            profPublicId = profile.PublicId;
        }

        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, Password, "Bob", "Client", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(clientHttp, clientEmail, Password);
        TestHelpers.SetBearerToken(clientHttp, clientToken);

        var resp = await clientHttp.PostAsJsonAsync(
            "/conversations",
            new { ParticipantId = profPublicId },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<ConversationResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Participant.Initials.Should().Be("AT");
    }

    // ── Local response DTOs (per slice rules — no cross-feature imports) ─────

    private record ParticipantResponse(Guid Id, string Name, string Initials);
    private record ConversationResponse(Guid Id, ParticipantResponse Participant);
}
