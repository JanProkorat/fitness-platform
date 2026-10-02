using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.GetAll;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// An invite to a coaching account's email looks like any other invite to the inviter (listed,
/// counted, 409 on repeat, deletable) but creates no token, notification or conversation, and the
/// coach-role invitee can neither see nor act on it.
/// </summary>
[Collection(TestCollection.Name)]
public class SilentInviteIntegrationTests(FitnessApiFactory factory)
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private async Task<(Actor Inviter, Actor Coach)> SetupAsync()
    {
        var inviter = await TestActors.Trainer(factory).CreateAsync(Ct);
        var coach = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Client).CreateAsync(Ct);
        return (inviter, coach);
    }

    private async Task<CreatePendingInviteResponse> InviteAsync(Actor inviter, string email)
    {
        var response = await inviter.Http.PostAsJsonAsync(
            "/trainer/pending-invites", new { Email = email, Message = "Join me" }, Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<CreatePendingInviteResponse>(Ct))!;
    }

    private async Task AssertNoSideEffectsAsync(Actor inviter, Actor coach)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        (await db.InvitationTokens.AnyAsync(t => t.ProfessionalProfileId == inviter.ProfileId, Ct))
            .Should().BeFalse("no token is issued for a silent invite");
        (await db.Notifications.AnyAsync(n => n.RecipientUserId == coach.UserId, Ct))
            .Should().BeFalse("the coach account is never notified");
        (await db.Conversations.AnyAsync(c => c.ProfessionalUserId == inviter.UserId, Ct))
            .Should().BeFalse("no conversation is seeded");
    }

    [Fact]
    public async Task CreateInvite_ForCoachEmail_ReturnsNormalSuccessAndStoresListedRow()
    {
        var (inviter, coach) = await SetupAsync();

        var created = await InviteAsync(inviter, coach.Email);

        created.Email.Should().Be(coach.Email);

        var list = await inviter.Http.GetFromJsonAsync<GetPendingInvitesResponse>("/trainer/pending-invites", Ct);
        list!.Invites.Should().ContainSingle(i => i.PublicId == created.PublicId && !i.IsAccepted);

        await AssertNoSideEffectsAsync(inviter, coach);
    }

    [Fact]
    public async Task CreateInvite_RepeatForCoachEmail_Returns409Duplicate()
    {
        var (inviter, coach) = await SetupAsync();
        await InviteAsync(inviter, coach.Email);

        var second = await inviter.Http.PostAsJsonAsync("/trainer/pending-invites", new { Email = coach.Email }, Ct);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await second.Content.ReadFromJsonAsync<ProblemDto>(Ct);
        problem!.ErrorCode.Should().Be("DUPLICATE_PENDING_INVITE");
    }

    [Fact]
    public async Task CreateInvite_SilentInviteCountsTowardOutstandingCap()
    {
        var (inviter, coach) = await SetupAsync();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            for (var i = 0; i < 199; i++)
            {
                db.PendingInvites.Add(new PendingInvite
                {
                    ProfessionalProfileId = inviter.ProfileId,
                    Email = $"filler-{i}-{Guid.NewGuid():N}@cap-test.com",
                    SentAt = DateTime.UtcNow,
                });
            }

            await db.SaveChangesAsync(Ct);
        }

        await InviteAsync(inviter, coach.Email);

        var overCap = await inviter.Http.PostAsJsonAsync(
            "/trainer/pending-invites", new { Email = $"{Guid.NewGuid():N}@cap-test.com" }, Ct);

        overCap.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        var problem = await overCap.Content.ReadFromJsonAsync<ProblemDto>(Ct);
        problem!.ErrorCode.Should().Be("TOO_MANY_PENDING_INVITES");
    }

    [Fact]
    public async Task DeleteInvite_SilentRow_Returns204WithoutNotifyingOrSeeding()
    {
        var (inviter, coach) = await SetupAsync();
        var created = await InviteAsync(inviter, coach.Email);

        var delete = await inviter.Http.DeleteAsync($"/trainer/pending-invites/{created.PublicId}", Ct);

        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await AssertNoSideEffectsAsync(inviter, coach);

        var list = await inviter.Http.GetFromJsonAsync<GetPendingInvitesResponse>("/trainer/pending-invites", Ct);
        list!.Invites.Should().NotContain(i => i.PublicId == created.PublicId);
    }

    [Fact]
    public async Task InviteeSide_CoachRoleCaller_SeesNothingAndCannotAct()
    {
        var (inviter, coach) = await SetupAsync();
        var created = await InviteAsync(inviter, coach.Email);

        var pending = await coach.Http.GetAsync("/client/invites/pending", Ct);
        var accept = await coach.Http.PostAsJsonAsync($"/client/invites/{created.PublicId}/accept", new { }, Ct);
        var decline = await coach.Http.PostAsJsonAsync($"/client/invites/{created.PublicId}/decline", new { }, Ct);
        var questionnaires = await coach.Http.GetAsync("/client/questionnaires/pending", Ct);

        pending.StatusCode.Should().Be(HttpStatusCode.NoContent);
        accept.StatusCode.Should().Be(HttpStatusCode.NotFound);
        decline.StatusCode.Should().Be(HttpStatusCode.NotFound);
        questionnaires.StatusCode.Should().NotBe(HttpStatusCode.InternalServerError);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.PendingInvites.SingleAsync(i => i.PublicId == created.PublicId, Ct)).IsAccepted
            .Should().BeFalse("a coach-role caller must not consume the silent row");
        (await db.ClientProfessionalLinks.AnyAsync(l => l.ProfessionalProfileId == inviter.ProfileId, Ct))
            .Should().BeFalse("no link may be created from a silent invite");
        await AssertNoSideEffectsAsync(inviter, coach);
    }

    private sealed class ProblemDto
    {
        public string? ErrorCode { get; set; }
    }
}
