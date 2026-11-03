using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.Questionnaires;

/// <summary>
/// A coach who picks "no onboarding form" must not have the default form offered to the client.
/// </summary>
[Collection(TestCollection.Name)]
public class SkipOnboardingFormTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private record RequestCreated(Guid PublicId);

    private async Task<long> AddFormAsync(Actor coach, bool isDefault)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var form = EntityBuilder.Questionnaire.WithProfessionalUserId(coach.UserId).Build();
        form.IsDefault = isDefault;
        db.Questionnaires.Add(form);
        await db.SaveChangesAsync(Ct);

        return form.Id;
    }

    private async Task<JsonElement[]> PendingItemsAsync(Actor client)
    {
        var response = await client.Http.GetAsync("/client/questionnaires/pending", Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);

        return body.GetProperty("items").EnumerateArray().ToArray();
    }

    private async Task<(Actor Coach, Actor Client)> CoachWithDefaultFormAsync()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await AddFormAsync(coach, isDefault: true);

        return (coach, client);
    }

    private async Task<ClientProfessionalLink> StoredLinkAsync(Actor coach, Actor client)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientProfessionalLinks.AsNoTracking().SingleAsync(
            l => l.ClientProfileId == client.ProfileId && l.ProfessionalProfileId == coach.ProfileId, Ct);
    }

    private static async Task<Guid> SendRequestAsync(Actor coach, Actor client)
    {
        var response = await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<RequestCreated>(Ct))!.PublicId;
    }

    [Fact]
    public async Task Pending_SkippedLinkWithDefaultForm_ListsNoQuestionnaire()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        await TestActors.Link(factory, coach, client).SkippingOnboardingForm().CreateAsync(Ct);

        (await PendingItemsAsync(client)).Should().BeEmpty();
    }

    [Fact]
    public async Task Pending_LinkNotSkipped_StillListsTheDefaultForm()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        var link = TestActors.Link(factory, coach, client);
        await link.CreateAsync(Ct);

        var items = await PendingItemsAsync(client);

        items.Should().ContainSingle(item => item.GetProperty("linkPublicId").GetGuid() == link.PublicId);
    }

    [Fact]
    public async Task Pending_SkippedLinkWithExplicitForm_StillListsTheExplicitForm()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        var explicitFormId = await AddFormAsync(coach, isDefault: false);
        var link = TestActors.Link(factory, coach, client).SkippingOnboardingForm().WithQuestionnaireId(explicitFormId);
        await link.CreateAsync(Ct);

        (await PendingItemsAsync(client)).Should().ContainSingle();
    }

    [Fact]
    public async Task GetQuestionnaire_SkippedLinkWithoutExplicitForm_Returns404()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        var link = TestActors.Link(factory, coach, client).SkippingOnboardingForm();
        await link.CreateAsync(Ct);

        var response = await client.Http.GetAsync($"/client/questionnaire?linkPublicId={link.PublicId}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AcceptRequest_WithSkip_CreatesASkippedLinkAndNoFormIsOffered()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        var requestId = await SendRequestAsync(coach, client);

        var accepted = await coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/accept", new { SkipOnboardingForm = true }, Ct);

        accepted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await StoredLinkAsync(coach, client)).SkipOnboardingForm.Should().BeTrue();
        (await PendingItemsAsync(client)).Should().BeEmpty();
    }

    [Fact]
    public async Task AcceptRequest_WithSkipAndQuestionnaire_Returns400WithTheErrorCode()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        var requestId = await SendRequestAsync(coach, client);

        var response = await coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/accept",
            new { SkipOnboardingForm = true, QuestionnairePublicId = Guid.NewGuid() },
            Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(Ct)).Should().Contain("SKIP_ONBOARDING_FORM_WITH_QUESTIONNAIRE");
    }

    [Fact]
    public async Task AcceptRequest_ReactivatingASkippedLinkWithoutTheChoice_ResetsTheFlag()
    {
        var (coach, client) = await CoachWithDefaultFormAsync();
        await TestActors.Link(factory, coach, client).SkippingOnboardingForm().Inactive().CreateAsync(Ct);
        var requestId = await SendRequestAsync(coach, client);

        var accepted = await coach.Http.PostAsJsonAsync($"/trainer/client-requests/{requestId}/accept", new { }, Ct);

        accepted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var link = await StoredLinkAsync(coach, client);
        link.IsActive.Should().BeTrue();
        link.SkipOnboardingForm.Should().BeFalse();
    }

    [Fact]
    public async Task ProposalAccepted_AfterAProposalWithSkip_CreatesASkippedLink()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await AddFormAsync(coach, isDefault: true);
        var packageId = await CreatePackageAsync(coach, 2500m);
        var requestId = await SendRequestAsync(coach, client);

        var proposed = await coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/propose-package",
            new { PackagePublicId = packageId, SkipOnboardingForm = true },
            Ct);
        proposed.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var accepted = await client.Http.PostAsJsonAsync($"/client/requests/{requestId}/accept-proposal", new { }, Ct);

        accepted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await StoredLinkAsync(coach, client)).SkipOnboardingForm.Should().BeTrue();
        (await PendingItemsAsync(client)).Should().BeEmpty();
    }
}
