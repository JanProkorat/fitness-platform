using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.ClientRequests;

/// <summary>
/// <c>POST /client/requests</c>: the optional ShareHistory flag is stored, and a coach who is
/// not accepting clients is still refused now that search lists waitlisted coaches.
/// </summary>
[Collection(TestCollection.Name)]
public class SendClientRequestShareHistoryTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task SendRequest_StoresShareHistory(bool shareHistory)
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await client.Http.PostAsJsonAsync(
            "/client/requests",
            new { ProfessionalPublicId = coach.PublicId, ShareHistory = shareHistory },
            Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.ClientRequests.SingleAsync(r => r.ClientProfileId == client.ProfileId, Ct);
        stored.ShareHistory.Should().Be(shareHistory);
    }

    [Fact]
    public async Task SendRequest_OmittedShareHistory_DefaultsToFalse()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await client.Http.PostAsJsonAsync(
            "/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ClientRequests.SingleAsync(r => r.ClientProfileId == client.ProfileId, Ct))
            .ShareHistory.Should().BeFalse();
    }

    [Fact]
    public async Task SendRequest_ToCoachNotAcceptingClients_Returns400_AndStoresNothing()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.ProfessionalProfiles.FirstAsync(p => p.Id == coach.ProfileId, Ct);
            profile.AcceptNewClients = false;
            await db.SaveChangesAsync(Ct);
        }

        var response = await client.Http.PostAsJsonAsync(
            "/client/requests", new { ProfessionalPublicId = coach.PublicId, ShareHistory = true }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(Ct)).Should().Contain("PROFESSIONAL_NOT_ACCEPTING");
        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await verifyDb.ClientRequests.AnyAsync(r => r.ClientProfileId == client.ProfileId, Ct)).Should().BeFalse();
    }
}
