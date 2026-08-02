using System.Text.Json;
using FastEndpoints;
using FastEndpoints.Testing;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Probe endpoint used only to obtain a real <see cref="IEndpoint"/> (with a usable
/// <c>HttpContext</c>) so <see cref="LibraryDenialExtensions"/>'s extension methods — which
/// write an actual HTTP response via <c>SendProblemAsync</c> — can be exercised the same way a
/// real sharing-library endpoint would call them. No route on this endpoint is ever invoked
/// over HTTP; <c>HandleAsync</c> is never called by these tests.
/// </summary>
internal sealed class LibraryGuardProbeEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/__test/library-guard-probe");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct) => Task.CompletedTask;
}

/// <summary>
/// Unit tests for <see cref="LibraryAccessGuard"/>'s pure predicates and
/// <see cref="LibraryDenialExtensions"/>'s endpoint-facing 404/403/409 responses (issue #858).
/// No Docker required. See <see cref="LibraryEntryLoaderTests"/> (Testcontainers) for the
/// consumer-realistic byte-identity proof that exercises the fetch-and-guard entry points
/// against a real Mongo collection.
/// </summary>
public class LibraryAccessGuardTests
{
    private static readonly Guid OwnerId = Guid.NewGuid();
    private static readonly Guid OtherCallerId = Guid.NewGuid();

    // A single, shared descriptor declared once — mirroring how a real library is expected to
    // declare exactly one `static readonly LibraryDenial` and reuse it at every call site.
    private static readonly LibraryDenial MealTemplateDenial = new(
        "MEAL_TEMPLATE_NOT_FOUND", "Meal template not found.",
        "MEAL_TEMPLATE_NOT_OWNED", "Meal template belongs to another owner.",
        "MEAL_TEMPLATE_VERSION_CONFLICT", "Meal template was modified by another request.");

    private static readonly LibraryDenial GenericDenial = new(
        "SOME_NOT_FOUND", "not found",
        "SOME_NOT_OWNED", "not owned",
        "SOME_VERSION_CONFLICT", "version conflict");

    /// <summary>
    /// Reads the RFC 7807 <c>errorCode</c> extension out of a captured Problem Details response
    /// body. Used to pin the exact machine-readable error code a 404/403/409 response carries —
    /// asserting <c>StatusCode</c> alone cannot distinguish a correct <c>*_NOT_OWNED</c> code from
    /// a transposed <c>*_NOT_FOUND</c> code, an empty string, or a dropped extension entirely, all
    /// three of which still produce the same status code.
    /// </summary>
    private static async Task<string?> ReadErrorCodeAsync(MemoryStream responseBody)
    {
        responseBody.Seek(0, SeekOrigin.Begin);
        using var document = await JsonDocument.ParseAsync(responseBody);
        return document.RootElement.TryGetProperty("errorCode", out var errorCode)
            ? errorCode.GetString()
            : null;
    }

    // ── LibraryAccessGuard.CanRead ──────────────────────────────────────────────

    [Fact]
    public void CanRead_Owner_ReturnsTrue_RegardlessOfVisibility()
    {
        LibraryAccessGuard.CanRead(OwnerId, OwnerId, LibraryVisibility.Private).Should().BeTrue();
        LibraryAccessGuard.CanRead(OwnerId, OwnerId, LibraryVisibility.Public).Should().BeTrue();
    }

    [Fact]
    public void CanRead_OtherCaller_PublicEntry_ReturnsTrue()
    {
        LibraryAccessGuard.CanRead(OtherCallerId, OwnerId, LibraryVisibility.Public).Should().BeTrue();
    }

    [Fact]
    public void CanRead_OtherCaller_PrivateEntry_ReturnsFalse()
    {
        LibraryAccessGuard.CanRead(OtherCallerId, OwnerId, LibraryVisibility.Private).Should().BeFalse();
    }

    /// <summary>
    /// A document whose <c>ownerId</c> field is absent deserializes to <see cref="Guid.Empty"/>.
    /// Without the <see cref="Guid.Empty"/> guard, a caller whose own id also resolved to
    /// <see cref="Guid.Empty"/> would incorrectly own — and be able to read — such a document.
    /// </summary>
    [Fact]
    public void CanRead_EmptyCallerIdMatchingEmptyOwnerId_ReturnsFalse()
    {
        LibraryAccessGuard.CanRead(Guid.Empty, Guid.Empty, LibraryVisibility.Private).Should().BeFalse();
    }

    // ── LibraryAccessGuard.CanWrite ─────────────────────────────────────────────

    [Fact]
    public void CanWrite_Owner_ReturnsTrue()
    {
        LibraryAccessGuard.CanWrite(OwnerId, OwnerId).Should().BeTrue();
    }

    [Fact]
    public void CanWrite_OtherCaller_ReturnsFalse_RegardlessOfVisibility()
    {
        // CanWrite takes no visibility parameter — ownership is the only write gate.
        LibraryAccessGuard.CanWrite(OtherCallerId, OwnerId).Should().BeFalse();
    }

    /// <summary>
    /// Same field-absent-ownerId hazard as <see cref="CanRead_EmptyCallerIdMatchingEmptyOwnerId_ReturnsFalse"/>,
    /// but for the write gate.
    /// </summary>
    [Fact]
    public void CanWrite_EmptyCallerIdMatchingEmptyOwnerId_ReturnsFalse()
    {
        LibraryAccessGuard.CanWrite(Guid.Empty, Guid.Empty).Should().BeFalse();
    }

    // ── LibraryDenialExtensions.TryDenyReadAsync ────────────────────────────────

    [Fact]
    public async Task TryDenyReadAsync_OwnerReadingPrivate_ReturnsFalse_NoResponseWritten()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyReadAsync(
            OwnerId, OwnerId, LibraryVisibility.Private,
            GenericDenial,
            TestContext.Current.CancellationToken);

        denied.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task TryDenyReadAsync_OtherCallerReadingPublic_ReturnsFalse_NoResponseWritten()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyReadAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Public,
            GenericDenial,
            TestContext.Current.CancellationToken);

        denied.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task TryDenyReadAsync_OtherCallerReadingPrivate_Returns404_IndistinguishableFromMissing()
    {
        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryGuardProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);

        var denied = await ep.TryDenyReadAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Private,
            MealTemplateDenial,
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotFoundErrorCode);
    }

    // ── LibraryDenialExtensions.TryDenyWriteAsync ───────────────────────────────

    [Fact]
    public async Task TryDenyWriteAsync_Owner_ReturnsFalse_NoResponseWritten()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyWriteAsync(
            OwnerId, OwnerId, LibraryVisibility.Public,
            GenericDenial,
            TestContext.Current.CancellationToken);

        denied.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Another owner's Public entry: the caller CAN read it (so no 404 — that would leak
    /// nothing new, the entry is public) but does NOT own it, so the write is denied with 403,
    /// not the 404 an owner-scoped Mongo lookup filter would have produced.
    /// </summary>
    [Fact]
    public async Task TryDenyWriteAsync_OtherOwnerPublicEntry_Returns403NotOwned()
    {
        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryGuardProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);

        var denied = await ep.TryDenyWriteAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Public,
            MealTemplateDenial,
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();
        ep.HttpContext.Response.StatusCode.Should().Be(403);
        // This is the mutation this test exists to catch: a build that sends
        // MealTemplateDenial.NotFoundErrorCode on this 403 branch instead of NotOwnedErrorCode
        // would still pass a StatusCode-only assertion — clients would then localize a
        // readable-but-not-owned write attempt as "not found" instead of "not owned".
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotOwnedErrorCode);
    }

    /// <summary>
    /// Another owner's Private entry: the caller cannot even read it, so the write is denied
    /// with 404 — never 403, which would confirm the entry's existence to a caller with no
    /// read right to it (id enumeration).
    /// </summary>
    [Fact]
    public async Task TryDenyWriteAsync_OtherOwnerPrivateEntry_Returns404NotFound()
    {
        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryGuardProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);

        var denied = await ep.TryDenyWriteAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Private,
            MealTemplateDenial,
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotFoundErrorCode);
    }

    // ── LibraryDenialExtensions.SendLibraryVersionConflictAsync ─────────────────

    [Fact]
    public async Task SendLibraryVersionConflictAsync_WritesProblemDetailsWith409AndErrorCode()
    {
        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryGuardProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);

        await ep.SendLibraryVersionConflictAsync(MealTemplateDenial, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.VersionConflictErrorCode);
    }
}
