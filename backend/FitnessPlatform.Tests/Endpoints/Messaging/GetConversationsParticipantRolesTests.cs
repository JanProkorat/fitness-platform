using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// <c>GET /conversations</c> returns the other participant's active coach roles.
/// </summary>
[Collection(TestCollection.Name)]
public class GetConversationsParticipantRolesTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task ClientCaller_SeesEachCoachsActiveRoles_AndRemovedRoleIsFilteredOut()
    {
        var both = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist).CreateAsync(Ct);
        var nutritionOnly = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var removed = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist)
            .WithRemovedCoachRoles(UserRole.Nutritionist)
            .CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        foreach (var coach in new[] { both, nutritionOnly, removed })
        {
            await ConversationListSeed.SeedInviteAsync(factory, coach, client);
        }

        var rows = await ConversationListSeed.GetAsync(client.Http);

        RolesOf(rows, both).Should().BeEquivalentTo([AppRoles.Trainer, AppRoles.Nutritionist]);
        RolesOf(rows, nutritionOnly).Should().BeEquivalentTo([AppRoles.Nutritionist]);
        RolesOf(rows, removed).Should().BeEquivalentTo([AppRoles.Trainer]);
    }

    private static List<string> RolesOf(List<ConversationListSeed.ConversationResult> rows, Actor coach) =>
        rows.Single(r => r.Participant.Id == coach.UserId).Participant.Roles;

    [Fact]
    public async Task CoachCaller_SeesClientWithNoRoles()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).CreateAsync(Ct);
        await ConversationListSeed.SeedRequestAsync(factory, coach, client);

        (await ConversationListSeed.GetAsync(coach.Http)).Single().Participant.Roles.Should().BeEmpty();
    }
}
