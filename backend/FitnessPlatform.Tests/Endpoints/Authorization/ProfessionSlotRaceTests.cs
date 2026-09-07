using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Authorization;

/// <summary>
/// Concurrency coverage for the one-active-coach-per-profession invariant (#1009).
/// </summary>
/// <remarks>
/// #980 added the application-level guard, but the guard's read and the link insert were two
/// separate autocommitting statements: under READ COMMITTED two concurrent requests could both
/// observe the slot as free and both insert. #1009 wraps the pair in a transaction that first
/// takes a <c>FOR NO KEY UPDATE</c> row lock on the client's own <c>client_profiles</c> row —
/// the only row both racers are guaranteed to touch, since neither can see the other's
/// uncommitted link.
///
/// Two tests, deliberately at different levels. The first pins the MECHANISM deterministically
/// (the second racer really does block on the first, and really does see the winner's link once
/// it commits). The second pins the OUTCOME through the HTTP surface. Only the first is
/// timing-independent; the second can serialize by luck on a given run, which is why it is not
/// the only coverage here.
/// </remarks>
[Collection(TestCollection.Name)]
public class ProfessionSlotRaceTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.com";

    /// <summary>
    /// Registers a user and returns their <c>ApplicationUser.Id</c>.
    /// </summary>
    private async Task<Guid> RegisterAndResolveUserIdAsync(string email, string role)
    {
        var http = factory.CreateClient();
        var response = await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Race", "Subject", role);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.AsNoTracking()
            .FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return user.Id;
    }

    /// <summary>
    /// The lock actually serializes: while racer A holds it, racer B cannot proceed past its own
    /// lock acquisition — and once A commits, B's guard read sees A's link and reports the slot
    /// as taken. Deterministic: no sleeps stand in for the ordering, the blocking IS the
    /// assertion.
    /// </summary>
    [Fact]
    public async Task LockClientProfile_SecondCallerBlocksUntilFirstCommits_ThenSeesTheWinnersLink()
    {
        var ct = TestContext.Current.CancellationToken;

        var clientUserId = await RegisterAndResolveUserIdAsync(UniqueEmail("race-client"), "Client");
        var coachAUserId = await RegisterAndResolveUserIdAsync(UniqueEmail("race-coach-a"), "Nutritionist");
        var coachBUserId = await RegisterAndResolveUserIdAsync(UniqueEmail("race-coach-b"), "Nutritionist");

        long clientProfileId;
        long coachAProfileId;
        long coachBProfileId;
        using (var lookupScope = factory.Services.CreateScope())
        {
            var db = lookupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            clientProfileId = (await db.ClientProfiles.AsNoTracking()
                .FirstAsync(cp => cp.UserId == clientUserId, ct)).Id;
            coachAProfileId = (await db.ProfessionalProfiles.AsNoTracking()
                .FirstAsync(pp => pp.UserId == coachAUserId, ct)).Id;
            coachBProfileId = (await db.ProfessionalProfiles.AsNoTracking()
                .FirstAsync(pp => pp.UserId == coachBUserId, ct)).Id;
        }

        using var scopeA = factory.Services.CreateScope();
        using var scopeB = factory.Services.CreateScope();
        var dbA = scopeA.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var dbB = scopeB.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Racer A: lock, insert a link occupying the nutrition slot, hold the transaction open.
        await using var transactionA = await dbA.BeginTransactionAsync(ct);
        await dbA.LockClientProfileAsync(clientProfileId, ct);

        dbA.ClientProfessionalLinks.Add(new ClientProfessionalLink
        {
            ClientProfileId = clientProfileId,
            ProfessionalProfileId = coachAProfileId,
            ProfessionalRole = Application.Domain.Enums.UserRole.Nutritionist,
            IsActive = true,
            CanViewNutritionPlans = true,
            CanViewTrainingPlans = false
        });
        await dbA.SaveChangesAsync(ct);

        // Racer B: same lock. This must not complete while A holds the row.
        await using var transactionB = await dbB.BeginTransactionAsync(ct);
        var racerB = dbB.LockClientProfileAsync(clientProfileId, ct);

        // Give B every chance to finish if the lock were not doing its job. This delay does not
        // create the ordering — it only bounds how long we wait before asserting B is stuck.
        var raced = await Task.WhenAny(racerB, Task.Delay(TimeSpan.FromSeconds(2), ct));
        raced.Should().NotBeSameAs(
            racerB,
            "racer B must still be blocked on the row lock that racer A's open transaction holds");

        await transactionA.CommitAsync(ct);

        // With A committed, B's lock is granted and — under READ COMMITTED, which takes a fresh
        // snapshot per statement — its guard read now sees A's link.
        await racerB;

        var slotTaken = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            dbB.ClientProfessionalLinks.AsNoTracking(),
            clientProfileId,
            coachBProfileId,
            wantsNutritionPlans: true,
            wantsTrainingPlans: false,
            ct);

        slotTaken.Should().BeTrue(
            "the loser's guard read must observe the winner's committed link, which is the whole "
            + "point of serializing on the client row");

        await transactionB.RollbackAsync(ct);
    }

    /// <summary>
    /// End-to-end outcome: one client holding two pending invites from two different
    /// nutritionists accepts both at once. Exactly one accept may succeed, the other must get
    /// the coded 400 — never a 500 and never two active links in the same profession slot.
    /// </summary>
    /// <remarks>
    /// This is the single-actor path the issue calls out: <c>AcceptClientInviteEndpoint</c> is
    /// <c>Roles(Client)</c>, so the CLIENT drives it and can race their own two accepts from two
    /// tabs or a retried request — no two professionals need to coordinate.
    /// </remarks>
    [Fact]
    public async Task ConcurrentAcceptsOfTwoNutritionInvites_ExactlyOneSucceeds_OtherGets400()
    {
        var ct = TestContext.Current.CancellationToken;
        var clientEmail = UniqueEmail("dual-invite-client");

        var inviteA = await CreateNutritionistInviteAsync(clientEmail);
        var inviteB = await CreateNutritionistInviteAsync(clientEmail);

        var registerResponse = await TestHelpers.RegisterAsync(
            factory.CreateClient(), clientEmail, "TestPass1!", "Dual", "Invitee", "Client");
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Two separate clients so the two accepts really are two concurrent connections.
        var clientOne = factory.CreateClient();
        var clientTwo = factory.CreateClient();
        var (token, _) = await TestHelpers.LoginAsync(clientOne, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientOne, token);
        TestHelpers.SetBearerToken(clientTwo, token);

        var responses = await Task.WhenAll(
            clientOne.PostAsJsonAsync($"/client/invites/{inviteA}/accept", new { }, ct),
            clientTwo.PostAsJsonAsync($"/client/invites/{inviteB}/accept", new { }, ct));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        var observed = string.Join(", ", statuses);

        statuses.Should().NotContain(HttpStatusCode.InternalServerError,
            "the lock must never surface as a 500 or a raw DbUpdateException (got {0})", observed);
        statuses.Count(s => s == HttpStatusCode.NoContent).Should().Be(1,
            "exactly one accept may take the nutrition slot (got {0})", observed);
        statuses.Count(s => s == HttpStatusCode.BadRequest).Should().Be(1,
            "the loser must get the coded PROFESSION_ALREADY_OCCUPIED 400 (got {0})", observed);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientProfile = await db.ClientProfiles.AsNoTracking()
            .FirstAsync(cp => cp.User!.Email == clientEmail, ct);

        var activeNutritionLinks = await db.ClientProfessionalLinks.AsNoTracking()
            .CountAsync(l => l.ClientProfileId == clientProfile.Id
                             && l.IsActive
                             && l.CanViewNutritionPlans, ct);

        activeNutritionLinks.Should().Be(1,
            "the invariant is about stored state, not just the status codes — two links carrying "
            + "the nutrition flag is the forbidden state regardless of what the responses said");
    }

    /// <summary>
    /// The collaboration path races the same way and is covered by the same lock. Coach A, who
    /// legitimately occupies the client's nutrition slot, fires two concurrent collaborations for
    /// two different collaborators. The two-exclusion guard excludes only the caller and THAT
    /// call's own collaborator, so without serialization neither request sees the other's
    /// delegate and both succeed — leaving two delegates in one slot.
    /// </summary>
    [Fact]
    public async Task ConcurrentCollaborationsIntoOneSlot_ExactlyOneSucceeds_OtherGets400()
    {
        var ct = TestContext.Current.CancellationToken;

        var clientEmail = UniqueEmail("collab-race-client");
        var coachEmail = UniqueEmail("collab-race-coach");

        var clientUserId = await RegisterAndResolveUserIdAsync(clientEmail, "Client");
        var coachUserId = await RegisterAndResolveUserIdAsync(coachEmail, "Nutritionist");
        var collaboratorOneUserId = await RegisterAndResolveUserIdAsync(
            UniqueEmail("collab-race-b"), "Nutritionist");
        var collaboratorTwoUserId = await RegisterAndResolveUserIdAsync(
            UniqueEmail("collab-race-d"), "Nutritionist");

        Guid clientPublicId;
        Guid collaboratorOnePublicId;
        Guid collaboratorTwoPublicId;
        long clientProfileId;

        using (var seedScope = factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var clientProfile = await db.ClientProfiles.FirstAsync(cp => cp.UserId == clientUserId, ct);
            var coachProfile = await db.ProfessionalProfiles
                .FirstAsync(pp => pp.UserId == coachUserId, ct);

            clientPublicId = clientProfile.PublicId;
            clientProfileId = clientProfile.Id;
            collaboratorOnePublicId = (await db.ProfessionalProfiles.AsNoTracking()
                .FirstAsync(pp => pp.UserId == collaboratorOneUserId, ct)).PublicId;
            collaboratorTwoPublicId = (await db.ProfessionalProfiles.AsNoTracking()
                .FirstAsync(pp => pp.UserId == collaboratorTwoUserId, ct)).PublicId;

            // The caller's own legitimate occupancy of the nutrition slot — seeded directly
            // rather than driven through invite+accept, which is a different endpoint's subject.
            db.ClientProfessionalLinks.Add(new ClientProfessionalLink
            {
                ClientProfileId = clientProfile.Id,
                ProfessionalProfileId = coachProfile.Id,
                ProfessionalRole = Application.Domain.Enums.UserRole.Nutritionist,
                IsActive = true,
                CanViewNutritionPlans = true,
                CanViewTrainingPlans = false
            });
            await db.SaveChangesAsync(ct);
        }

        var callerOne = factory.CreateClient();
        var callerTwo = factory.CreateClient();
        var (coachToken, _) = await TestHelpers.LoginAsync(callerOne, coachEmail, "TestPass1!");
        TestHelpers.SetBearerToken(callerOne, coachToken);
        TestHelpers.SetBearerToken(callerTwo, coachToken);

        var responses = await Task.WhenAll(
            callerOne.PostAsJsonAsync("/trainer/collaborations", new
            {
                ClientPublicId = clientPublicId,
                CollaboratorPublicId = collaboratorOnePublicId
            }, ct),
            callerTwo.PostAsJsonAsync("/trainer/collaborations", new
            {
                ClientPublicId = clientPublicId,
                CollaboratorPublicId = collaboratorTwoPublicId
            }, ct));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        var observed = string.Join(", ", statuses);

        statuses.Should().NotContain(HttpStatusCode.InternalServerError,
            "the lock must never surface as a 500 (got {0})", observed);
        statuses.Count(s => s == HttpStatusCode.Created).Should().Be(1,
            "only one collaborator may be delegated into the nutrition slot (got {0})", observed);
        statuses.Count(s => s == HttpStatusCode.BadRequest).Should().Be(1,
            "the loser must get the coded PROFESSION_ALREADY_OCCUPIED 400 (got {0})", observed);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var activeNutritionLinks = await verifyDb.ClientProfessionalLinks.AsNoTracking()
            .CountAsync(l => l.ClientProfileId == clientProfileId
                             && l.IsActive
                             && l.CanViewNutritionPlans, ct);

        activeNutritionLinks.Should().Be(2,
            "the caller's own link plus exactly one delegate — a third would be the forbidden "
            + "state the two-exclusion guard cannot catch on its own");
    }

    /// <summary>
    /// Registers a fresh nutritionist and has them create a pending invite for
    /// <paramref name="clientEmail"/>. Returns the invite's PublicId.
    /// </summary>
    private async Task<Guid> CreateNutritionistInviteAsync(string clientEmail)
    {
        var coachHttp = factory.CreateClient();
        var coachEmail = UniqueEmail("dual-invite-coach");
        await TestHelpers.RegisterAsync(coachHttp, coachEmail, "TestPass1!", "Nutri", "Coach", "Nutritionist");
        var (coachToken, _) = await TestHelpers.LoginAsync(coachHttp, coachEmail, "TestPass1!");
        TestHelpers.SetBearerToken(coachHttp, coachToken);

        var response = await coachHttp.PostAsJsonAsync("/trainer/pending-invites", new
        {
            FirstName = "Dual",
            LastName = "Invitee",
            Email = clientEmail
        }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var invite = await response.Content.ReadFromJsonAsync<PendingInviteCreated>(
            cancellationToken: TestContext.Current.CancellationToken);
        return invite!.PublicId;
    }

    private sealed record PendingInviteCreated(Guid PublicId);
}
