using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using FluentAssertions;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using NSubstitute;
using Resend;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// The "Turn off these emails" footer link and the RFC 8058 <c>List-Unsubscribe</c> headers as each email provider
/// sends them: on the five coach notification emails only, never on account, payment or security emails.
/// </summary>
public partial class NotificationEmailHeadersTests
{
    private const string BaseUrl = "https://app.example.com";

    private static readonly Guid UserId = Guid.NewGuid();

    private static readonly byte[] FakePng = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];

    public static TheoryData<string, NotificationEvent> EveryProviderAndNotificationEvent()
    {
        var data = new TheoryData<string, NotificationEvent>();

        foreach (var provider in new[] { "Smtp", "Resend" })
        {
            foreach (var notificationEvent in Enum.GetValues<NotificationEvent>())
            {
                data.Add(provider, notificationEvent);
            }
        }

        return data;
    }

    public static TheoryData<string, string> EveryProviderAndNonNotificationEmail()
    {
        var data = new TheoryData<string, string>();

        foreach (var provider in new[] { "Smtp", "Resend" })
        {
            foreach (var email in new[] { "verification", "passwordReset", "invitation", "bankAccountChanged", "reauthCode", "paymentRequest" })
            {
                data.Add(provider, email);
            }
        }

        return data;
    }

    private static IConfiguration Configuration(int smtpPort = 1025) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:SmtpHost"] = "127.0.0.1",
            ["Email:SmtpPort"] = smtpPort.ToString(),
            ["Email:FromAddress"] = "noreply@example.com",
            ["Email:FromName"] = "Form Up",
            ["App:BaseUrl"] = BaseUrl,
            ["Jwt:Secret"] = new string('s', 64),
        }).Build();

    private static NotificationEmailWorkItem Item(NotificationEvent notificationEvent) =>
        new(
            "coach@example.com",
            "cs",
            UserId,
            notificationEvent,
            new Dictionary<string, string>
            {
                [NotificationEmailWorkItem.ClientNameKey] = "Petra Svobodova",
                [NotificationEmailWorkItem.ActionUrlKey] = "https://app.example.com/clients/abc",
                [NotificationEmailWorkItem.PhotoCountKey] = "2",
            });

    [Theory]
    [MemberData(nameof(EveryProviderAndNotificationEvent))]
    public async Task NotificationEmail_EachProviderAndEvent_CarriesTheOneClickHeadersAndTheTurnOffFooter(
        string provider, NotificationEvent notificationEvent)
    {
        var sent = await SendAsync(provider, service => service.SendNotificationEmailAsync(Item(notificationEvent), TestContext.Current.CancellationToken));

        sent.Headers["List-Unsubscribe-Post"].Should().Be("List-Unsubscribe=One-Click");
        var link = OneClickLink().Match(sent.Headers["List-Unsubscribe"]);
        link.Success.Should().BeTrue("the header is a single <url> pointing at the one-click endpoint");
        new EmailTurnOffTokenService(Configuration(), TimeProvider.System).Validate(link.Groups[1].Value)
            .Should().Be(new EmailTurnOffTokenClaims(UserId, notificationEvent));
        sent.Html.Should().Contain($"{BaseUrl}/email-off?token=").And.Contain($"{BaseUrl}/settings");
    }

    [Theory]
    [MemberData(nameof(EveryProviderAndNonNotificationEmail))]
    public async Task OtherEmails_EachProvider_HaveNeitherTheHeadersNorTheTurnOffFooter(string provider, string email)
    {
        var ct = TestContext.Current.CancellationToken;

        var sent = await SendAsync(provider, service => email switch
        {
            "verification" => service.SendEmailVerificationAsync("eva@example.com", "verify-token", "cs", ct),
            "passwordReset" => service.SendPasswordResetEmailAsync("eva@example.com", "reset-token", "cs", ct),
            "invitation" => service.SendInvitationEmailAsync("eva@example.com", "Martin Kral", "invite-token", "cs", null, null, ct),
            "bankAccountChanged" => service.SendBankAccountChangedEmailAsync("eva@example.com", "CZ65***", "CZ12***", "undo-token", "cs", ct),
            "reauthCode" => service.SendReauthCodeEmailAsync("eva@example.com", "123456", "cs", ct),
            _ => service.SendPaymentRequestEmailAsync(PaymentRequest(), ct),
        });

        sent.Headers.Keys.Should().NotContain(["List-Unsubscribe", "List-Unsubscribe-Post"]);
        sent.Html.Should().NotContain("/email-off").And.NotContain("Vypnout tyto e-maily");
    }

    private static PaymentRequestEmail PaymentRequest() => new(
        "eva@example.com",
        "cs",
        "Martin Král",
        "Online coaching",
        new DateOnly(2026, 11, 1),
        new DateOnly(2026, 11, 30),
        1750m,
        2500m,
        null,
        new DateOnly(2026, 11, 1),
        "CZ6508000000192000145399",
        "2026110142",
        "Online coaching 11/2026",
        FakePng,
        PaymentMessageComposer.QrContentId);

    private sealed record SentEmail(IReadOnlyDictionary<string, string> Headers, string Html);

    private static async Task<SentEmail> SendAsync(string provider, Func<IEmailService, Task> send)
    {
        if (provider == "Resend")
        {
            var resend = Substitute.For<IResend>();

            await send(new ResendEmailService(resend, Configuration(), NullLogger<ResendEmailService>.Instance));

            var message = (EmailMessage)resend.ReceivedCalls().Single().GetArguments()[0]!;

            return new SentEmail(
                message.Headers?.ToDictionary(header => header.Key, header => header.Value) ?? [],
                message.HtmlBody!);
        }

        await using var server = FakeSmtpServer.Start();

        await send(new SmtpEmailService(Configuration(server.Port), NullLogger<SmtpEmailService>.Instance));

        var received = await server.ReceivedAsync();

        return new SentEmail(
            received.Headers
                .GroupBy(header => header.Field, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First().Value, StringComparer.OrdinalIgnoreCase),
            received.HtmlBody ?? string.Empty);
    }

    [GeneratedRegex(@"^<https://app\.example\.com/users/email-links/one-click\?token=([A-Za-z0-9_-]+)>$")]
    private static partial Regex OneClickLink();

    /// <summary>
    /// A one-connection SMTP server that accepts one message and keeps it for inspection.
    /// </summary>
    private sealed class FakeSmtpServer : IAsyncDisposable
    {
        private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
        private readonly TaskCompletionSource<byte[]> _received = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private Task _serving = Task.CompletedTask;

        public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;

        public static FakeSmtpServer Start()
        {
            var server = new FakeSmtpServer();
            server._listener.Start();
            server._serving = Task.Run(server.ServeAsync);

            return server;
        }

        public async Task<MimeMessage> ReceivedAsync()
        {
            var raw = await _received.Task.WaitAsync(TimeSpan.FromSeconds(20), TestContext.Current.CancellationToken);
            using var stream = new MemoryStream(raw);

            return await MimeMessage.LoadAsync(stream, TestContext.Current.CancellationToken);
        }

        public async ValueTask DisposeAsync()
        {
            _listener.Stop();

            try
            {
                await _serving;
            }
            catch (Exception ex) when (ex is SocketException or ObjectDisposedException or IOException)
            {
                // The listener was stopped while a connection was pending.
            }
        }

        private async Task ServeAsync()
        {
            using var client = await _listener.AcceptTcpClientAsync();
            await using var stream = client.GetStream();
            using var reader = new StreamReader(stream, Encoding.ASCII);
            await using var writer = new StreamWriter(stream, new UTF8Encoding(false)) { NewLine = "\r\n", AutoFlush = true };

            await writer.WriteLineAsync("220 fake ESMTP");

            while (await reader.ReadLineAsync() is { } line)
            {
                if (line.StartsWith("EHLO", StringComparison.OrdinalIgnoreCase) || line.StartsWith("HELO", StringComparison.OrdinalIgnoreCase))
                {
                    await writer.WriteLineAsync("250 fake");
                }
                else if (line.StartsWith("DATA", StringComparison.OrdinalIgnoreCase))
                {
                    await writer.WriteLineAsync("354 go ahead");
                    _received.TrySetResult(await ReadDataAsync(reader));
                    await writer.WriteLineAsync("250 queued");
                }
                else if (line.StartsWith("QUIT", StringComparison.OrdinalIgnoreCase))
                {
                    await writer.WriteLineAsync("221 bye");
                    return;
                }
                else
                {
                    await writer.WriteLineAsync("250 OK");
                }
            }
        }

        private static async Task<byte[]> ReadDataAsync(StreamReader reader)
        {
            var data = new StringBuilder();

            while (await reader.ReadLineAsync() is { } line && line != ".")
            {
                data.Append(line.StartsWith("..", StringComparison.Ordinal) ? line[1..] : line).Append("\r\n");
            }

            return Encoding.UTF8.GetBytes(data.ToString());
        }
    }
}
