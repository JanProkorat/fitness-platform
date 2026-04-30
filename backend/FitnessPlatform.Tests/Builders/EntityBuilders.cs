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
    /// Creates a new <see cref="ProfessionalProfileBuilder"/>.
    /// </summary>
    public static ProfessionalProfileBuilder ProfessionalProfile => new();

    /// <summary>
    /// Creates a new <see cref="ClientProfileBuilder"/>.
    /// </summary>
    public static ClientProfileBuilder ClientProfile => new();

    /// <summary>
    /// Creates a new <see cref="ClientProfessionalLinkBuilder"/>.
    /// </summary>
    public static ClientProfessionalLinkBuilder ClientProfessionalLink => new();

    /// <summary>
    /// Creates a new <see cref="RefreshTokenBuilder"/>.
    /// </summary>
    public static RefreshTokenBuilder RefreshToken => new();

    /// <summary>
    /// Creates a new <see cref="InvitationTokenBuilder"/>.
    /// </summary>
    public static InvitationTokenBuilder InvitationToken => new();

    /// <summary>
    /// Creates a new <see cref="ClientOnboardingDataBuilder"/>.
    /// </summary>
    public static ClientOnboardingDataBuilder ClientOnboardingData => new();

    /// <summary>
    /// Creates a new <see cref="PendingInviteBuilder"/>.
    /// </summary>
    public static PendingInviteBuilder PendingInvite => new();
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
/// Builder for <see cref="ProfessionalProfile"/> test entities.
/// </summary>
public class ProfessionalProfileBuilder
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
    public ProfessionalProfileBuilder WithId(long id) { _id = id; return this; }

    /// <summary>
    /// Sets the user ID.
    /// </summary>
    public ProfessionalProfileBuilder WithUserId(Guid userId) { _userId = userId; return this; }

    /// <summary>
    /// Sets the public ID.
    /// </summary>
    public ProfessionalProfileBuilder WithPublicId(Guid publicId) { _publicId = publicId; return this; }

    /// <summary>
    /// Sets the bio.
    /// </summary>
    public ProfessionalProfileBuilder WithBio(string bio) { _bio = bio; return this; }

    /// <summary>
    /// Sets the specialization.
    /// </summary>
    public ProfessionalProfileBuilder WithSpecialization(string spec) { _specialization = spec; return this; }

    /// <summary>
    /// Sets the User navigation property.
    /// </summary>
    public ProfessionalProfileBuilder WithUser(ApplicationUser user) { _user = user; _userId = user.Id; return this; }

    /// <summary>
    /// Builds the <see cref="ProfessionalProfile"/> instance.
    /// </summary>
    public ProfessionalProfile Build() => new()
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
/// Builder for <see cref="ClientProfessionalLink"/> test entities.
/// </summary>
public class ClientProfessionalLinkBuilder
{
    private long _id;
    private long _clientProfileId;
    private long _professionalProfileId;
    private UserRole _professionalRole = UserRole.Trainer;
    private bool _isActive = true;
    private ClientProfile? _clientProfile;
    private ProfessionalProfile? _professionalProfile;
    private DateTime _dateCreated = DateTime.UtcNow;

    /// <summary>
    /// Sets the internal ID.
    /// </summary>
    public ClientProfessionalLinkBuilder WithId(long id) { _id = id; return this; }

    /// <summary>
    /// Sets the client profile ID.
    /// </summary>
    public ClientProfessionalLinkBuilder WithClientProfileId(long id) { _clientProfileId = id; return this; }

    /// <summary>
    /// Sets the professional profile ID.
    /// </summary>
    public ClientProfessionalLinkBuilder WithProfessionalProfileId(long id) { _professionalProfileId = id; return this; }

    /// <summary>
    /// Sets the professional role.
    /// </summary>
    public ClientProfessionalLinkBuilder WithProfessionalRole(UserRole role) { _professionalRole = role; return this; }

    /// <summary>
    /// Sets the link as inactive.
    /// </summary>
    public ClientProfessionalLinkBuilder Inactive() { _isActive = false; return this; }

    /// <summary>
    /// Sets the ClientProfile navigation property.
    /// </summary>
    public ClientProfessionalLinkBuilder WithClientProfile(ClientProfile cp) { _clientProfile = cp; _clientProfileId = cp.Id; return this; }

    /// <summary>
    /// Sets the ProfessionalProfile navigation property.
    /// </summary>
    public ClientProfessionalLinkBuilder WithProfessionalProfile(ProfessionalProfile pp) { _professionalProfile = pp; _professionalProfileId = pp.Id; return this; }

    /// <summary>
    /// Sets the date created.
    /// </summary>
    public ClientProfessionalLinkBuilder WithDateCreated(DateTime dt) { _dateCreated = dt; return this; }

    /// <summary>
    /// Builds the <see cref="ClientProfessionalLink"/> instance.
    /// </summary>
    public ClientProfessionalLink Build() => new()
    {
        Id = _id,
        ClientProfileId = _clientProfileId, ProfessionalProfileId = _professionalProfileId,
        ProfessionalRole = _professionalRole, IsActive = _isActive,
        ClientProfile = _clientProfile!, ProfessionalProfile = _professionalProfile!,
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
    private long _professionalProfileId = 1;
    private string _email = "client@test.com";
    private string _token = "invite-token";
    private DateTime _expiresAt = DateTime.UtcNow.AddDays(7);
    private bool _isUsed;
    private ProfessionalProfile? _professionalProfile;

    /// <summary>
    /// Sets the professional profile ID.
    /// </summary>
    public InvitationTokenBuilder WithProfessionalProfileId(long id) { _professionalProfileId = id; return this; }

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
    /// Sets the ProfessionalProfile navigation property.
    /// </summary>
    public InvitationTokenBuilder WithProfessionalProfile(ProfessionalProfile pp) { _professionalProfile = pp; _professionalProfileId = pp.Id; return this; }

    /// <summary>
    /// Builds the <see cref="Application.Domain.Entities.InvitationToken"/> instance.
    /// </summary>
    public InvitationToken Build() => new()
    {
        ProfessionalProfileId = _professionalProfileId, Email = _email, Token = _token,
        ExpiresAt = _expiresAt, IsUsed = _isUsed, ProfessionalProfile = _professionalProfile!
    };
}

/// <summary>
/// Builder for <see cref="Application.Domain.Entities.PendingInvite"/> test entities.
/// </summary>
public class PendingInviteBuilder
{
    private long _id;
    private long _professionalProfileId = 1;
    private string _firstName = "Invited";
    private string _lastName = "Client";
    private string _email = "invited@test.com";
    private DateTime _sentAt = DateTime.UtcNow;
    private bool _isAccepted;
    private ProfessionalProfile? _professionalProfile;

    /// <summary>
    /// Sets the internal ID.
    /// </summary>
    public PendingInviteBuilder WithId(long id) { _id = id; return this; }

    /// <summary>
    /// Sets the professional profile ID.
    /// </summary>
    public PendingInviteBuilder WithProfessionalProfileId(long id) { _professionalProfileId = id; return this; }

    /// <summary>
    /// Sets the first name.
    /// </summary>
    public PendingInviteBuilder WithFirstName(string fn) { _firstName = fn; return this; }

    /// <summary>
    /// Sets the last name.
    /// </summary>
    public PendingInviteBuilder WithLastName(string ln) { _lastName = ln; return this; }

    /// <summary>
    /// Sets the email.
    /// </summary>
    public PendingInviteBuilder WithEmail(string email) { _email = email; return this; }

    /// <summary>
    /// Marks the invite as accepted.
    /// </summary>
    public PendingInviteBuilder Accepted() { _isAccepted = true; return this; }

    /// <summary>
    /// Sets the ProfessionalProfile navigation property.
    /// </summary>
    public PendingInviteBuilder WithProfessionalProfile(ProfessionalProfile pp) { _professionalProfile = pp; _professionalProfileId = pp.Id; return this; }

    /// <summary>
    /// Builds the <see cref="Application.Domain.Entities.PendingInvite"/> instance.
    /// </summary>
    public Application.Domain.Entities.PendingInvite Build() => new()
    {
        Id = _id,
        ProfessionalProfileId = _professionalProfileId,
        FirstName = _firstName,
        LastName = _lastName,
        Email = _email,
        SentAt = _sentAt,
        IsAccepted = _isAccepted,
        ProfessionalProfile = _professionalProfile!
    };
}

/// <summary>
/// Builder for <see cref="ClientOnboardingData"/> test entities.
/// </summary>
public class ClientOnboardingDataBuilder
{
    private readonly ClientOnboardingData _entity = new()
    {
        Id = 1,
        ClientProfileId = 1,
        DateOfBirth = new DateTime(2000, 1, 1),
        Sex = BiologicalSex.Male,
        HeightCm = 180,
        WeightKg = 80,
        BodyType = BodyType.Mesomorph,
        PrimaryGoal = PrimaryGoal.GainMuscle,
        TimeHorizon = TimeHorizon.SixMonths,
        JobType = JobType.Sedentary,
        SleepHours = 7,
        StressLevel = 3,
        CurrentTrainingFrequency = CurrentTrainingFrequency.Regular,
        DesiredTrainingFrequency = DesiredTrainingFrequency.FourPerWeek,
        FitnessRating = 6,
        GymAccess = GymAccess.Yes,
        PreferredActivities = "strength,cardio",
        Injuries = "none",
        MealsPerDay = MealsPerDay.FourToFive,
        DietaryStyle = DietaryStyle.Standard,
        Allergies = "none",
        DietRating = 3,
        PlanExperience = PlanExperience.TriedFailed,
        PastBlockers = "time,motivation",
        PrimaryMotivation = PrimaryMotivation.Appearance,
    };

    /// <summary>
    /// Sets the client profile ID.
    /// </summary>
    public ClientOnboardingDataBuilder WithClientProfileId(long id) { _entity.ClientProfileId = id; return this; }

    /// <summary>
    /// Builds the <see cref="ClientOnboardingData"/> instance.
    /// </summary>
    public ClientOnboardingData Build() => _entity;
}
