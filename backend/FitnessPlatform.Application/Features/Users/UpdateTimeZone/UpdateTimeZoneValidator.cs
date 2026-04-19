using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Users.UpdateTimeZone;

/// <summary>
/// Validates the <see cref="UpdateTimeZoneRequest"/>.
/// </summary>
public class UpdateTimeZoneValidator : Validator<UpdateTimeZoneRequest>
{
    /// <summary>
    /// Initializes validation rules for the time zone update request.
    /// </summary>
    public UpdateTimeZoneValidator()
    {
        RuleFor(x => x.TimeZone)
            .NotEmpty()
            .MaximumLength(100);
    }
}
