using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Automations;

/// <summary>
/// Seeding and JSON helpers shared by the automation integration tests.
/// </summary>
internal static class AutomationTestData
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    /// <summary>A valid global schedule rule body; tests add or replace entries.</summary>
    public static Dictionary<string, object?> ScheduleRule(string name = "Progress photos") => new()
    {
        ["name"] = name,
        ["actionType"] = "RequestProgressPhotos",
        ["triggerKind"] = "Schedule",
        ["scheduleInterval"] = 4,
        ["scheduleUnit"] = "Weeks",
        ["localTime"] = "09:00:00",
    };

    /// <summary>Creates a tag owned by the coach and returns its public and internal ids.</summary>
    public static async Task<(Guid PublicId, long Id)> CreateTagAsync(FitnessApiFactory factory, Actor coach, string name = "VIP")
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tag = new ClientTag
        {
            PublicId = Guid.NewGuid(),
            OwnerProfessionalProfileId = coach.ProfileId,
            Name = name,
            ColorHex = "#3b82f6",
        };
        db.ClientTags.Add(tag);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return (tag.PublicId, tag.Id);
    }

    /// <summary>Assigns a tag to a link.</summary>
    public static async Task AssignTagAsync(FitnessApiFactory factory, long tagId, long linkId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.ClientTagAssignments.Add(new ClientTagAssignment { ClientTagId = tagId, ClientProfessionalLinkId = linkId });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>Creates a questionnaire owned by the coach and returns its public id.</summary>
    public static async Task<Guid> CreateQuestionnaireAsync(FitnessApiFactory factory, Actor coach)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var questionnaire = new Questionnaire
        {
            PublicId = Guid.NewGuid(),
            ProfessionalId = coach.UserId,
            Title = "Plan review",
            Type = QuestionnaireType.CheckIn,
        };
        db.Questionnaires.Add(questionnaire);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return questionnaire.PublicId;
    }

    /// <summary>Writes a run row for a rule and client.</summary>
    public static async Task AddRunAsync(
        FitnessApiFactory factory,
        Guid rulePublicId,
        long clientProfileId,
        AutomationRunStatus status,
        AutomationSkipReason? skipReason = null,
        DateTime? sentAt = null,
        DateTime? answeredAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var ruleId = await db.AutomationRules
            .Where(r => r.PublicId == rulePublicId)
            .Select(r => r.Id)
            .FirstAsync(TestContext.Current.CancellationToken);

        db.AutomationRuns.Add(new AutomationRun
        {
            AutomationRuleId = ruleId,
            ClientProfileId = clientProfileId,
            Occurrence = Guid.NewGuid().ToString("N"),
            Status = status,
            SkipReason = skipReason,
            SentAt = sentAt,
            AnsweredAt = answeredAt,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
