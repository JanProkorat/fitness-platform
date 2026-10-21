using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.PaymentSettings.Shared;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.PaymentSettings;

/// <summary>
/// Integration tests for <c>GET</c> and <c>PUT /payments/settings</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class PaymentSettingsEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions WireOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public async Task Get_CoachWithNoSettingsYet_ReturnsDefaultsAndNoIban()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await coach.Http.GetAsync("/payments/settings", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var settings = await response.Content.ReadFromJsonAsync<PaymentSettingsDto>(WireOptions, TestContext.Current.CancellationToken);
        settings!.Iban.Should().BeNull();
        settings.PaymentDueDays.Should().Be(7);
        settings.MessageFormat.Should().Be(PaymentMessageFormat.PackageNameAndMonth);
        settings.VariableSymbolFormat.Should().Be(VariableSymbolFormat.YearMonthClientNumber);
    }

    [Fact]
    public async Task Put_ValidSettings_PersistsThemAndLeavesTheBankAccountAlone()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SetBankAccountAsync(factory, coach, ValidIban);

        var response = await coach.Http.PutAsJsonAsync(
            "/payments/settings",
            new { PaymentDueDays = 14, MessageFormat = "ClientNameAndMonth", VariableSymbolFormat = "YearMonthSequence" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var stored = await ReadSettingsAsync(factory, coach);
        stored!.PaymentDueDays.Should().Be(14);
        stored.MessageFormat.Should().Be(PaymentMessageFormat.ClientNameAndMonth);
        stored.VariableSymbolFormat.Should().Be(VariableSymbolFormat.YearMonthSequence);
        stored.Iban.Should().Be(ValidIban);
    }

    [Fact]
    public async Task Put_DueDaysOutOfRange_Returns400AndStoresNothing()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await coach.Http.PutAsJsonAsync(
            "/payments/settings",
            new { PaymentDueDays = 0, MessageFormat = "PackageName", VariableSymbolFormat = "YearMonthClientNumber" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadSettingsAsync(factory, coach)).Should().BeNull();
    }
}
