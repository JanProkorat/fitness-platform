using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.ClientPhotos;

/// <summary>
/// Integration tests (real PostgreSQL) for the from/to query-string filters on the photo list endpoints.
/// Query binding yields DateTime values that Npgsql rejects against timestamptz unless normalised to UTC (#1336).
/// </summary>
[Collection(TestCollection.Name)]
public class GetPhotosDateFilterTests(FitnessApiFactory factory)
{
    private sealed record PhotoBody(DateTime TakenAt);

    private sealed record PhotosBody(List<PhotoBody>? Photos);

    private async Task SeedPhotoAsync(Actor client, DateTime takenAtUtc)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.PlanPhotos.Add(new PlanPhoto
        {
            ClientProfileId = client.ProfileId,
            Category = PlanPhotoCategory.Food,
            BlobUrl = "https://example.invalid/photo.jpg",
            TakenAt = takenAtUtc,
            UploadedByUserId = client.UserId,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static string Query(DateTime fromUtc, DateTime toUtc) =>
        $"category=Food&from={Uri.EscapeDataString(fromUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"))}" +
        $"&to={Uri.EscapeDataString(toUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"))}";

    private static async Task AssertOnlyInsideWindowAsync(HttpResponseMessage response, DateTime insideUtc)
    {
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PhotosBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.Photos!.Should().ContainSingle()
            .Which.TakenAt.ToUniversalTime().Should().BeCloseTo(insideUtc, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task GetTrainerClientPhotos_FromAndToAsIsoUtc_Returns200AndFiltersByWindow()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);
        var inside = new DateTime(2026, 10, 12, 23, 0, 0, DateTimeKind.Utc);
        await SeedPhotoAsync(client, inside);
        await SeedPhotoAsync(client, inside.AddDays(-10));

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}/photos?{Query(inside.AddHours(-2), inside.AddHours(2))}",
            TestContext.Current.CancellationToken);

        await AssertOnlyInsideWindowAsync(response, inside);
    }

    [Fact]
    public async Task GetMyPhotos_FromAndToAsIsoUtc_Returns200AndFiltersByWindow()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var inside = new DateTime(2026, 10, 12, 23, 0, 0, DateTimeKind.Utc);
        await SeedPhotoAsync(client, inside);
        await SeedPhotoAsync(client, inside.AddDays(-10));

        var response = await client.Http.GetAsync(
            $"/client/me/photos?{Query(inside.AddHours(-2), inside.AddHours(2))}",
            TestContext.Current.CancellationToken);

        await AssertOnlyInsideWindowAsync(response, inside);
    }
}
