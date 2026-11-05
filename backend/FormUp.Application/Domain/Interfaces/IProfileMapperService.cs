using FormUp.Application.Domain.Entities;

namespace FormUp.Application.Domain.Interfaces;

/// <summary>
/// Maps questionnaire answers to client profile fields based on question MappedField configuration.
/// </summary>
public interface IProfileMapperService
{
    /// <summary>
    /// Reads the submitted response's answers, applies mapped fields to the client's profile,
    /// and sends a notification to the professional.
    /// </summary>
    Task MapResponseToProfileAsync(QuestionnaireResponse response, CancellationToken ct = default);
}
