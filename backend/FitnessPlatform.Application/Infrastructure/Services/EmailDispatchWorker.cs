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
/// created from <see cref="IServiceScopeFactory"/>.
/// </para>
///
/// <para>
/// Graceful shutdown drain (#705): on host shutdown, <c>stoppingToken</c> cancelling used
/// to make <c>ReadAllAsync</c> throw <see cref="OperationCanceledException"/> immediately,
/// dropping any items still buffered in the channel plus a send that was in flight. Now a
/// callback registered on <c>stoppingToken</c> calls <see cref="IBackgroundEmailQueue.Complete"/>
/// so the channel writer closes (new enqueues start failing cleanly — see
/// <see cref="IBackgroundEmailQueue.Complete"/>), while the read loop itself runs on
/// <see cref="CancellationToken.None"/> so it keeps draining the already-buffered items
/// and completes naturally once they're exhausted, instead of being torn down by
/// cancellation. Each send also runs on <see cref="CancellationToken.None"/> so an
/// in-flight/drained send finishes rather than being cancelled mid-send. The drain has no
/// separate timer of its own — it stays bounded by the host's overall
/// <c>HostOptions.ShutdownTimeout</c>, which governs how long the host waits for this
/// <see cref="BackgroundService"/>'s <c>ExecuteAsync</c> task before moving on regardless.
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

        // Shutdown begins → stop accepting new items immediately, but let the loop below
        // keep draining whatever is already buffered — see the class remarks (#705).
        using var completeOnShutdown = stoppingToken.Register(queue.Complete);

        try
        {
            // Deliberately CancellationToken.None, not stoppingToken: queue.Complete()
            // (registered above) closes the channel writer on shutdown, so
            // Channel.Reader.ReadAllAsync finishes naturally once every buffered item has
            // been yielded rather than throwing OperationCanceledException and abandoning
            // them mid-drain.
            await foreach (var item in queue.ReadAllAsync(CancellationToken.None))
            {
                try
                {
                    // Fresh scope per item: the queued item carries only value-copied
                    // data (email, token, language) — never a service reference — so
                    // resolving IEmailService here always gets a live instance, never
                    // one disposed with a long-gone request scope.
                    using var scope = scopeFactory.CreateScope();
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                    // CancellationToken.None: a send picked up during the shutdown drain
                    // (or already in flight when shutdown began) must be allowed to finish
                    // rather than being cancelled mid-send by stoppingToken.
                    await emailService.SendEmailVerificationAsync(item.Email, item.Token, item.Language, CancellationToken.None);
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
            // Defensive backstop only: the read loop above runs on CancellationToken.None,
            // so it should never actually throw OCE. Kept in case a future change
            // reintroduces a cancellable await inside the loop.
        }

        logger.LogInformation("EmailDispatchWorker: stopped.");
    }
}
