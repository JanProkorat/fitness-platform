using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Regression coverage for the <see cref="WeeklyCheckIn.Flags"/> <c>ValueComparer</c>.
/// Without it, EF's default snapshot for a reference-type property stores the SAME live
/// list instance, so an in-place <c>Add</c>/<c>Clear</c> mutation is invisible to change
/// detection and <c>SaveChangesAsync</c> silently issues no UPDATE. Each phase below uses
/// its own <c>factory.Services.CreateScope()</c> so the change tracker genuinely starts
/// fresh per phase, the way a real request/response cycle would.
/// </summary>
[Collection(TestCollection.Name)]
public class WeeklyCheckInFlagsPersistenceTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@{tag}-test.com";

    private async Task<(Guid ClientUserId, Guid TrainerUserId)> SetupUsersAsync()
    {
        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail("flags-client");
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, "TestPass1!", "Test", "Client", "Client");

        var trainerHttp = factory.CreateClient();
        var trainerEmail = UniqueEmail("flags-trainer");
        await TestHelpers.RegisterAsync(trainerHttp, trainerEmail, "TestPass1!", "T", "T", "Trainer");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientUser = await db.Users.FirstAsync(
            u => u.Email == clientEmail, TestContext.Current.CancellationToken);
        var trainerUser = await db.Users.FirstAsync(
            u => u.Email == trainerEmail, TestContext.Current.CancellationToken);
        return (clientUser.Id, trainerUser.Id);
    }

    /// <summary>Scope 1 — insert a check-in with a seed set of flags.</summary>
    private async Task<Guid> InsertCheckInAsync(Guid clientUserId, Guid trainerUserId, List<CheckInFlag> flags)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var monday = today.AddDays(-days);

        var checkIn = new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = trainerUserId,
            Profession = Profession.Training,
            WeekStartDate = monday,
            Flags = flags,
            SentAt = DateTime.UtcNow.AddHours(-1),
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };

        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn.Id;
    }

    [Fact]
    public async Task SaveChangesAsync_FlagAddedInPlace_PersistsAcrossFreshScope()
    {
        var (clientUserId, trainerUserId) = await SetupUsersAsync();
        var checkInId = await InsertCheckInAsync(clientUserId, trainerUserId, [CheckInFlag.Traveling]);

        // Scope 2 — load tracked, mutate ONLY Flags via an in-place Add, save.
        int affectedRows;
        using (var mutateScope = factory.Services.CreateScope())
        {
            var mutateDb = mutateScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var checkIn = await mutateDb.WeeklyCheckIns.FirstAsync(
                c => c.Id == checkInId, TestContext.Current.CancellationToken);

            checkIn.Flags.Add(CheckInFlag.SickOrLowEnergy);

            affectedRows = await mutateDb.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        affectedRows.Should().BeGreaterThan(0);

        // Scope 3 — reload in a genuinely fresh change tracker and assert on THIS instance.
        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await verifyDb.WeeklyCheckIns.FirstAsync(
            c => c.Id == checkInId, TestContext.Current.CancellationToken);

        persisted.Flags.Should().BeEquivalentTo([CheckInFlag.Traveling, CheckInFlag.SickOrLowEnergy]);
    }

    [Fact]
    public async Task SaveChangesAsync_FlagsClearedInPlace_PersistsAcrossFreshScope()
    {
        var (clientUserId, trainerUserId) = await SetupUsersAsync();
        var checkInId = await InsertCheckInAsync(
            clientUserId, trainerUserId, [CheckInFlag.Traveling, CheckInFlag.SickOrLowEnergy]);

        // Scope 2 — load tracked, mutate ONLY Flags via an in-place Clear, save.
        int affectedRows;
        using (var mutateScope = factory.Services.CreateScope())
        {
            var mutateDb = mutateScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var checkIn = await mutateDb.WeeklyCheckIns.FirstAsync(
                c => c.Id == checkInId, TestContext.Current.CancellationToken);

            checkIn.Flags.Clear();

            affectedRows = await mutateDb.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        affectedRows.Should().BeGreaterThan(0);

        // Scope 3 — reload in a genuinely fresh change tracker and assert on THIS instance.
        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await verifyDb.WeeklyCheckIns.FirstAsync(
            c => c.Id == checkInId, TestContext.Current.CancellationToken);

        persisted.Flags.Should().BeEmpty();
    }
}
