using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A single answer to a questionnaire question within a response.
/// </summary>
public class QuestionnaireAnswer : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the parent response.
    /// </summary>
    public long ResponseId { get; set; }

    /// <summary>
    /// Foreign key to the question being answered.
    /// </summary>
    public long QuestionId { get; set; }

    /// <summary>
    /// Text value for short_text and single_choice answers.
    /// </summary>
    [MaxLength(2000)]
    public string? ValueText { get; set; }

    /// <summary>
    /// Numeric value for number and scale answers.
    /// </summary>
    public decimal? ValueNumber { get; set; }

    /// <summary>
    /// JSON value for multi_select arrays.
    /// </summary>
    public string? ValueJson { get; set; }

    /// <summary>
    /// URL of uploaded file for file_upload answers.
    /// </summary>
    [MaxLength(500)]
    public string? FileUrl { get; set; }

    /// <summary>
    /// Navigation property to the parent response.
    /// </summary>
    public QuestionnaireResponse Response { get; set; } = null!;

    /// <summary>
    /// Navigation property to the question.
    /// </summary>
    public QuestionnaireQuestion Question { get; set; } = null!;
}
