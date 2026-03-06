using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// Entry point for entity test builders.
/// </summary>
public static class EntityBuilder
{
    /// <summary>
    /// Creates a new <see cref="ApplicationUserBuilder"/>.
    /// </summary>
    public static ApplicationUserBuilder User => new();

    /// <summary>
    /// Creates a new <see cref="TrainerProfileBuilder"/>.
    /// </summary>
    public static TrainerProfileBuilder TrainerProfile => new();

    /// <summary>
    /// Creates a new <see cref="ClientProfileBuilder"/>.
    /// </summary>
    public static ClientProfileBuilder ClientProfile => new();

    /// <summary>
    /// Creates a new <see cref="ClientTrainerLinkBuilder"/>.
    /// </summary>
    public static ClientTrainerLinkBuilder ClientTrainerLink => new();

    /// <summary>
    /// Creates a new <see cref="RefreshTokenBuilder"/>.
    /// </summary>
    public static RefreshTokenBuilder RefreshToken => new();

    /// <summary>
    /// Creates a new <see cref="InvitationTokenBuilder"/>.
    /// </summary>
    public static InvitationTokenBuilder InvitationToken => new();
}

/// <summary>
/// Builder for <see cref="ApplicationUser"/> test entities.
/// </summary>
public class ApplicationUserBuilder
{
    private Guid _id = Guid.NewGuid();
    private string _email = "test@test.com";
    private string _firstName = "Test";
    private string _lastName = "User";
    private bool _isActive = true;

    /// <summary>
    /// Sets the user ID.
    /// </summary>
    public ApplicationUserBuilder WithId(Guid id) { _id = id; return this; }

    /// <summary>
    /// Sets the email and username.
    /// </summary>
    public ApplicationUserBuilder WithEmail(string email) { _email = email; return this; }

    /// <summary>
    /// Sets the first name.
    /// </summary>
    public ApplicationUserBuilder WithFirstName(string fn) { _firstName = fn; return this; }

    /// <summary>
    /// Sets the last name.
    /// </summary>
    public ApplicationUserBuilder WithLastName(string ln) { _lastName = ln; return this; }

    /// <summary>
    /// Marks the user as inactive.
    /// </summary>
    public ApplicationUserBuilder Inactive() { _isActive = false; return this; }

    /// <summary>
    /// Builds the <see cref="ApplicationUser"/> instance.
    /// </summary>
    public ApplicationUser Build() => new()
    {
        Id = _id, Email = _email, UserName = _email,
        FirstName = _firstName, LastName = _lastName,
        IsActive = _isActive
    };
}

/// <summary>
/// Builder for <see cref="TrainerProfile"/> test entities.
/// </summary>
public class TrainerProfileBuilder
{
    private long _id = 1;
    private Guid _userId = Guid.NewGuid();
    private Guid _publicId = Guid.NewGuid();
    private string _bio = "Bio";
    private string _specialization = "Spec";
    private ApplicationUser? _user;

    /// <summary>
    /// Sets the internal ID.
    /// </summary>
    public TrainerProfileBuilder WithId(long id) { _id = id; return this; }

    /// <summary>
    /// Sets the user ID.
    /// </summary>
    public TrainerProfileBuilder WithUserId(Guid userId) { _userId = userId; return this; }

    /// <summary>
    /// Sets the public ID.
    /// </summary>
    public TrainerProfileBuilder WithPublicId(Guid publicId) { _publicId = publicId; return this; }

    /// <summary>
    /// Sets the bio.
    /// </summary>
    public TrainerProfileBuilder WithBio(string bio) { _bio = bio; return this; }

    /// <summary>
    /// Sets the specialization.
    /// </summary>
    public TrainerProfileBuilder WithSpecialization(string spec) { _specialization = spec; return this; }

    /// <summary>
    /// Sets the User navigation property.
    /// </summary>
    public TrainerProfileBuilder WithUser(ApplicationUser user) { _user = user; _userId = user.Id; return this; }

    /// <summary>
    /// Builds the <see cref="TrainerProfile"/> instance.
    /// </summary>
    public TrainerProfile Build() => new()
    {
        Id = _id, UserId = _userId, PublicId = _publicId,
        Bio = _bio, Specialization = _specialization,
        User = _user!
    };
}

/// <summary>
/// Builder for <see cref="ClientProfile"/> test entities.
/// </summary>
public class ClientProfileBuilder
{
    private long _id = 1;
    private Guid _userId = Guid.NewGuid();
    private Guid _publicId = Guid.NewGuid();
    private ApplicationUser? _user;

    /// <summary>
    /// Sets the internal ID.
    /// </summary>
    public ClientProfileBuilder WithId(long id) { _id = id; return this; }

    /// <summary>
    /// Sets the user ID.
    /// </summary>
    public ClientProfileBuilder WithUserId(Guid userId) { _userId = userId; return this; }

    /// <summary>
    /// Sets the public ID.
    /// </summary>
    public ClientProfileBuilder WithPublicId(Guid publicId) { _publicId = publicId; return this; }

    /// <summary>
    /// Sets the User navigation property.
    /// </summary>
    public ClientProfileBuilder WithUser(ApplicationUser user) { _user = user; _userId = user.Id; return this; }

    /// <summary>
    /// Builds the <see cref="ClientProfile"/> instance.
    /// </summary>
    public ClientProfile Build() => new()
    {
        Id = _id, UserId = _userId, PublicId = _publicId,
        User = _user!
    };
}

/// <summary>
/// Builder for <see cref="ClientTrainerLink"/> test entities.
/// </summary>
public class ClientTrainerLinkBuilder
{
    private long _clientProfileId;
    private long _trainerProfileId;
    private UserRole _trainerRole = UserRole.Trainer;
    private bool _isActive = true;
    private ClientProfile? _clientProfile;
    private TrainerProfile? _trainerProfile;
    private DateTime _dateCreated = DateTime.UtcNow;

    /// <summary>
    /// Sets the client profile ID.
    /// </summary>
    public ClientTrainerLinkBuilder WithClientProfileId(long id) { _clientProfileId = id; return this; }

    /// <summary>
    /// Sets the trainer profile ID.
    /// </summary>
    public ClientTrainerLinkBuilder WithTrainerProfileId(long id) { _trainerProfileId = id; return this; }

    /// <summary>
    /// Sets the trainer role.
    /// </summary>
    public ClientTrainerLinkBuilder WithTrainerRole(UserRole role) { _trainerRole = role; return this; }

    /// <summary>
    /// Sets the link as inactive.
    /// </summary>
    public ClientTrainerLinkBuilder Inactive() { _isActive = false; return this; }

    /// <summary>
    /// Sets the ClientProfile navigation property.
    /// </summary>
    public ClientTrainerLinkBuilder WithClientProfile(ClientProfile cp) { _clientProfile = cp; _clientProfileId = cp.Id; return this; }

    /// <summary>
    /// Sets the TrainerProfile navigation property.
    /// </summary>
    public ClientTrainerLinkBuilder WithTrainerProfile(TrainerProfile tp) { _trainerProfile = tp; _trainerProfileId = tp.Id; return this; }

    /// <summary>
    /// Sets the date created.
    /// </summary>
    public ClientTrainerLinkBuilder WithDateCreated(DateTime dt) { _dateCreated = dt; return this; }

    /// <summary>
    /// Builds the <see cref="ClientTrainerLink"/> instance.
    /// </summary>
    public ClientTrainerLink Build() => new()
    {
        ClientProfileId = _clientProfileId, TrainerProfileId = _trainerProfileId,
        TrainerRole = _trainerRole, IsActive = _isActive,
        ClientProfile = _clientProfile!, TrainerProfile = _trainerProfile!,
        DateCreated = _dateCreated
    };
}

/// <summary>
/// Builder for <see cref="Application.Domain.Entities.RefreshToken"/> test entities.
/// </summary>
public class RefreshTokenBuilder
{
    private Guid _userId = Guid.NewGuid();
    private string _token = "test-token";
    private DateTime _expiresAt = DateTime.UtcNow.AddDays(7);
    private DateTime? _revokedAt;
    private string? _replacedByToken;
    private ApplicationUser? _user;

    /// <summary>
    /// Sets the user ID.
    /// </summary>
    public RefreshTokenBuilder WithUserId(Guid userId) { _userId = userId; return this; }

    /// <summary>
    /// Sets the token string.
    /// </summary>
    public RefreshTokenBuilder WithToken(string token) { _token = token; return this; }

    /// <summary>
    /// Sets the expiration date.
    /// </summary>
    public RefreshTokenBuilder WithExpiresAt(DateTime dt) { _expiresAt = dt; return this; }

    /// <summary>
    /// Marks the token as expired.
    /// </summary>
    public RefreshTokenBuilder Expired() { _expiresAt = DateTime.UtcNow.AddDays(-1); return this; }

    /// <summary>
    /// Marks the token as revoked.
    /// </summary>
    public RefreshTokenBuilder Revoked() { _revokedAt = DateTime.UtcNow.AddMinutes(-5); return this; }

    /// <summary>
    /// Sets the replacement token string.
    /// </summary>
    public RefreshTokenBuilder WithReplacedByToken(string? token) { _replacedByToken = token; return this; }

    /// <summary>
    /// Sets the User navigation property.
    /// </summary>
    public RefreshTokenBuilder WithUser(ApplicationUser user) { _user = user; _userId = user.Id; return this; }

    /// <summary>
    /// Builds the <see cref="Application.Domain.Entities.RefreshToken"/> instance.
    /// </summary>
    public RefreshToken Build() => new()
    {
        UserId = _userId, Token = _token, ExpiresAt = _expiresAt,
        RevokedAt = _revokedAt, ReplacedByToken = _replacedByToken,
        User = _user!
    };
}

/// <summary>
/// Builder for <see cref="Application.Domain.Entities.InvitationToken"/> test entities.
/// </summary>
public class InvitationTokenBuilder
{
    private long _trainerProfileId = 1;
    private string _email = "client@test.com";
    private string _token = "invite-token";
    private DateTime _expiresAt = DateTime.UtcNow.AddDays(7);
    private bool _isUsed;
    private TrainerProfile? _trainerProfile;

    /// <summary>
    /// Sets the trainer profile ID.
    /// </summary>
    public InvitationTokenBuilder WithTrainerProfileId(long id) { _trainerProfileId = id; return this; }

    /// <summary>
    /// Sets the invited email.
    /// </summary>
    public InvitationTokenBuilder WithEmail(string email) { _email = email; return this; }

    /// <summary>
    /// Sets the token string.
    /// </summary>
    public InvitationTokenBuilder WithToken(string token) { _token = token; return this; }

    /// <summary>
    /// Sets the expiration date.
    /// </summary>
    public InvitationTokenBuilder WithExpiresAt(DateTime dt) { _expiresAt = dt; return this; }

    /// <summary>
    /// Marks the token as expired.
    /// </summary>
    public InvitationTokenBuilder Expired() { _expiresAt = DateTime.UtcNow.AddDays(-1); return this; }

    /// <summary>
    /// Marks the token as already used.
    /// </summary>
    public InvitationTokenBuilder Used() { _isUsed = true; return this; }

    /// <summary>
    /// Sets the TrainerProfile navigation property.
    /// </summary>
    public InvitationTokenBuilder WithTrainerProfile(TrainerProfile tp) { _trainerProfile = tp; _trainerProfileId = tp.Id; return this; }

    /// <summary>
    /// Builds the <see cref="Application.Domain.Entities.InvitationToken"/> instance.
    /// </summary>
    public InvitationToken Build() => new()
    {
        TrainerProfileId = _trainerProfileId, Email = _email, Token = _token,
        ExpiresAt = _expiresAt, IsUsed = _isUsed, TrainerProfile = _trainerProfile!
    };
}
