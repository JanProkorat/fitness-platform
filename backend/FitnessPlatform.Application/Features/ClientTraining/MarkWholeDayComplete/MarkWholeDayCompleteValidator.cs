using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;

/// <summary>
/// Validator for <see cref="MarkWholeDayCompleteRequest"/>.
/// </summary>
public class MarkWholeDayCompleteValidator : Validator<MarkWholeDayCompleteRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="MarkWholeDayCompleteValidator"/>.
    /// </summary>
    public MarkWholeDayCompleteValidator()
    {
        // Date is optional — no validation rules required currently.
    }
}
