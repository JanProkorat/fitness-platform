using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Services;
using FluentAssertions;

namespace FormUp.Tests.Services;

/// <summary>
/// The package-proposal notification types have their own wording in every locale, not the English fallback.
/// </summary>
public class NotificationTemplatesProposalTests
{
    [Theory]
    [InlineData(NotificationType.ClientRequestPackageProposed, "cs")]
    [InlineData(NotificationType.ClientRequestPackageProposed, "de")]
    [InlineData(NotificationType.ClientRequestPackageProposed, "en")]
    [InlineData(NotificationType.ClientRequestProposalAccepted, "cs")]
    [InlineData(NotificationType.ClientRequestProposalAccepted, "de")]
    [InlineData(NotificationType.ClientRequestProposalAccepted, "en")]
    [InlineData(NotificationType.ClientRequestProposalDeclined, "cs")]
    [InlineData(NotificationType.ClientRequestProposalDeclined, "de")]
    [InlineData(NotificationType.ClientRequestProposalDeclined, "en")]
    [InlineData(NotificationType.ClientRequestProposalWithdrawn, "cs")]
    [InlineData(NotificationType.ClientRequestProposalWithdrawn, "de")]
    [InlineData(NotificationType.ClientRequestProposalWithdrawn, "en")]
    public void Resolve_ProposalType_HasLocalizedTitleAndBody(NotificationType type, string language)
    {
        var parameters = new Dictionary<string, string> { ["profName"] = "Coach Carl", ["clientName"] = "Jane Doe" };

        var (title, body) = NotificationTemplates.Resolve(type, language, parameters);
        var (englishTitle, englishBody) = NotificationTemplates.Resolve(type, "en", parameters);

        title.Should().NotBeNullOrWhiteSpace().And.NotBe("Notification");
        body.Should().NotBeNullOrWhiteSpace().And.NotBe("You have a new notification.");
        body.Should().NotContain("{", "every placeholder is filled");

        if (language != "en")
        {
            title.Should().NotBe(englishTitle);
            body.Should().NotBe(englishBody);
        }
    }
}
