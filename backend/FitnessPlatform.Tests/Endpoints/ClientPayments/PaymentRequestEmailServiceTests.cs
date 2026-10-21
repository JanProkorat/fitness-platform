using System.Net;
using System.Net.Sockets;
using System.Text;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using NSubstitute;
using Resend;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// The payment request email as each provider builds it: the QR code goes out as an inline image the HTML
/// refers to by content id, in the recipient's language, with user text encoded.
/// </summary>
public class PaymentRequestEmailServiceTests
{
    private static readonly byte[] FakePng = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];

    private static PaymentRequestEmail Email(string language = "cs", string package = "Online coaching") => new(
        "eva@example.com",
        language,
        "Martin Král",
        package,
        new DateOnly(2026, 11, 1),
        new DateOnly(2026, 11, 30),
        1750m,
        2500m,
        "Friends & family −30 %",
        new DateOnly(2026, 11, 1),
        "CZ6508000000192000145399",
        "2026110142",
        "Online coaching 11/2026",
        FakePng,
        PaymentMessageComposer.QrContentId);

    private static IConfiguration Configuration(int smtpPort = 1025) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:SmtpHost"] = "127.0.0.1",
            ["Email:SmtpPort"] = smtpPort.ToString(),
            ["Email:FromAddress"] = "noreply@example.com",
            ["Email:FromName"] = "Form Up",
            ["App:BaseUrl"] = "https://app.example.com"
        }).Build();

    [Fact]
    public async Task Resend_PaymentRequest_AttachesTheQrInlineUnderTheContentIdTheHtmlUses()
    {
        var resend = Substitute.For<IResend>();
        var service = new ResendEmailService(resend, Configuration(), NullLogger<ResendEmailService>.Instance);

        await service.SendPaymentRequestEmailAsync(Email(), TestContext.Current.CancellationToken);

        var message = (EmailMessage)resend.ReceivedCalls().Single().GetArguments()[0]!;
        message.To.Select(t => t.Email).Should().Equal("eva@example.com");
        message.Subject.Should().StartWith("Martin Král: 1");
        message.HtmlBody.Should().Contain($"cid:{PaymentMessageComposer.QrContentId}");
        var attachment = message.Attachments!.Should().ContainSingle().Subject;
        attachment.ContentId.Should().Be(PaymentMessageComposer.QrContentId);
        attachment.ContentType.Should().Be("image/png");
        attachment.Content!.Value.AsByteArray().Should().Equal(FakePng);
    }

    [Theory]
    [InlineData("cs", "Částka", "ŽÁDOST O PLATBU")]
    [InlineData("en", "Amount", "PAYMENT REQUEST")]
    [InlineData("de", "Betrag", "ZAHLUNGSAUFFORDERUNG")]
    public async Task Resend_PaymentRequest_IsWrittenInTheRecipientsLanguage(string language, string amountLabel, string title)
    {
        var resend = Substitute.For<IResend>();
        var service = new ResendEmailService(resend, Configuration(), NullLogger<ResendEmailService>.Instance);

        await service.SendPaymentRequestEmailAsync(Email(language), TestContext.Current.CancellationToken);

        var message = (EmailMessage)resend.ReceivedCalls().Single().GetArguments()[0]!;
        message.HtmlBody.Should().Contain(amountLabel).And.Contain(title);
    }

    [Fact]
    public async Task Resend_PaymentRequest_EncodesUserTextInTheHtml()
    {
        var resend = Substitute.For<IResend>();
        var service = new ResendEmailService(resend, Configuration(), NullLogger<ResendEmailService>.Instance);

        await service.SendPaymentRequestEmailAsync(Email("en", "<img src=x onerror=alert(1)>"), TestContext.Current.CancellationToken);

        var message = (EmailMessage)resend.ReceivedCalls().Single().GetArguments()[0]!;
        message.HtmlBody.Should().NotContain("<img src=x").And.Contain("&lt;img src=x onerror=alert(1)&gt;");
    }

    [Fact]
    public async Task Smtp_PaymentRequest_SendsMultipartRelatedWithTheQrAsALinkedResource()
    {
        await using var server = FakeSmtpServer.Start();
        var service = new SmtpEmailService(Configuration(server.Port), NullLogger<SmtpEmailService>.Instance);

        await service.SendPaymentRequestEmailAsync(Email(), TestContext.Current.CancellationToken);

        var message = await server.ReceivedAsync();
        message.Subject.Should().Contain("Martin Král").And.Contain("za listopad 2026");
        message.To.Mailboxes.Single().Address.Should().Be("eva@example.com");

        var related = message.Body.Should().BeAssignableTo<Multipart>().Subject;
        related.ContentType.MimeType.Should().Be("multipart/related");
        var image = related.OfType<MimePart>().Single(part => part.ContentType.MimeType == "image/png");
        image.ContentId.Should().Be(PaymentMessageComposer.QrContentId);
        using var imageBytes = new MemoryStream();
        await image.Content.DecodeToAsync(imageBytes, TestContext.Current.CancellationToken);
        imageBytes.ToArray().Should().Equal(FakePng);

        message.HtmlBody.Should().Contain($"cid:{PaymentMessageComposer.QrContentId}").And.Contain("Částka");
    }

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
