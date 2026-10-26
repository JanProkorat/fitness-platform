using FitnessPlatform.Application.Features.Client.Plans.GetClientPlanSummary;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Client.Plans;

/// <summary>
/// Rule coverage for <see cref="GetClientPlanSummaryValidator"/>.
/// </summary>
public class GetClientPlanSummaryValidatorTests
{
    private readonly GetClientPlanSummaryValidator _validator = new();

    [Fact]
    public void Validate_EmptyPlanId_Fails_AndAGuidPasses()
    {
        _validator.TestValidate(new GetClientPlanSummaryRequest { PlanId = Guid.Empty })
            .ShouldHaveValidationErrorFor(x => x.PlanId);

        _validator.TestValidate(new GetClientPlanSummaryRequest { PlanId = Guid.NewGuid() })
            .ShouldNotHaveAnyValidationErrors();
    }
}
