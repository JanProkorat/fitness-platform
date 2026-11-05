using System.Net.Http.Json;
using System.Reflection;
using System.Runtime.ExceptionServices;
using FluentAssertions;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Services;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace FormUp.Tests.Services;

/// <summary>
/// A burst that cannot be handled is dropped, so it cannot hold up the bursts behind it. The failure is injected
/// by a database proxy that throws while one chosen burst is being built.
/// </summary>
[Collection(TestCollection.Name)]
public class NotificationEmailGroupDiscardTests(FitnessApiFactory factory) : IAsyncLifetime
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    /// <inheritdoc />
    public async ValueTask InitializeAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        await db.PendingNotificationEmails.ExecuteDeleteAsync(Ct);
    }

    /// <inheritdoc />
    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task RunDueNowAsync_BurstThatFailsToBuild_IsDiscardedAndTheNextBurstIsStillSent()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var badGroup = Guid.NewGuid();
        var client = await TestActors.Client(factory).WithName("Petra", "Svobodova").CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).CreateAsync(Ct);

        var created = await client.Http.PostAsJsonAsync("/conversations", new { ParticipantId = coach.PublicId }, Ct);
        created.EnsureSuccessStatusCode();
        var goodGroup = (await created.Content.ReadFromJsonAsync<ConversationResponse>(cancellationToken: Ct))!.Id;
        (await client.Http.PostAsJsonAsync($"/conversations/{goodGroup}/messages", new { Text = "hello" }, Ct))
            .EnsureSuccessStatusCode();

        var due = DateTime.UtcNow.AddMinutes(-10);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // The bad burst is due first, so it is claimed first.
            db.PendingNotificationEmails.Add(new PendingNotificationEmail
            {
                RecipientUserId = coach.UserId,
                Event = NotificationEvent.NewMessage,
                GroupId = badGroup,
                FirstEventAt = due,
                LastEventAt = due,
                DueAt = due.AddMinutes(-1),
            });
            await db.SaveChangesAsync(Ct);

            await db.PendingNotificationEmails
                .Where(p => p.GroupId == goodGroup)
                .ExecuteUpdateAsync(set => set.SetProperty(p => p.DueAt, due), Ct);
        }

        var scheduler = new NotificationEmailGroupingScheduler(
            new FaultyScopeFactory(factory.Services.GetRequiredService<IServiceScopeFactory>(), badGroup),
            TimeProvider.System,
            factory.Services.GetRequiredService<IConfiguration>(),
            NullLogger<NotificationEmailGroupingScheduler>.Instance);

        await scheduler.RunDueNowAsync(DateTime.UtcNow, Ct);

        using var checkScope = factory.Services.CreateScope();
        var checkDb = checkScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        (await checkDb.PendingNotificationEmails.AsNoTracking().AnyAsync(p => p.GroupId == badGroup, Ct))
            .Should().BeFalse("the failing burst is discarded instead of being claimed again every time");
        (await factory.Services.GetRequiredService<FakeEmailService>()
                .NotificationsForAsync(factory.Services.GetRequiredService<IBackgroundEmailQueue>(), coach.UserId))
            .Should().ContainSingle("the burst behind the failing one is sent in the same tick");
    }

    private sealed record ConversationResponse(Guid Id);

    private sealed class FaultyScopeFactory(IServiceScopeFactory inner, Guid failingGroup) : IServiceScopeFactory
    {
        public IServiceScope CreateScope() => new FaultyScope(inner.CreateScope(), failingGroup);
    }

    private sealed class FaultyScope(IServiceScope inner, Guid failingGroup) : IServiceScope
    {
        public IServiceProvider ServiceProvider { get; } = new FaultyProvider(inner.ServiceProvider, failingGroup);

        public void Dispose() => inner.Dispose();
    }

    private sealed class FaultyProvider(IServiceProvider inner, Guid failingGroup) : IServiceProvider
    {
        public object? GetService(Type serviceType)
        {
            if (serviceType != typeof(NotificationEmailGroupProcessor))
            {
                return inner.GetService(serviceType);
            }

            var db = DispatchProxy.Create<IApplicationDbContext, ThrowingDbProxy>();
            var proxy = (ThrowingDbProxy)(object)db;
            proxy.Inner = inner.GetRequiredService<ApplicationDbContext>();
            proxy.FailingGroup = failingGroup;

            return new NotificationEmailGroupProcessor(
                db,
                inner.GetRequiredService<INotificationEmailSender>(),
                inner.GetRequiredService<INotificationService>(),
                inner.GetRequiredService<ILogger<NotificationEmailGroupProcessor>>());
        }
    }

    /// <summary>
    /// Forwards to the real context, but throws when the failing burst starts reading conversations.
    /// </summary>
    public class ThrowingDbProxy : DispatchProxy
    {
        /// <summary>The real context.</summary>
        public IApplicationDbContext Inner { get; set; } = null!;

        /// <summary>The burst whose build must fail.</summary>
        public Guid FailingGroup { get; set; }

        private PendingNotificationEmail? claimed;

        /// <inheritdoc />
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod!.Name == "get_" + nameof(IApplicationDbContext.Conversations)
                && claimed?.GroupId == FailingGroup)
            {
                throw new InvalidOperationException("Injected build failure.");
            }

            object? result;

            try
            {
                result = targetMethod.Invoke(Inner, args);
            }
            catch (TargetInvocationException ex)
            {
                ExceptionDispatchInfo.Capture(ex.InnerException!).Throw();
                throw;
            }

            if (targetMethod.Name == nameof(IApplicationDbContext.ClaimDuePendingNotificationEmailAsync))
            {
                return RememberClaimAsync((Task<PendingNotificationEmail?>)result!);
            }

            return result;
        }

        private async Task<PendingNotificationEmail?> RememberClaimAsync(Task<PendingNotificationEmail?> claim)
        {
            claimed = await claim;

            return claimed;
        }
    }
}
