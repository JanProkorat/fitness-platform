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

namespace FitnessPlatform.Tests.Endpoints.Trainers.ClientRequests;

/// <summary>
/// A coach proposes a package on a pending client request (POST /trainer/client-requests/{id}/propose-package).
/// </summary>
[Collection(TestCollection.Name)]
public class ProposeClientRequestPackageTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<Actor> CoachWithPaymentsAsync()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: true);

        return coach;
    }

    private static async Task<Guid> SendRequestAsync(Actor coach, Actor client, Guid? packageId = null)
    {
        var response = await client.Http.PostAsJsonAsync(
            "/client/requests", new { ProfessionalPublicId = coach.PublicId, PackagePublicId = packageId }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<RequestCreated>(Ct))!.PublicId;
    }

    private static Task<HttpResponseMessage> ProposeAsync(
        Actor coach, Guid requestId, Guid packageId, Guid? discountId = null, Guid? formId = null, string? statement = null) =>
        coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/propose-package",
            new { PackagePublicId = packageId, DiscountPublicId = discountId, QuestionnairePublicId = formId, Statement = statement },
            Ct);

    private async Task<ClientRequest> StoredRequestAsync(Guid requestId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientRequests
            .AsNoTracking()
            .Include(r => r.ProposedPackage)
            .Include(r => r.ProposedDiscount)
            .SingleAsync(r => r.PublicId == requestId, Ct);
    }

    private async Task SetStatusAsync(Guid requestId, ClientRequestStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var request = await db.ClientRequests.SingleAsync(r => r.PublicId == requestId, Ct);
        request.Status = status;
        await db.SaveChangesAsync(Ct);
    }

    private async Task<Guid> CreateFormAsync(Guid professionalUserId, QuestionnaireType type)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var form = new Questionnaire
        {
            PublicId = Guid.NewGuid(),
            ProfessionalId = professionalUserId,
            Title = $"Form {Guid.NewGuid():N}",
            Type = type,
            IsActive = true,
        };
        db.Questionnaires.Add(form);
        await db.SaveChangesAsync(Ct);

        return form.PublicId;
    }

    [Fact]
    public async Task Propose_WithPackageDiscountAndForm_MovesToPackageProposedAndNotifiesTheClient()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach, 2500m);
        var discountId = await CreateDiscountAsync(coach, 30m);
        var formId = await CreateFormAsync(coach.UserId, QuestionnaireType.Onboarding);
        var requestId = await SendRequestAsync(coach, client);

        var response = await ProposeAsync(coach, requestId, packageId, discountId, formId, "Welcome aboard");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var stored = await StoredRequestAsync(requestId);
        stored.Status.Should().Be(ClientRequestStatus.PackageProposed);
        stored.ProposedPackage!.PublicId.Should().Be(packageId);
        stored.ProposedDiscount!.PublicId.Should().Be(discountId);
        stored.ProposedAt.Should().NotBeNull();
        stored.Statement.Should().Be("Welcome aboard");
        stored.QuestionnaireId.Should().NotBeNull();
        stored.CoachPackageId.Should().BeNull("the proposal is the coach's, not the client's choice");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notification = await db.Notifications.SingleAsync(
            n => n.RecipientUserId == client.UserId && n.Type == NotificationType.ClientRequestPackageProposed, Ct);
        JsonDocument.Parse(notification.Data!).RootElement.GetProperty("requestId").GetString().Should().Be(requestId.ToString());

        factory.Services.GetRequiredService<FakeRealtimeNotifier>().Calls.Should().Contain(
            call => call.UserId == client.UserId && call.EventType == "clientrequestpackageproposed");
    }

    [Fact]
    public async Task Propose_WhilePackageProposed_BlocksANewRequestToTheSameCoach()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var requestId = await SendRequestAsync(coach, client);
        (await ProposeAsync(coach, requestId, packageId)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var second = await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct);

        second.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodesAsync(second)).Should().Contain("REQUEST_ALREADY_PENDING");
    }

    [Fact]
    public async Task Propose_UnknownRequestOrAnotherCoachsRequest_Returns404()
    {
        var coach = await CoachWithPaymentsAsync();
        var otherCoach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var otherCoachsRequest = await SendRequestAsync(otherCoach, client);

        var unknown = await ProposeAsync(coach, Guid.NewGuid(), packageId);
        var foreign = await ProposeAsync(coach, otherCoachsRequest, packageId);

        unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ProblemCodeAsync(unknown)).Should().Be("CLIENT_REQUEST_NOT_FOUND");
        foreign.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ProblemCodeAsync(foreign)).Should().Be("CLIENT_REQUEST_NOT_FOUND");
        (await StoredRequestAsync(otherCoachsRequest)).Status.Should().Be(ClientRequestStatus.Pending);
    }

    [Theory]
    [InlineData(ClientRequestStatus.PackageProposed)]
    [InlineData(ClientRequestStatus.Accepted)]
    [InlineData(ClientRequestStatus.Rejected)]
    [InlineData(ClientRequestStatus.Cancelled)]
    [InlineData(ClientRequestStatus.ProposalDeclined)]
    public async Task Propose_RequestNotPending_Returns409InvalidState(ClientRequestStatus status)
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var requestId = await SendRequestAsync(coach, client);
        await SetStatusAsync(requestId, status);

        var response = await ProposeAsync(coach, requestId, packageId);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("CLIENT_REQUEST_INVALID_STATE");
    }

    [Fact]
    public async Task Propose_RequestAlreadyCarriesAClientChosenPackage_Returns409InvalidState()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var chosen = await CreatePackageAsync(coach, name: "Chosen");
        var other = await CreatePackageAsync(coach, name: "Other");
        var requestId = await SendRequestAsync(coach, client, chosen);

        var response = await ProposeAsync(coach, requestId, other);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("CLIENT_REQUEST_INVALID_STATE");
        (await StoredRequestAsync(requestId)).Status.Should().Be(ClientRequestStatus.Pending);
    }

    [Fact]
    public async Task Propose_UnknownOrForeignPackageOrDiscount_Returns404()
    {
        var coach = await CoachWithPaymentsAsync();
        var other = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var ownPackage = await CreatePackageAsync(coach);
        var foreignPackage = await CreatePackageAsync(other);
        var foreignDiscount = await CreateDiscountAsync(other);
        var requestId = await SendRequestAsync(coach, client);

        var cases = new[]
        {
            await ProposeAsync(coach, requestId, Guid.NewGuid()),
            await ProposeAsync(coach, requestId, foreignPackage),
            await ProposeAsync(coach, requestId, ownPackage, Guid.NewGuid()),
            await ProposeAsync(coach, requestId, ownPackage, foreignDiscount),
        };

        cases.Should().OnlyContain(response => response.StatusCode == HttpStatusCode.NotFound);
        (await StoredRequestAsync(requestId)).Status.Should().Be(ClientRequestStatus.Pending);
    }

    [Fact]
    public async Task Propose_ArchivedPackageArchivedDiscountOrDiscountNotCoveringThePackage_Returns409WithItsCode()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach, name: "Online coaching");
        var archivedPackage = await CreatePackageAsync(coach, name: "Old");
        var otherPackage = await CreatePackageAsync(coach, name: "Nutrition");
        var archivedDiscount = await CreateDiscountAsync(coach);
        var narrowDiscount = await CreateDiscountAsync(coach, packageIds: [otherPackage]);
        await coach.Http.PostAsync($"/payments/packages/{archivedPackage}/archive", Empty(), Ct);
        await coach.Http.PostAsync($"/payments/discounts/{archivedDiscount}/archive", Empty(), Ct);
        var requestId = await SendRequestAsync(coach, client);

        var cases = new (HttpResponseMessage Response, string Code)[]
        {
            (await ProposeAsync(coach, requestId, archivedPackage), "PACKAGE_ARCHIVED"),
            (await ProposeAsync(coach, requestId, packageId, archivedDiscount), "DISCOUNT_ARCHIVED"),
            (await ProposeAsync(coach, requestId, packageId, narrowDiscount), "DISCOUNT_PACKAGE_INVALID"),
        };

        foreach (var (response, code) in cases)
        {
            response.StatusCode.Should().Be(HttpStatusCode.Conflict, code);
            (await ProblemCodeAsync(response)).Should().Be(code);
        }

        (await StoredRequestAsync(requestId)).Status.Should().Be(ClientRequestStatus.Pending);
    }

    [Fact]
    public async Task Propose_WithoutPaymentsEntitlement_Returns403()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: false);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var requestId = await SendRequestAsync(coach, client);

        var response = await ProposeAsync(coach, requestId, Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENTS_NOT_ENTITLED");
    }

    [Fact]
    public async Task Propose_CheckInForm_Returns400AndKeepsTheRequestPending()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var checkIn = await CreateFormAsync(coach.UserId, QuestionnaireType.CheckIn);
        var requestId = await SendRequestAsync(coach, client);

        var response = await ProposeAsync(coach, requestId, packageId, formId: checkIn);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodesAsync(response)).Should().Contain("CHECKIN_FORM_NOT_SENDABLE");
        (await StoredRequestAsync(requestId)).Status.Should().Be(ClientRequestStatus.Pending);
    }

    [Fact]
    public async Task Propose_StatementOver1000Characters_Returns400()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var requestId = await SendRequestAsync(coach, client);

        var response = await ProposeAsync(coach, requestId, packageId, statement: new string('x', 1001));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await StoredRequestAsync(requestId)).Status.Should().Be(ClientRequestStatus.Pending);
    }

    [Fact]
    public async Task Propose_ByCoachWhoseRoleWasRemoved_Returns403CoachRoleRemoved()
    {
        var coach = await TestActors.Trainer(factory).WithRemovedCoachRoles(UserRole.Trainer).CreateAsync(Ct);

        var response = await ProposeAsync(coach, Guid.NewGuid(), Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ErrorCodesAsync(response)).Should().Contain("COACH_ROLE_REMOVED");
    }

    private static async Task<List<JsonElement>> EventsAsync(Actor viewer)
    {
        var conversations = JsonDocument.Parse(await (await viewer.Http.GetAsync("/conversations", Ct)).Content.ReadAsStringAsync(Ct));
        var id = conversations.RootElement.EnumerateArray().Single().GetProperty("id").GetGuid();
        var messages = JsonDocument.Parse(await (await viewer.Http.GetAsync($"/conversations/{id}/messages", Ct)).Content.ReadAsStringAsync(Ct));

        return messages.RootElement.GetProperty("items").EnumerateArray()
            .Where(m => m.GetProperty("kind").GetString() == "Event")
            .Select(m => m.Clone())
            .ToList();
    }

    private async Task<Guid> InsertRequestWithoutThreadAsync(Actor coach, Actor client, ClientRequestStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var request = new ClientRequest { ClientProfileId = client.ProfileId, ProfessionalProfileId = coach.ProfileId, Status = status };
        db.ClientRequests.Add(request);
        await db.SaveChangesAsync(Ct);

        return request.PublicId;
    }

    private async Task<bool> ThreadExistsAsync(Actor coach, Actor client)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.Conversations.AnyAsync(c => c.ClientUserId == client.UserId && c.ProfessionalUserId == coach.UserId, Ct);
    }

    [Fact]
    public async Task Propose_WritesACoachAuthoredProposalSentEventButNoStatementMessage()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var requestId = await SendRequestAsync(coach, client);

        (await ProposeAsync(coach, requestId, packageId, statement: "Private note")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var events = await EventsAsync(client);
        var sent = events.Should().ContainSingle(e => e.GetProperty("eventType").GetString() == "ProposalSent").Subject;
        sent.GetProperty("senderId").GetGuid().Should().Be(coach.UserId);
        sent.GetProperty("eventSourceId").GetGuid().Should().Be(requestId);
        sent.GetProperty("eventStatus").GetString().Should().Be("Pending");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ChatMessages.AnyAsync(m => m.Text == "Private note", Ct)).Should().BeFalse();
    }

    [Fact]
    public async Task Propose_WhenNoThreadExists_CreatesNone()
    {
        var coach = await CoachWithPaymentsAsync();
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);
        var requestId = await InsertRequestWithoutThreadAsync(coach, client, ClientRequestStatus.Pending);

        (await ProposeAsync(coach, requestId, packageId)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await ThreadExistsAsync(coach, client)).Should().BeFalse();
    }

    private record RequestCreated(Guid PublicId);
}
