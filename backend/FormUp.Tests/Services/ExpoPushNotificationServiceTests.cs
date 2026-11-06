using System.Net;
using System.Text;
using FluentAssertions;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace FormUp.Tests.Services;

/// <summary>
/// <see cref="ExpoPushNotificationService"/> pruning of tokens whose Expo ticket says
/// <c>DeviceNotRegistered</c>. Reuses the Postgres fixture of <see cref="NotificationServiceTests"/>.
/// </summary>
[Collection("NotificationService")]
public class ExpoPushNotificationServiceTests(NotificationServiceContainerFixture containerFixture) : IAsyncLifetime
{
    private readonly ApplicationDbContext _db =
        NotificationServiceContainerFixture.BuildDbContext(containerFixture.ConnectionString);

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync() => await _db.DisposeAsync();

    private static string NewToken() => $"ExponentPushToken[{Guid.NewGuid():N}]";

    private async Task InsertUserAsync(Guid userId)
    {
        await using var conn = new NpgsqlConnection(containerFixture.ConnectionString);
        await conn.OpenAsync(TestContext.Current.CancellationToken);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO users (
                id, user_name, normalized_user_name,
                email, normalized_email, email_confirmed,
                password_hash, security_stamp, concurrency_stamp,
                phone_number_confirmed, two_factor_enabled,
                lockout_enabled, access_failed_count,
                first_name, last_name, is_active, date_created,
                gdpr_consent, verification_emails_sent, time_zone
            ) VALUES (
                @id, @email, @emailUpper,
                @email, @emailUpper, true,
                '', gen_random_uuid()::text, gen_random_uuid()::text,
                false, false,
                true, 0,
                'Test', 'User', true, now(),
                true, 0, 'Europe/Prague'
            )";
        cmd.Parameters.AddWithValue("id", userId);
        cmd.Parameters.AddWithValue("email", $"{userId:N}@expo-push-test.com");
        cmd.Parameters.AddWithValue("emailUpper", $"{userId:N}@EXPO-PUSH-TEST.COM");
        await cmd.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedAsync(Guid userId, params string[] tokens)
    {
        await InsertUserAsync(userId);

        foreach (var token in tokens)
        {
            _db.DevicePushTokens.Add(new DevicePushToken { UserId = userId, Token = token, Platform = "ios" });
        }

        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<string>> TokensOfAsync(Guid userId)
    {
        await using var db = NotificationServiceContainerFixture.BuildDbContext(containerFixture.ConnectionString);
        return await db.DevicePushTokens
            .Where(t => t.UserId == userId)
            .Select(t => t.Token)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private ExpoPushNotificationService BuildService(HttpStatusCode status, string responseJson, CapturingLogger logger) =>
        new(new StubHttpClientFactory(new StubHandler(status, _ => responseJson)), _db, logger);

    [Fact]
    public async Task SendAsync_DeviceNotRegisteredTicket_PrunesOnlyThatToken()
    {
        var userId = Guid.NewGuid();
        var stale = NewToken();
        var healthy = NewToken();
        await SeedAsync(userId, stale, healthy);
        var logger = new CapturingLogger();

        // Tickets follow the order of the messages Expo received, so the stub builds them from the request.
        var service = new ExpoPushNotificationService(
            new StubHttpClientFactory(new StubHandler(HttpStatusCode.OK, requestBody =>
            {
                using var sent = System.Text.Json.JsonDocument.Parse(requestBody);
                var tickets = sent.RootElement.EnumerateArray().Select(message => message.GetProperty("to").GetString() == stale
                    ? $$$"""{"status":"error","message":"\"{{{stale}}}\" is not a registered push notification recipient","details":{"error":"DeviceNotRegistered"}}"""
                    : """{"status":"ok","id":"11111111-1111-1111-1111-111111111111"}""");
                return $$"""{"data":[{{string.Join(",", tickets)}}]}""";
            })),
            _db,
            logger);

        await service.SendAsync(userId, "title", "body", ct: TestContext.Current.CancellationToken);

        (await TokensOfAsync(userId)).Should().Equal(healthy);
        logger.Text.Should().NotContain(stale).And.NotContain(healthy);
    }

    [Fact]
    public async Task SendAsync_AllTicketsOk_KeepsEveryToken()
    {
        var userId = Guid.NewGuid();
        var token = NewToken();
        await SeedAsync(userId, token);
        var service = BuildService(
            HttpStatusCode.OK, """{"data":[{"status":"ok","id":"11111111-1111-1111-1111-111111111111"}]}""", new CapturingLogger());

        await service.SendAsync(userId, "title", "body", ct: TestContext.Current.CancellationToken);

        (await TokensOfAsync(userId)).Should().Equal(token);
    }

    [Fact]
    public async Task SendAsync_NonJsonSuccessBody_KeepsTokensAndDoesNotReportAFailedSend()
    {
        var userId = Guid.NewGuid();
        var token = NewToken();
        await SeedAsync(userId, token);
        var logger = new CapturingLogger();
        var service = BuildService(HttpStatusCode.OK, "<html>gateway ok</html>", logger);

        await service.SendAsync(userId, "title", "body", ct: TestContext.Current.CancellationToken);

        (await TokensOfAsync(userId)).Should().Equal(token);
        logger.Text.Should().NotContain("Failed to send").And.NotContain("gateway ok");
    }

    [Fact]
    public async Task SendAsync_RequestLevelError_KeepsTokensAndNeverLogsTheBody()
    {
        var userId = Guid.NewGuid();
        var token = NewToken();
        await SeedAsync(userId, token);
        var logger = new CapturingLogger();
        var service = BuildService(
            HttpStatusCode.BadRequest,
            $$"""{"errors":[{"code":"VALIDATION_ERROR","message":"\"{{token}}\" is not valid"}]}""",
            logger);

        await service.SendAsync(userId, "title", "body", ct: TestContext.Current.CancellationToken);

        (await TokensOfAsync(userId)).Should().Equal(token);
        logger.Text.Should().Contain("VALIDATION_ERROR").And.NotContain(token);
    }

    private sealed class StubHandler(HttpStatusCode status, Func<string, string> respond) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var requestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(respond(requestBody), Encoding.UTF8, "application/json")
            };
        }
    }

    private sealed class StubHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class CapturingLogger : ILogger<ExpoPushNotificationService>
    {
        private readonly StringBuilder _text = new();

        public string Text => _text.ToString();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            _text.AppendLine(formatter(state, exception));
            if (exception is not null)
            {
                _text.AppendLine(exception.ToString());
            }
        }
    }
}
