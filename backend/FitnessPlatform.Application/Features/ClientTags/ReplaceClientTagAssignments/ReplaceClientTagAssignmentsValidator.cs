using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTags.ReplaceClientTagAssignments;

/// <summary>
/// Validates the <see cref="ReplaceClientTagAssignmentsRequest"/>. Whether each id resolves to a
/// tag the caller owns is an endpoint-level check — see
/// <see cref="ReplaceClientTagAssignmentsEndpoint"/>.
/// </summary>
public class ReplaceClientTagAssignmentsValidator : Validator<ReplaceClientTagAssignmentsRequest>
{
    private const int MaxTagsPerClient = 50;

    /// <summary>
    /// Initializes validation rules for replacing a client's tag assignments.
    /// </summary>
    public ReplaceClientTagAssignmentsValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        // No CascadeMode is configured anywhere in this backend (default: Continue), so both
        // Must() rules below still run after NotNull() fails — each one guards `ids is null`
        // itself rather than relying on cascade-stop to short-circuit a null body before it
        // reaches them.
        RuleFor(x => x.TagIds)
            .NotNull().WithErrorCode(ErrorCodes.Required)
            .Must(ids => ids is null || ids.Count <= MaxTagsPerClient)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage($"A client may have at most {MaxTagsPerClient} tags assigned.")
            .Must(ids => ids is null || ids.Distinct().Count() == ids.Count)
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("TagIds must not contain duplicates.");
    }
}
