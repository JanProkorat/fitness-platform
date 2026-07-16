using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Auth.Register;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class RegisterEndpointTests
{
    private readonly UserManager<ApplicationUser> _userManager = EndpointTestHelpers.CreateFakeUserManager();
    private readonly IApplicationDbContext _db = new MockDbBuilder().Build();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly ILogger<RegisterEndpoint> _logger = Substitute.For<ILogger<RegisterEndpoint>>();
    private readonly IPendingInviteConversationSeeder _inviteConversationSeeder = Substitute.For<IPendingInviteConversationSeeder>();

    // Real EmailVerificationTokenService wired to the same mocked _db/_emailService so
    // assertions on token persistence (_db.EmailVerificationTokens) and email dispatch
    // (_emailService.SendEmailVerificationAsync) still exercise the shared path (#679).
    private readonly IEmailVerificationTokenService _tokenService;

    public RegisterEndpointTests()
    {
        _tokenService = new EmailVerificationTokenService(_db, _emailService);
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_Returns201WithUserId()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "test@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "John",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        };

        await ep.HandleAsync(req, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.Email.Should().Be("test@example.com");
        ep.Response.Message.Should().Be("Registration successful.");
    }

    [Fact]
    public async Task HandleAsync_DuplicateEmail_ThrowsValidationError()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Failed(new IdentityError { Description = "Email already taken." }));

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "taken@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "John",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        };

        var act = () => ep.HandleAsync(req, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_AssignsCorrectRole()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "trainer@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "Jane",
            LastName = "Doe",
            Roles = new List<string> { "Trainer" },
            GdprConsent = true
        };

        await ep.HandleAsync(req, CancellationToken.None);

        await _userManager.Received(1).AddToRolesAsync(
            Arg.Any<ApplicationUser>(),
            Arg.Is<IEnumerable<string>>(r => r.Contains("Trainer")));
    }

    [Fact]
    public async Task HandleAsync_ClientRole_CreatesClientProfile()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        await ep.HandleAsync(new RegisterRequest
        {
            Email = "client@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "John",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        }, CancellationToken.None);

        _db.ClientProfiles.Received(1).Add(Arg.Any<ClientProfile>());
    }

    [Fact]
    public async Task HandleAsync_TrainerRole_CreatesProfessionalProfile()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        await ep.HandleAsync(new RegisterRequest
        {
            Email = "trainer@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "Jane",
            LastName = "Doe",
            Roles = new List<string> { "Trainer" },
            GdprConsent = true
        }, CancellationToken.None);

        _db.ProfessionalProfiles.Received(1).Add(Arg.Any<ProfessionalProfile>());
    }

    [Fact]
    public async Task HandleAsync_SetsGdprConsentDate()
    {
        ApplicationUser? capturedUser = null;
        _userManager.CreateAsync(Arg.Do<ApplicationUser>(u => capturedUser = u), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "gdpr@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "Jane",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        };

        await ep.HandleAsync(req, CancellationToken.None);

        capturedUser.Should().NotBeNull();
        capturedUser!.GdprConsent.Should().BeTrue();
        capturedUser.GdprConsentDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task HandleAsync_WritesAuditLog()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        await ep.HandleAsync(new RegisterRequest
        {
            Email = "audit@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "Jane",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        }, CancellationToken.None);

        await _audit.Received(1).LogAsync(
            Arg.Any<Guid?>(),
            "Register",
            nameof(ApplicationUser),
            Arg.Any<Guid?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Is<string?>(s => s != null && s.Contains("gdprConsent")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_TrainerAndNutritionistRoles_CreatesOneProfessionalProfile_AndAssignsBothRoles()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        await ep.HandleAsync(new RegisterRequest
        {
            Email = "dual@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "Alex",
            LastName = "Smith",
            Roles = new List<string> { "Trainer", "Nutritionist" },
            GdprConsent = true
        }, CancellationToken.None);

        // Both Trainer and Nutritionist roles are assigned in a single call
        await _userManager.Received(1).AddToRolesAsync(
            Arg.Any<ApplicationUser>(),
            Arg.Is<IEnumerable<string>>(r => r.Contains("Trainer") && r.Contains("Nutritionist")));

        // Exactly ONE ProfessionalProfile row is created (not two)
        _db.ProfessionalProfiles.Received(1).Add(Arg.Any<ProfessionalProfile>());

        // No ClientProfile should be created
        _db.ClientProfiles.DidNotReceive().Add(Arg.Any<ClientProfile>());
    }

    [Fact]
    public async Task HandleAsync_EmailSendFails_StillReturns201_AndUserIsCreated()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        _emailService
            .SendEmailVerificationAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new InvalidOperationException("smtp down"));

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "noemail@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "John",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        };

        await ep.HandleAsync(req, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await _userManager.Received(1).CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>());

        _db.EmailVerificationTokens.Received(1).Add(Arg.Any<EmailVerificationToken>());

        _logger.Received(1).Log(
            LogLevel.Error,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => o.ToString()!.Contains("noemail@example.com")),
            Arg.Is<Exception>(ex => ex is InvalidOperationException && ex.Message == "smtp down"),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ── #803/#817 — account-creation-time pending-invite conversation seed ────

    [Fact]
    public async Task HandleAsync_ClientRole_SeedsPendingInviteConversations()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "invited-client@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "John",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        };

        await ep.HandleAsync(req, CancellationToken.None);

        // A Client-role signup must run the pending-invite conversation seed so any
        // coach's opening message already addressed to this email is surfaced before
        // the client explicitly accepts (#803/#817).
        await _inviteConversationSeeder.Received(1).SeedForNewUserAsync(
            Arg.Is<ApplicationUser>(u => u.Email == "invited-client@example.com"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SeedThrows_StillReturns201_AndLogsWarning()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        _inviteConversationSeeder
            .SeedForNewUserAsync(Arg.Any<ApplicationUser>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new InvalidOperationException("mongo down"));

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "seedfails@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "John",
            LastName = "Doe",
            Roles = new List<string> { "Client" },
            GdprConsent = true
        };

        // Act — the seed failure must not propagate. The account is already committed
        // (#803/#817 non-fatal seeding per review).
        await ep.HandleAsync(req, CancellationToken.None);

        // Assert — registration still succeeds and the account is created.
        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.Email.Should().Be("seedfails@example.com");
        await _userManager.Received(1).CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>());

        // The email + audit steps must still have run despite the seed failure.
        _db.EmailVerificationTokens.Received(1).Add(Arg.Any<EmailVerificationToken>());
        await _audit.Received(1).LogAsync(
            Arg.Any<Guid?>(), "Register", nameof(ApplicationUser), Arg.Any<Guid?>(),
            Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());

        // The failure is logged as an error, not swallowed silently.
        _logger.Received(1).Log(
            LogLevel.Error,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => o.ToString()!.Contains("seedfails@example.com")),
            Arg.Is<Exception>(ex => ex is InvalidOperationException && ex.Message == "mongo down"),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task HandleAsync_TrainerOnlyRole_DoesNotSeedPendingInviteConversations()
    {
        _userManager.CreateAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>())
            .Returns(IdentityResult.Success);
        _userManager.AddToRolesAsync(Arg.Any<ApplicationUser>(), Arg.Any<IEnumerable<string>>())
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<RegisterEndpoint>(_userManager, _db, _audit, _tokenService, _logger, _inviteConversationSeeder);

        var req = new RegisterRequest
        {
            Email = "coach-only@example.com",
            Password = "TestPass1!",
            ConfirmPassword = "TestPass1!",
            FirstName = "Jane",
            LastName = "Doe",
            Roles = new List<string> { "Trainer" },
            GdprConsent = true
        };

        await ep.HandleAsync(req, CancellationToken.None);

        // PendingInvite always represents an invitation of a client — a coach-only
        // signup has no invite to match, so the seed must not run at all.
        await _inviteConversationSeeder.DidNotReceiveWithAnyArgs().SeedForNewUserAsync(
            default!, TestContext.Current.CancellationToken);
    }
}
