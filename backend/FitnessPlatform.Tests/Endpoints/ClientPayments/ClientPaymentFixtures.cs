using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.ListClientPaymentRows;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Features.CoachPackages.Shared;
using FitnessPlatform.Application.Features.Discounts.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// A coach with payments, a bank account and one linked client, plus the calls the client payment tests share.
/// </summary>
internal static class ClientPaymentFixtures
{
    /// <summary>The wire format: web defaults, enums as strings.</summary>
    public static readonly JsonSerializerOptions Wire = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>A coach, one of their clients and the route prefix for that client.</summary>
    public sealed record PaymentWorld(FitnessApiFactory Factory, Actor Coach, Actor Client)
    {
        /// <summary>Route prefix of the client's payment endpoints.</summary>
        public string Route => $"/payments/clients/{Client.PublicId}";
    }

    /// <summary>Today in Prague, as the endpoints see it.</summary>
    public static DateOnly Today => ClientPaymentSchedule.Today(DateTime.UtcNow);

    /// <summary>An empty JSON body for bodyless POSTs.</summary>
    public static JsonContent Empty() => JsonContent.Create(new { });

    /// <summary>
    /// Builds a trainer named Martin Král with payments entitlement and (by default) a bank account, and
    /// one linked client named Eva Svobodová.
    /// </summary>
    public static async Task<PaymentWorld> CreateWorldAsync(
        FitnessApiFactory factory, bool bankAccount = true, bool entitled = true, string clientLanguage = "cs")
    {
        var ct = TestContext.Current.CancellationToken;
        var coach = await TestActors.Trainer(factory).WithName("Martin", "Král").CreateAsync(ct);
        await SubscribeAsync(factory, coach, entitled);

        if (bankAccount)
        {
            await SetBankAccountAsync(factory, coach, ValidIban);
        }

        var client = await TestActors.Client(factory).WithName("Eva", "Svobodová").WithLanguage(clientLanguage).CreateAsync(ct);
        await TestActors.Link(factory, coach, client).CreateAsync(ct);

        return new PaymentWorld(factory, coach, client);
    }

    /// <summary>Adds another client linked to the same coach.</summary>
    public static async Task<Actor> AddClientAsync(PaymentWorld world, string firstName = "Jan", string lastName = "Novák")
    {
        var ct = TestContext.Current.CancellationToken;
        var client = await TestActors.Client(world.Factory).WithName(firstName, lastName).WithLanguage("cs").CreateAsync(ct);
        await TestActors.Link(world.Factory, world.Coach, client).CreateAsync(ct);

        return client;
    }

    /// <summary>Creates a package for the coach and returns its public id.</summary>
    public static async Task<Guid> CreatePackageAsync(
        Actor coach,
        decimal price = 2500m,
        string name = "Online coaching",
        string billing = "Monthly",
        int? intervalWeeks = null,
        int? runsFor = null)
    {
        var response = await coach.Http.PostAsJsonAsync(
            "/payments/packages",
            new { Name = name, Price = price, Billing = billing, IntervalWeeks = intervalWeeks, RunsForPayments = runsFor, ShowOnProfile = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<CoachPackageDto>(Wire, TestContext.Current.CancellationToken))!.PackageId;
    }

    /// <summary>Creates a percentage discount for the coach and returns its public id.</summary>
    public static async Task<Guid> CreateDiscountAsync(
        Actor coach,
        decimal percent = 30m,
        string duration = "EveryPayment",
        int? durationPayments = null,
        IEnumerable<Guid>? packageIds = null,
        string name = "Friends & family")
    {
        var response = await coach.Http.PostAsJsonAsync(
            "/payments/discounts",
            new
            {
                Name = name,
                Type = "Percentage",
                Value = percent,
                Duration = duration,
                DurationPayments = durationPayments,
                AppliesToAllPackages = packageIds is null,
                PackageIds = packageIds ?? []
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<CoachDiscountDto>(Wire, TestContext.Current.CancellationToken))!.DiscountId;
    }

    /// <summary>Sets the client's terms and returns the raw response.</summary>
    public static Task<HttpResponseMessage> SetTermsAsync(
        PaymentWorld world, Guid packageId, Guid? discountId = null, decimal? customPrice = null, DateOnly? firstPeriodStart = null) =>
        world.Coach.Http.PutAsJsonAsync(
            $"{world.Route}/terms",
            new { PackageId = packageId, DiscountId = discountId, CustomPrice = customPrice, FirstPeriodStart = firstPeriodStart },
            TestContext.Current.CancellationToken);

    /// <summary>Sets the client's terms, expecting success.</summary>
    public static async Task SetTermsOkAsync(
        PaymentWorld world, Guid packageId, Guid? discountId = null, decimal? customPrice = null, DateOnly? firstPeriodStart = null)
    {
        var response = await SetTermsAsync(world, packageId, discountId, customPrice, firstPeriodStart);

        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    /// <summary>Lists the client's payments as the coach, expecting success.</summary>
    public static async Task<List<ClientPaymentRowDto>> ListAsync(PaymentWorld world)
    {
        var response = await world.Coach.Http.GetAsync($"{world.Route}/payments", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return (await response.Content.ReadFromJsonAsync<ListClientPaymentRowsResponse>(Wire, TestContext.Current.CancellationToken))!.Payments;
    }

    /// <summary>Sets terms for a monthly package and returns the rows, oldest period first.</summary>
    public static async Task<List<ClientPaymentRowDto>> StartMonthlyAsync(
        PaymentWorld world, decimal price = 2500m, Guid? discountId = null)
    {
        var packageId = await CreatePackageAsync(world.Coach, price);
        await SetTermsOkAsync(world, packageId, discountId);

        return (await ListAsync(world)).OrderBy(p => p.PeriodStart).ToList();
    }

    /// <summary>Posts to one of the client's payment actions.</summary>
    public static Task<HttpResponseMessage> PostActionAsync(PaymentWorld world, Guid paymentId, string action, object? body = null) =>
        world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/payments/{paymentId}/{action}", body ?? new { }, TestContext.Current.CancellationToken);

    /// <summary>Reads a response body as the given type, using the wire format.</summary>
    public static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(Wire, TestContext.Current.CancellationToken))!;

    /// <summary>Reads the stored payment row.</summary>
    public static async Task<ClientPayment> ReadStoredAsync(FitnessApiFactory factory, Guid paymentId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientPayments.AsNoTracking().FirstAsync(p => p.PublicId == paymentId, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads every audit row filed under the coach's assignment for the client.</summary>
    public static async Task<List<AuditLog>> ReadAuditAsync(PaymentWorld world)
    {
        using var scope = world.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var assignmentId = await db.ClientPaymentAssignments.AsNoTracking()
            .Where(a => a.ProfessionalProfileId == world.Coach.ProfileId && a.ClientProfileId == world.Client.ProfileId)
            .Select(a => a.PublicId)
            .FirstAsync(TestContext.Current.CancellationToken);

        return await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityId == assignmentId)
            .OrderBy(a => a.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Inserts a requested recurring payment for a past period straight into the database, so overdue
    /// handling can be tested without waiting.
    /// </summary>
    public static async Task<Guid> SeedPastPaymentAsync(
        PaymentWorld world, DateOnly dueDate, ClientPaymentStatus status = ClientPaymentStatus.Requested, decimal amount = 1000m)
    {
        using var scope = world.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var assignment = await db.ClientPaymentAssignments.FirstAsync(
            a => a.ProfessionalProfileId == world.Coach.ProfileId && a.ClientProfileId == world.Client.ProfileId,
            TestContext.Current.CancellationToken);

        var payment = new ClientPayment
        {
            ClientPaymentAssignmentId = assignment.Id,
            ProfessionalProfileId = world.Coach.ProfileId,
            Kind = ClientPaymentKind.OneOff,
            Status = status,
            DueDate = dueDate,
            Amount = amount,
            Title = "Seeded",
            VariableSymbol = $"{dueDate.Year}{dueDate.Month:D2}9{Random.Shared.Next(100, 999)}",
            AccountIban = ValidIban,
            AccountHolder = "Martin Král",
            Message = "Seeded",
            RequestedAt = DateTime.UtcNow.AddDays(-10)
        };
        db.ClientPayments.Add(payment);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return payment.PublicId;
    }

    /// <summary>Resolves the fake email service shared by the test host.</summary>
    public static FakeEmailService Email(FitnessApiFactory factory) => factory.Services.GetRequiredService<FakeEmailService>();
}
