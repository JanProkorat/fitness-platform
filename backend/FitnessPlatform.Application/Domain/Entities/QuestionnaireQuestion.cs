using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A single question within a questionnaire template.
/// </summary>
public class QuestionnaireQuestion : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the parent questionnaire.
    /// </summary>
    public long QuestionnaireId { get; set; }

    /// <summary>
    /// Display order of the question within the questionnaire.
    /// </summary>
    public int OrderIndex { get; set; }

    /// <summary>
    /// Question type: short_text, single_choice, multi_select, number, scale, file_upload.
    /// </summary>
    [MaxLength(20)]
    public string Type { get; set; } = null!;

    /// <summary>
    /// The question text displayed to the client.
    /// </summary>
    [MaxLength(500)]
    public string Label { get; set; } = null!;

    /// <summary>
    /// Optional helper text shown below the question.
    /// </summary>
    [MaxLength(500)]
    public string? HelperText { get; set; }

    /// <summary>
    /// Whether an answer to this question is required.
    /// </summary>
    public bool IsRequired { get; set; }

    /// <summary>
    /// Whether this question is hidden from the client (used for internal mapping).
    /// </summary>
    public bool IsHidden { get; set; }

    /// <summary>
    /// JSON configuration blob (e.g., choices for single_choice, min/max for scale).
    /// </summary>
    public string? Config { get; set; }

    /// <summary>
    /// Optional mapped field name for auto-populating client profile fields.
    /// </summary>
    [MaxLength(50)]
    public string? MappedField { get; set; }

    /// <summary>
    /// Navigation property to the parent questionnaire.
    /// </summary>
    public Questionnaire Questionnaire { get; set; } = null!;
}
