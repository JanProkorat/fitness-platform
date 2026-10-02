using System.Net.Http.Json;
using FitnessPlatform.Application.Features.Messaging.Shared;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>Initials fallback for participants with empty names (e.g. Apple Sign-In users).</summary>
[Collection(TestCollection.Name)]
public class ParticipantInitialsTests(FitnessApiFactory factory)
{
    [Theory]
    [InlineData("Jane", "Doe", "j@x.com", "JD")]
    [InlineData("Jane", "", "j@x.com", "J")]
    [InlineData("", "Doe", "j@x.com", "D")]
    [InlineData("", "", "j@x.com", "J")]
    [InlineData("", "", "", "?")]
    [InlineData("", "", null, "?")]
    public void Compute_FallsBackFromNamesToEmailToGlyph(string first, string last, string? email, string expected)
    {
        ParticipantInitials.Compute(first, last, email).Should().Be(expected);
    }

    [Fact]
    public async Task GetConversations_RosterClientWithEmptyNames_Returns200WithEmailInitial()
    {
        var ct = TestContext.Current.CancellationToken;
        var trainer = await TestActors.Trainer(factory).CreateAsync(ct);
        var client = await TestActors.Client(factory).WithName("", "").CreateAsync(ct);
        await TestActors.Link(factory, trainer, client).CreateAsync(ct);

        var response = await trainer.Http.GetAsync("/conversations", ct);

        response.EnsureSuccessStatusCode();
        var rows = await response.Content.ReadFromJsonAsync<List<ConversationDto>>(ct);
        rows!.Single(c => c.Participant.Id == client.UserId).Participant.Initials
            .Should().Be(client.Email[..1].ToUpper());
    }
}
