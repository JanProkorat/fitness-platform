using System.Text.Json;

namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// Checks a question's JSON config string against the typed shape for its question type.
/// The wire format stays a JSON string; the parsed classes are used for validation only.
/// </summary>
public static class QuestionConfigChecker
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// Returns true when the config is acceptable for the question type. Unknown keys are ignored.
    /// </summary>
    public static bool IsValid(string? type, string? config)
    {
        var hasConfig = !string.IsNullOrWhiteSpace(config);

        try
        {
            switch (type)
            {
                case QuestionTypes.SingleChoice:
                case QuestionTypes.MultiSelect:
                    return hasConfig && IsValidChoice(JsonSerializer.Deserialize<ChoiceQuestionConfig>(config!, Options));
                case QuestionTypes.Number:
                    return !hasConfig || IsValidNumber(JsonSerializer.Deserialize<NumberQuestionConfig>(config!, Options));
                case QuestionTypes.SmileyRating:
                    return hasConfig && IsValidSmiley(JsonSerializer.Deserialize<SmileyRatingQuestionConfig>(config!, Options));
                default:
                    return !hasConfig || IsJsonObject(config!);
            }
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool IsValidChoice(ChoiceQuestionConfig? config) =>
        config?.Options is { Count: > 0 } options && options.All(option => !string.IsNullOrWhiteSpace(option));

    private static bool IsValidNumber(NumberQuestionConfig? config) =>
        config is not null && (config.Min is null || config.Max is null || config.Min <= config.Max);

    private static bool IsValidSmiley(SmileyRatingQuestionConfig? config) =>
        config is not null
        && !string.IsNullOrWhiteSpace(config.LowLabel)
        && !string.IsNullOrWhiteSpace(config.HighLabel);

    private static bool IsJsonObject(string config)
    {
        using var document = JsonDocument.Parse(config);
        return document.RootElement.ValueKind == JsonValueKind.Object;
    }
}
