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
/// <see cref="LibraryDenialExtensions"/>'s endpoint-facing 404/403 responses (issue #858).
/// No Docker required.
/// </summary>
public class LibraryAccessGuardTests
{
    private static readonly Guid OwnerId = Guid.NewGuid();
    private static readonly Guid OtherCallerId = Guid.NewGuid();

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

    // ── LibraryDenialExtensions.TryDenyReadAsync ────────────────────────────────

    [Fact]
    public async Task TryDenyReadAsync_OwnerReadingPrivate_ReturnsFalse_NoResponseWritten()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyReadAsync(
            OwnerId, OwnerId, LibraryVisibility.Private,
            "SOME_NOT_FOUND", "not found",
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
            "SOME_NOT_FOUND", "not found",
            TestContext.Current.CancellationToken);

        denied.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task TryDenyReadAsync_OtherCallerReadingPrivate_Returns404_IndistinguishableFromMissing()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyReadAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Private,
            "MEAL_TEMPLATE_NOT_FOUND", "Meal template not found.",
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── LibraryDenialExtensions.TryDenyWriteAsync ───────────────────────────────

    [Fact]
    public async Task TryDenyWriteAsync_Owner_ReturnsFalse_NoResponseWritten()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyWriteAsync(
            OwnerId, OwnerId, LibraryVisibility.Public,
            "SOME_NOT_FOUND", "not found",
            "SOME_NOT_OWNED", "not owned",
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
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyWriteAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Public,
            "MEAL_TEMPLATE_NOT_FOUND", "Meal template not found.",
            "MEAL_TEMPLATE_NOT_OWNED", "Meal template belongs to another owner.",
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();
        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    /// <summary>
    /// Another owner's Private entry: the caller cannot even read it, so the write is denied
    /// with 404 — never 403, which would confirm the entry's existence to a caller with no
    /// read right to it (id enumeration).
    /// </summary>
    [Fact]
    public async Task TryDenyWriteAsync_OtherOwnerPrivateEntry_Returns404NotFound()
    {
        var ep = Factory.Create<LibraryGuardProbeEndpoint>();

        var denied = await ep.TryDenyWriteAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Private,
            "MEAL_TEMPLATE_NOT_FOUND", "Meal template not found.",
            "MEAL_TEMPLATE_NOT_OWNED", "Meal template belongs to another owner.",
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── LibraryDenialExtensions.SendLibraryNotFoundAsync — body-equality proof ─

    /// <summary>
    /// The core AC #858 property: a genuinely-missing entry and another owner's unreadable
    /// Private entry must be byte-for-byte indistinguishable — not just matching status codes.
    /// A test that only compares status codes would already pass today and miss the exact
    /// defect BLOCKING finding #2 raised: a genuinely-missing entry that (incorrectly) still
    /// went through the repo's usual empty-bodied <c>Send.NotFoundAsync(ct)</c> would report the
    /// same 404 status as this test's denied-read path, while shipping a different body/headers
    /// oracle. This test proves both paths route through the same
    /// <see cref="LibraryDenialExtensions.SendLibraryNotFoundAsync"/> helper and therefore
    /// produce identical bytes.
    /// </summary>
    [Fact]
    public async Task SendLibraryNotFoundAsync_MissingEntryAndOtherOwnerPrivateEntry_ProduceByteIdenticalResponses()
    {
        const string notFoundErrorCode = "MEAL_TEMPLATE_NOT_FOUND";
        const string notFoundDetail = "Meal template not found.";

        using var missingEntryBody = new MemoryStream();
        var missingEntryEndpoint = Factory.Create<LibraryGuardProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = missingEntryBody);

        // Simulates the "document does not exist at all" path a real endpoint takes after its
        // ExternalId lookup returns null — it MUST call this helper, not Send.NotFoundAsync(ct).
        await missingEntryEndpoint.SendLibraryNotFoundAsync(
            notFoundErrorCode, notFoundDetail, TestContext.Current.CancellationToken);

        using var otherOwnerPrivateBody = new MemoryStream();
        var otherOwnerPrivateEndpoint = Factory.Create<LibraryGuardProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = otherOwnerPrivateBody);

        var denied = await otherOwnerPrivateEndpoint.TryDenyReadAsync(
            OtherCallerId, OwnerId, LibraryVisibility.Private,
            notFoundErrorCode, notFoundDetail,
            TestContext.Current.CancellationToken);

        denied.Should().BeTrue();

        missingEntryEndpoint.HttpContext.Response.StatusCode
            .Should().Be(otherOwnerPrivateEndpoint.HttpContext.Response.StatusCode);
        missingEntryEndpoint.HttpContext.Response.ContentType
            .Should().Be(otherOwnerPrivateEndpoint.HttpContext.Response.ContentType);

        missingEntryBody.Seek(0, SeekOrigin.Begin);
        otherOwnerPrivateBody.Seek(0, SeekOrigin.Begin);
        missingEntryBody.ToArray().Should().Equal(otherOwnerPrivateBody.ToArray());
    }
}
