using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="AutomationAudienceFilter"/>, run over an in-memory query.
/// </summary>
public class AutomationAudienceFilterTests
{
    private const long Coach = 1;
    private const long OtherCoach = 2;
    private const long Client = 10;
    private const long OtherClient = 11;

    private static AutomationRule Rule(
        string name,
        AutomationAudience audience = AutomationAudience.All,
        long owner = Coach,
        long? tagId = null,
        long? onlyClient = null,
        params long[] chosen) => new()
    {
        Name = name,
        OwnerProfessionalProfileId = owner,
        Audience = audience,
        AudienceTagId = tagId,
        ClientProfileId = onlyClient,
        AudienceClients = chosen.Select(id => new AutomationRuleAudienceClient { ClientProfileId = id }).ToList(),
    };

    private static List<string> Covering(IEnumerable<AutomationRule> rules, params long[] clientTagIds) =>
        rules.AsQueryable()
            .CoveringClient(Coach, Client, clientTagIds)
            .Select(r => r.Name)
            .ToList();

    [Fact]
    public void CoveringClient_AllAudience_CoversEveryClientOfTheOwnerOnly()
    {
        var rules = new[] { Rule("mine"), Rule("theirs", owner: OtherCoach) };

        Covering(rules).Should().BeEquivalentTo(["mine"]);
    }

    [Fact]
    public void CoveringClient_TagAudience_NeedsTheTagOnTheClient()
    {
        var rules = new[] { Rule("tagged", AutomationAudience.Tag, tagId: 5) };

        Covering(rules, 5).Should().BeEquivalentTo(["tagged"]);
        Covering(rules, 6).Should().BeEmpty();
        Covering(rules).Should().BeEmpty();
    }

    [Fact]
    public void CoveringClient_TagAudienceWithDeletedTag_CoversNobody()
    {
        var rules = new[] { Rule("orphan", AutomationAudience.Tag, tagId: null) };

        Covering(rules, 5).Should().BeEmpty();
    }

    [Fact]
    public void CoveringClient_ChosenAudience_NeedsTheClientInTheList()
    {
        var rules = new[]
        {
            Rule("in", AutomationAudience.Chosen, chosen: [Client, OtherClient]),
            Rule("out", AutomationAudience.Chosen, chosen: [OtherClient]),
        };

        Covering(rules).Should().BeEquivalentTo(["in"]);
    }

    [Fact]
    public void CoveringClient_ClientOnlyRule_CoversOnlyItsOwnClient()
    {
        var rules = new[]
        {
            Rule("own", onlyClient: Client),
            Rule("elsewhere", onlyClient: OtherClient),
        };

        Covering(rules).Should().BeEquivalentTo(["own"]);
    }
}
