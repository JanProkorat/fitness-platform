using System.Net;
using FluentAssertions;
using FormUp.Application.Domain.Enums;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;

namespace FormUp.Tests.Endpoints.Users.EmailLinks;

/// <summary>
/// Integration tests for <c>POST /users/email-links/one-click</c>, the RFC 8058 target of the
/// <c>List-Unsubscribe</c> header.
/// </summary>
[Collection(TestCollection.Name)]
public class EmailLinkOneClickTests(FitnessApiFactory factory)
{
    private const string Route = "/users/email-links/one-click";

    private static string Url(string token) => $"{Route}?token={Uri.EscapeDataString(token)}";

    private Task<HttpResponseMessage> PostFormAsync(string token) =>
        factory.CreateClient().PostAsync(
            Url(token),
            new FormUrlEncodedContent([new KeyValuePair<string, string>("List-Unsubscribe", "One-Click")]),
            TestContext.Current.CancellationToken);

    [Fact]
    public async Task OneClick_FormPostWithValidToken_Returns200AndTurnsOffOnlyThatEmail()
    {
        var actor = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        await EmailLinkTestSupport.SeedAsync(factory, actor.UserId, NotificationEvent.NewMessage, email: true, push: true);
        await EmailLinkTestSupport.SeedAsync(factory, actor.UserId, NotificationEvent.JoinRequest, email: true, push: false);

        var response = await PostFormAsync(EmailLinkTestSupport.Valid(factory, actor.UserId, NotificationEvent.JoinRequest));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var rows = await EmailLinkTestSupport.RowsAsync(factory, actor.UserId);
        rows.Single(row => row.Event == NotificationEvent.JoinRequest)
            .Should().Match<Application.Domain.Entities.NotificationPreference>(row => !row.EmailEnabled && !row.PushEnabled);
        rows.Single(row => row.Event == NotificationEvent.NewMessage)
            .Should().Match<Application.Domain.Entities.NotificationPreference>(row => row.EmailEnabled && row.PushEnabled);
    }

    [Fact]
    public async Task OneClick_ValidTokenWithoutTheFormField_StillReturns200()
    {
        var actor = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await factory.CreateClient().PostAsync(
            Url(EmailLinkTestSupport.Valid(factory, actor.UserId, NotificationEvent.WeeklyCheckInSubmitted)),
            content: null,
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await EmailLinkTestSupport.RowsAsync(factory, actor.UserId)).Should().ContainSingle()
            .Which.EmailEnabled.Should().BeFalse();
    }

    [Theory]
    [MemberData(nameof(Scenarios))]
    public async Task OneClick_InvalidLink_Returns400WithNoBodyAndChangesNothing(string scenario)
    {
        var ct = TestContext.Current.CancellationToken;
        var actor = await TestActors.Trainer(factory).CreateAsync(ct);
        await EmailLinkTestSupport.SeedAsync(factory, actor.UserId, NotificationEvent.JoinRequest, email: true, push: true);

        var response = await PostFormAsync(EmailLinkTestSupport.Invalid(factory, scenario, actor.UserId, NotificationEvent.JoinRequest));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(ct)).Should().BeEmpty();
        (await EmailLinkTestSupport.RowsAsync(factory, actor.UserId)).Should().ContainSingle()
            .Which.EmailEnabled.Should().BeTrue();
    }

    [Fact]
    public async Task OneClick_NoTokenAtAll_Returns400WithNoBody()
    {
        var response = await factory.CreateClient().PostAsync(
            Route,
            new FormUrlEncodedContent([new KeyValuePair<string, string>("List-Unsubscribe", "One-Click")]),
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().BeEmpty();
    }

    [Fact]
    public async Task OneClick_Get_Returns405AndChangesNothing()
    {
        var ct = TestContext.Current.CancellationToken;
        var actor = await TestActors.Trainer(factory).CreateAsync(ct);

        var response = await factory.CreateClient().GetAsync(
            Url(EmailLinkTestSupport.Valid(factory, actor.UserId, NotificationEvent.JoinRequest)), ct);

        response.StatusCode.Should().Be(HttpStatusCode.MethodNotAllowed);
        (await EmailLinkTestSupport.RowsAsync(factory, actor.UserId)).Should().BeEmpty();
    }

    public static TheoryData<string> Scenarios() => [.. EmailLinkTestSupport.InvalidScenarios];
}
