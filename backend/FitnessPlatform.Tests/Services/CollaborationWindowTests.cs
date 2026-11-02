using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// A submission counts by when it was submitted, an open response by when it was created, and a legacy
/// link without an activation time counts everything.
/// </summary>
public class CollaborationWindowTests
{
    private static readonly DateTime Activated = new(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(QuestionnaireResponseStatus.Submitted, -1, -10, false)]
    [InlineData(QuestionnaireResponseStatus.Submitted, 0, -10, true)]
    [InlineData(QuestionnaireResponseStatus.Submitted, 1, -10, true)]
    [InlineData(QuestionnaireResponseStatus.Pending, null, -1, false)]
    [InlineData(QuestionnaireResponseStatus.InProgress, null, 1, true)]
    public void IsCurrent_WithActivationTime_JudgesBySubmissionOrCreation(
        QuestionnaireResponseStatus status, int? submittedDaysFromActivation, int createdDaysFromActivation, bool expected)
    {
        DateTime? submittedAt = submittedDaysFromActivation is { } days ? Activated.AddDays(days) : null;

        CollaborationWindow
            .IsCurrent(Activated, status, submittedAt, Activated.AddDays(createdDaysFromActivation))
            .Should().Be(expected);
    }

    [Fact]
    public void IsCurrent_LegacyLinkWithoutActivationTime_CountsEverything()
    {
        CollaborationWindow
            .IsCurrent(null, QuestionnaireResponseStatus.Submitted, Activated.AddDays(-400), Activated.AddDays(-401))
            .Should().BeTrue();
    }
}
