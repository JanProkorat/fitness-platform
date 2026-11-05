namespace FormUp.Application.Features.Trainers.ClientRequests.ProposeClientRequestPackage;

/// <summary>
/// Request model for proposing a package on a client request that has none.
/// </summary>
public class ProposeClientRequestPackageRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>
    /// Public id of the coach's package to propose.
    /// </summary>
    public Guid PackagePublicId { get; set; }

    /// <summary>
    /// Optional public id of one of the coach's discounts, offered with the package.
    /// </summary>
    public Guid? DiscountPublicId { get; set; }

    /// <summary>
    /// Optional public id of a questionnaire the client fills in after accepting.
    /// </summary>
    public Guid? QuestionnairePublicId { get; set; }

    /// <summary>
    /// When true the client gets no onboarding form, not even the coach's default. Not sent means false.
    /// Cannot be combined with <see cref="QuestionnairePublicId"/>.
    /// </summary>
    public bool SkipOnboardingForm { get; set; }

    /// <summary>
    /// Optional message from the coach shown with the proposal.
    /// </summary>
    public string? Statement { get; set; }
}
