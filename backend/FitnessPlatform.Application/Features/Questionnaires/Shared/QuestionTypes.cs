namespace FitnessPlatform.Application.Features.Questionnaires.Shared;

/// <summary>
/// The fixed set of question type identifiers stored in <c>QuestionnaireQuestion.Type</c>.
/// </summary>
public static class QuestionTypes
{
    public const string SingleChoice = "single_choice";
    public const string MultiSelect = "multi_select";
    public const string ShortText = "short_text";
    public const string Number = "number";
    public const string SmileyRating = "smiley_rating";
    public const string StarRating = "star_rating";
    public const string Scale = "scale";
    public const string FileUpload = "file_upload";

    /// <summary>Every accepted question type.</summary>
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        SingleChoice,
        MultiSelect,
        ShortText,
        Number,
        SmileyRating,
        StarRating,
        Scale,
        FileUpload,
    };
}
