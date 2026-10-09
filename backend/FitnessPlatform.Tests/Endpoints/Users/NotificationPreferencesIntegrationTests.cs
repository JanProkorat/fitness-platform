using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Users;

/// <summary>
/// Integration tests for <c>GET</c> and <c>PUT /users/me/notification-preferences</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class NotificationPreferencesIntegrationTests(FitnessApiFactory factory)
{
    private const string Route = "/users/me/notification-preferences";

    private static readonly string[] AllEventNames =
        ["NewMessage", "WeeklyCheckInSubmitted", "JoinRequest", "ProgressPhotosSubmitted", "WorkoutFinished"];

    private static object FullSet(bool email, bool push) => new
    {
        Preferences = AllEventNames.Select(name => new { Event = name, Email = email, Push = push }).ToArray(),
    };

    [Fact]
    public async Task Get_NoSavedRows_ReturnsBoardDefaults()
    {
        var ct = TestContext.Current.CancellationToken;
        var actor = await TestActors.Client(factory).CreateAsync(ct);

        var response = await actor.Http.GetAsync(Route, ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PreferencesBody>(ct);
        body!.Preferences.Select(p => (p.Event, p.Email, p.Push)).Should().BeEquivalentTo(
        [
            ("NewMessage", true, true),
            ("WeeklyCheckInSubmitted", true, true),
            ("JoinRequest", true, true),
            ("ProgressPhotosSubmitted", false, true),
            ("WorkoutFinished", false, false),
        ]);
    }

    [Fact]
    public async Task PutThenGet_RoundTripsSavedValues()
    {
        var ct = TestContext.Current.CancellationToken;
        var actor = await TestActors.Client(factory).CreateAsync(ct);

        var put = await actor.Http.PutAsJsonAsync(Route, FullSet(email: false, push: false), ct);
        var get = await actor.Http.GetAsync(Route, ct);

        put.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var body = await get.Content.ReadFromJsonAsync<PreferencesBody>(ct);
        body!.Preferences.Should().HaveCount(5).And.OnlyContain(p => !p.Email && !p.Push);
    }

    [Fact]
    public async Task PutTwice_UpdatesSameRowsWithoutDuplicates()
    {
        var ct = TestContext.Current.CancellationToken;
        var actor = await TestActors.Client(factory).CreateAsync(ct);

        (await actor.Http.PutAsJsonAsync(Route, FullSet(email: false, push: false), ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await actor.Http.PutAsJsonAsync(Route, FullSet(email: true, push: true), ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var body = await (await actor.Http.GetAsync(Route, ct)).Content.ReadFromJsonAsync<PreferencesBody>(ct);
        body!.Preferences.Should().HaveCount(5).And.OnlyContain(p => p.Email && p.Push);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.NotificationPreferences.CountAsync(p => p.UserId == actor.UserId, ct)).Should().Be(5);
    }

    [Fact]
    public async Task Put_MissingEvent_Returns400()
    {
        var ct = TestContext.Current.CancellationToken;
        var actor = await TestActors.Client(factory).CreateAsync(ct);
        var partial = new { Preferences = new[] { new { Event = "NewMessage", Email = true, Push = true } } };

        var response = await actor.Http.PutAsJsonAsync(Route, partial, ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record PreferenceItem(string Event, bool Email, bool Push);

    private record PreferencesBody(List<PreferenceItem> Preferences);
}
