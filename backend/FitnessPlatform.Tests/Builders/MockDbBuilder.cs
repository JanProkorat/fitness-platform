using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using MockQueryable.NSubstitute;
using NSubstitute;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// Builder for creating a mocked <see cref="ApplicationDbContext"/> with pre-populated DbSets.
/// </summary>
public class MockDbBuilder
{
    private readonly List<ApplicationUser> _users = [];
    private readonly List<ProfessionalProfile> _professionalProfiles = [];
    private readonly List<ClientProfile> _clientProfiles = [];
    private readonly List<ClientProfessionalLink> _clientProfessionalLinks = [];
    private readonly List<RefreshToken> _refreshTokens = [];
    private readonly List<InvitationToken> _invitationTokens = [];
    private readonly List<BodyMeasurement> _bodyMeasurements = [];
    private readonly List<ProgressPhoto> _progressPhotos = [];
    private readonly List<ClientOnboardingData> _clientOnboardingData = [];

    /// <summary>
    /// Adds an <see cref="ApplicationUser"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ApplicationUser user) { _users.Add(user); return this; }

    /// <summary>
    /// Adds a <see cref="ProfessionalProfile"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ProfessionalProfile profile) { _professionalProfiles.Add(profile); return this; }

    /// <summary>
    /// Adds a <see cref="ClientProfile"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ClientProfile profile) { _clientProfiles.Add(profile); return this; }

    /// <summary>
    /// Adds a <see cref="ClientProfessionalLink"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ClientProfessionalLink link) { _clientProfessionalLinks.Add(link); return this; }

    /// <summary>
    /// Adds a <see cref="Application.Domain.Entities.RefreshToken"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(Application.Domain.Entities.RefreshToken token) { _refreshTokens.Add(token); return this; }

    /// <summary>
    /// Adds an <see cref="InvitationToken"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(InvitationToken token) { _invitationTokens.Add(token); return this; }

    /// <summary>
    /// Adds a <see cref="BodyMeasurement"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(BodyMeasurement measurement) { _bodyMeasurements.Add(measurement); return this; }

    /// <summary>
    /// Adds a <see cref="ProgressPhoto"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ProgressPhoto photo) { _progressPhotos.Add(photo); return this; }

    /// <summary>
    /// Adds a <see cref="ClientOnboardingData"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ClientOnboardingData data) { _clientOnboardingData.Add(data); return this; }

    /// <summary>
    /// Builds a mocked <see cref="IApplicationDbContext"/> with all registered entities as queryable DbSets.
    /// </summary>
    public IApplicationDbContext Build()
    {
        // Build all mock DbSets BEFORE configuring Returns to avoid
        // NSubstitute's "substitute inside Returns()" pitfall.
        var usersSet = _users.BuildMockDbSet();
        var professionalProfilesSet = _professionalProfiles.BuildMockDbSet();
        var clientProfilesSet = _clientProfiles.BuildMockDbSet();
        var clientProfessionalLinksSet = _clientProfessionalLinks.BuildMockDbSet();
        var refreshTokensSet = _refreshTokens.BuildMockDbSet();
        var invitationTokensSet = _invitationTokens.BuildMockDbSet();
        var bodyMeasurementsSet = _bodyMeasurements.BuildMockDbSet();
        var progressPhotosSet = _progressPhotos.BuildMockDbSet();
        var clientOnboardingDataSet = _clientOnboardingData.BuildMockDbSet();

        var db = Substitute.For<IApplicationDbContext>();

        db.Users.Returns(usersSet);
        db.ProfessionalProfiles.Returns(professionalProfilesSet);
        db.ClientProfiles.Returns(clientProfilesSet);
        db.ClientProfessionalLinks.Returns(clientProfessionalLinksSet);
        db.RefreshTokens.Returns(refreshTokensSet);
        db.InvitationTokens.Returns(invitationTokensSet);
        db.BodyMeasurements.Returns(bodyMeasurementsSet);
        db.ProgressPhotos.Returns(progressPhotosSet);
        db.ClientOnboardingData.Returns(clientOnboardingDataSet);

        db.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns(1);

        return db;
    }
}
