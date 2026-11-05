using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Services;
using FormUp.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FormUp.Tests.Endpoints.Users.EmailLinks;

/// <summary>
/// Tokens in every shape the notification email link endpoints must accept or refuse, plus direct reads and
/// writes of the preference rows they change.
/// </summary>
internal static class EmailLinkTestSupport
{
    /// <summary>The invalid-link scenarios an endpoint must answer identically.</summary>
    public static readonly string[] InvalidScenarios =
        ["signatureTampered", "payloadTampered", "expired", "foreignKey", "unknownUser", "eventWithoutEmail", "garbage", "illegalCharacters"];

    /// <summary>A valid token for the user and event, signed by the running host.</summary>
    public static string Valid(FitnessApiFactory factory, Guid userId, NotificationEvent notificationEvent) =>
        factory.Services.GetRequiredService<IEmailTurnOffTokenService>().Create(userId, notificationEvent);

    /// <summary>
    /// A token for the scenario. Everything except <c>unknownUser</c> belongs to <paramref name="userId"/>;
    /// <c>unknownUser</c> is validly signed for an account that does not exist.
    /// </summary>
    public static string Invalid(FitnessApiFactory factory, string scenario, Guid userId, NotificationEvent notificationEvent)
    {
        var configuration = factory.Services.GetRequiredService<IConfiguration>();

        return scenario switch
        {
            "signatureTampered" => Flip(Valid(factory, userId, notificationEvent), 60),
            "payloadTampered" => Flip(Valid(factory, userId, notificationEvent), 10),
            "expired" => new EmailTurnOffTokenService(configuration, new OffsetTimeProvider(-TimeSpan.FromDays(91)))
                .Create(userId, notificationEvent),
            "foreignKey" => new EmailTurnOffTokenService(OtherSecret(), TimeProvider.System).Create(userId, notificationEvent),
            "unknownUser" => Valid(factory, Guid.NewGuid(), notificationEvent),
            "eventWithoutEmail" => Valid(factory, userId, (NotificationEvent)99),
            "garbage" => "not-a-token",
            "illegalCharacters" => "not a token!*",
            _ => throw new ArgumentOutOfRangeException(nameof(scenario), scenario, null),
        };
    }

    /// <summary>The response body with the per-request trace id removed, so two bodies can be compared.</summary>
    public static async Task<string> ComparableBodyAsync(HttpResponseMessage response) =>
        System.Text.RegularExpressions.Regex.Replace(
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken),
            "\"traceId\":\"[^\"]*\",?",
            string.Empty);

    /// <summary>Saves a preference row straight to the database.</summary>
    public static async Task SeedAsync(
        FitnessApiFactory factory, Guid userId, NotificationEvent notificationEvent, bool email, bool push)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.NotificationPreferences.Add(new NotificationPreference
        {
            UserId = userId,
            Event = notificationEvent,
            EmailEnabled = email,
            PushEnabled = push,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>Every saved preference row of the user.</summary>
    public static async Task<List<NotificationPreference>> RowsAsync(FitnessApiFactory factory, Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private static IConfiguration OtherSecret() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Secret"] = new string('y', 64) })
            .Build();

    private static string Flip(string token, int index) =>
        string.Concat(token.AsSpan(0, index), token[index] == 'A' ? "B" : "A", token.AsSpan(index + 1));

    /// <summary>A clock that runs a fixed distance from the real one.</summary>
    private sealed class OffsetTimeProvider(TimeSpan offset) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => System.GetUtcNow() + offset;
    }
}
