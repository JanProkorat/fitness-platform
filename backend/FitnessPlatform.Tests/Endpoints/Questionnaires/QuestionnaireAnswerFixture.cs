using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Questionnaires;

/// <summary>One question to seed: key is how the test refers to it.</summary>
internal sealed record SeedQuestion(
    string Key, string Type, string? Config = null, bool Required = false, bool Hidden = false);

/// <summary>A client, a coach, a link, a questionnaire with questions and one open response.</summary>
internal sealed class QuestionnaireAnswerScenario
{
    public required Actor Client { get; init; }
    public required Guid LinkPublicId { get; init; }
    public required Guid ResponsePublicId { get; init; }
    public required Guid QuestionnairePublicId { get; init; }
    public required Dictionary<string, Guid> QuestionIds { get; init; }

    /// <summary>Seeds the scenario straight through the DbContext.</summary>
    public static async Task<QuestionnaireAnswerScenario> CreateAsync(
        FitnessApiFactory factory,
        IReadOnlyList<SeedQuestion> questions,
        DateTime? activatedAtUtc = null,
        bool linkActive = true,
        QuestionnaireResponseStatus status = QuestionnaireResponseStatus.Pending)
    {
        var ct = TestContext.Current.CancellationToken;
        var coach = await TestActors.Trainer(factory).CreateAsync(ct);
        var client = await TestActors.Client(factory).CreateAsync(ct);

        var link = TestActors.Link(factory, coach, client);
        if (activatedAtUtc.HasValue)
        {
            link.WithActivatedAtUtc(activatedAtUtc.Value);
        }

        if (!linkActive)
        {
            link.Inactive();
        }

        var linkId = await link.CreateAsync(ct);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var questionnaire = EntityBuilder.Questionnaire.WithProfessionalUserId(coach.UserId).Build();
        var questionIds = new Dictionary<string, Guid>();
        var order = 0;
        foreach (var seed in questions)
        {
            var question = new QuestionnaireQuestion
            {
                PublicId = Guid.NewGuid(),
                OrderIndex = order++,
                Type = seed.Type,
                Label = seed.Key,
                IsRequired = seed.Required,
                IsHidden = seed.Hidden,
                Config = seed.Config,
            };
            questionnaire.Questions.Add(question);
            questionIds[seed.Key] = question.PublicId;
        }

        db.Questionnaires.Add(questionnaire);
        await db.SaveChangesAsync(ct);

        var response = EntityBuilder.QuestionnaireResponse
            .ForQuestionnaire(questionnaire.Id)
            .OnLink(linkId)
            .FromClient(client.UserId)
            .FromProfessional(coach.UserId)
            .WithStatus(status, status == QuestionnaireResponseStatus.Submitted ? DateTime.UtcNow : null)
            .Build();
        db.QuestionnaireResponses.Add(response);
        await db.SaveChangesAsync(ct);

        return new QuestionnaireAnswerScenario
        {
            Client = client,
            LinkPublicId = link.PublicId,
            ResponsePublicId = response.PublicId,
            QuestionnairePublicId = questionnaire.PublicId,
            QuestionIds = questionIds,
        };
    }
}
