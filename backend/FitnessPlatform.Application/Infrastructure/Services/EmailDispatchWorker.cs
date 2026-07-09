using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Background service that drains <see cref="IBackgroundEmailQueue"/> and performs the
/// actual SMTP/provider send (#702). Introduced so the anonymous resend-verification
/// endpoint can enqueue a send and return immediately instead of awaiting the network
/// round-trip in the request path — see <see cref="IBackgroundEmailQueue"/> for why.
///
/// <para>
/// Mirrors <see cref="SocialLoginNonceReaperService"/>'s scope-per-item pattern: this
/// worker never captures the request's <see cref="CancellationToken"/> (it would already
/// be cancelled by the time this runs, since the request has completed) and never
/// captures the request-scoped <see cref="IEmailService"/> (disposed along with the
/// request's DI scope). Instead every dequeued item is processed inside a fresh scope
/// created from <see cref="IServiceScopeFactory"/>, and the loop runs under this
/// service's own <c>stoppingToken</c>.
/// </para>
/// </summary>
public class EmailDispatchWorker(
    IBackgroundEmailQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<EmailDispatchWorker> logger) : BackgroundService
{
    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("EmailDispatchWorker: starting.");

        try
        {
            await foreach (var item in queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    // Fresh scope per item: the queued item carries only value-copied
                    // data (email, token, language) — never a service reference — so
                    // resolving IEmailService here always gets a live instance, never
                    // one disposed with a long-gone request scope.
                    using var scope = scopeFactory.CreateScope();
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
                    await emailService.SendEmailVerificationAsync(item.Email, item.Token, item.Language, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Never surface a send failure anywhere the request path can see it —
                    // the client already received its generic 200 before this ran. The
                    // token row was already persisted synchronously by the caller, so a
                    // failed send here does not leave the token store inconsistent.
                    logger.LogError(ex,
                        "EmailDispatchWorker: failed to send background verification email to {Email}.",
                        item.Email);
                }
                finally
                {
                    queue.MarkProcessed();
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Graceful shutdown — stoppingToken was cancelled while awaiting the next item.
        }

        logger.LogInformation("EmailDispatchWorker: stopped.");
    }
}
