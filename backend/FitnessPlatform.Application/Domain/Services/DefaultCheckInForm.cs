using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The "Weekly check-in" form every coach starts with, as the Weekly check-in form board lays it out.
/// The form is only created; sending it is up to a rule the coach adds.
/// </summary>
public static class DefaultCheckInForm
{
    private const string SmileyRating = "smiley_rating";
    private const string ShortText = "short_text";

    private sealed record Texts(
        string Title,
        string EnergyLabel,
        string EnergyHelper,
        string EnergyLow,
        string EnergyHigh,
        string ChallengesLabel,
        string ChallengesHelper);

    private static readonly Dictionary<string, Texts> TextsByLanguage = new()
    {
        ["en"] = new(
            "Weekly Check-In",
            "How has your energy level been this week?",
            "Rate your overall energy",
            "Very low",
            "Great",
            "What challenges did you face this week?",
            "Help us understand what got in the way, so we can support you better"),
        ["cs"] = new(
            "Týdenní check-in",
            "Jaká byla tento týden vaše úroveň energie?",
            "Ohodnoťte svou celkovou energii",
            "Velmi nízká",
            "Skvělá",
            "S jakými výzvami jste se tento týden potýkali?",
            "Pomozte nám pochopit, co vám stálo v cestě, abychom vás mohli lépe podpořit"),
        ["de"] = new(
            "Wöchentlicher Check-in",
            "Wie war Ihr Energielevel diese Woche?",
            "Bewerten Sie Ihre Energie insgesamt",
            "Sehr niedrig",
            "Großartig",
            "Welchen Herausforderungen sind Sie diese Woche begegnet?",
            "Helfen Sie uns zu verstehen, was im Weg stand, damit wir Sie besser unterstützen können"),
    };

    /// <summary>
    /// Gives the coach a "Weekly check-in" form unless they already own a check-in form. Safe to call
    /// again: a second call changes nothing. Saves the form.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="professionalUserId">The coach's user id.</param>
    /// <param name="language">The coach's language (a bare code or an Accept-Language value); unknown falls back to English.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task EnsureAsync(
        IApplicationDbContext db, Guid professionalUserId, string? language, CancellationToken ct)
    {
        var hasCheckInForm = await db.Questionnaires
            .AsNoTracking()
            .AnyAsync(q => q.ProfessionalId == professionalUserId && q.Type == QuestionnaireType.CheckIn, ct);

        if (hasCheckInForm)
        {
            return;
        }

        var texts = ResolveTexts(language);

        db.Questionnaires.Add(new Questionnaire
        {
            ProfessionalId = professionalUserId,
            Title = texts.Title,
            Type = QuestionnaireType.CheckIn,
            Questions =
            [
                new QuestionnaireQuestion
                {
                    OrderIndex = 0,
                    Type = SmileyRating,
                    Label = texts.EnergyLabel,
                    HelperText = texts.EnergyHelper,
                    Config = $"{{\"lowLabel\":\"{texts.EnergyLow}\",\"highLabel\":\"{texts.EnergyHigh}\"}}",
                },
                new QuestionnaireQuestion
                {
                    OrderIndex = 1,
                    Type = ShortText,
                    Label = texts.ChallengesLabel,
                    HelperText = texts.ChallengesHelper,
                },
            ],
        });

        await db.SaveChangesAsync(ct);
    }

    private static Texts ResolveTexts(string? language)
    {
        var code = language?.Trim().ToLowerInvariant();
        code = code is { Length: >= 2 } ? code[..2] : null;

        return code is not null && TextsByLanguage.TryGetValue(code, out var texts)
            ? texts
            : TextsByLanguage["en"];
    }
}
