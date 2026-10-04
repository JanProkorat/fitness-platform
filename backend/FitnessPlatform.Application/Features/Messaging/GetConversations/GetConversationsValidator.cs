using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Messaging.GetConversations;

/// <summary>
/// Validates the <see cref="GetConversationsRequest"/>.
/// </summary>
public class GetConversationsValidator : Validator<GetConversationsRequest>
{
    /// <summary>
    /// Initializes validation rules for listing conversations.
    /// </summary>
    public GetConversationsValidator()
    {
        RuleFor(x => x.Filter)
            .IsInEnum()
            .When(x => x.Filter.HasValue);
    }
}
