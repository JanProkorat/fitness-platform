using FastEndpoints;
using FluentValidation;

namespace FormUp.Application.Features.Trainers.PendingInvites.CheckSlot;

/// <summary>
/// Validates the <see cref="CheckPendingInviteSlotRequest"/>.
/// </summary>
public class CheckPendingInviteSlotValidator : Validator<CheckPendingInviteSlotRequest>
{
    /// <summary>
    /// Initializes validation rules for the slot check.
    /// </summary>
    public CheckPendingInviteSlotValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(100);
    }
}
