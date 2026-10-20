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
    public async Task ClientCaller_SeesCoachRoles()
    {
        var coach = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await ConversationListSeed.SeedInviteAsync(factory, coach, client);

        var row = (await ConversationListSeed.GetAsync(client.Http)).Should().ContainSingle().Subject;

        row.Participant.Roles.Should().BeEquivalentTo([AppRoles.Trainer, AppRoles.Nutritionist]);
    }

    [Fact]
    public async Task ClientCaller_SingleRoleCoach_ReturnsOnlyThatRole()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await ConversationListSeed.SeedInviteAsync(factory, coach, client);

        (await ConversationListSeed.GetAsync(client.Http)).Single().Participant.Roles
            .Should().BeEquivalentTo([AppRoles.Nutritionist]);
    }

    [Fact]
    public async Task RemovedRole_IsFilteredOut()
    {
        var coach = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist)
            .WithRemovedCoachRoles(UserRole.Nutritionist)
            .CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await ConversationListSeed.SeedInviteAsync(factory, coach, client);

        (await ConversationListSeed.GetAsync(client.Http)).Single().Participant.Roles
            .Should().BeEquivalentTo([AppRoles.Trainer]);
    }

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
