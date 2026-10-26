namespace FitnessPlatform.Application.Features.PaymentSettings.GetCoachBankDetails;

/// <summary>
/// Request for a linked coach's bank details.
/// </summary>
public class GetCoachBankDetailsRequest
{
    /// <summary>Route parameter — the coach's professional profile public id.</summary>
    public Guid CoachId { get; set; }
}
