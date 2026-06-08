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
    private readonly List<PlanPhoto> _planPhotos = [];
    private readonly List<ClientOnboardingData> _clientOnboardingData = [];
    private readonly List<PendingInvite> _pendingInvites = [];
    private readonly List<ClientRequest> _clientRequests = [];
    private readonly List<QuestionnaireResponse> _questionnaireResponses = [];
    private readonly List<EmailVerificationToken> _emailVerificationTokens = [];
    private readonly List<DevicePushToken> _devicePushTokens = [];
    private readonly List<WeeklyCheckInSetting> _weeklyCheckInSettings = [];
    private readonly List<WeeklyCheckInClientOverride> _weeklyCheckInClientOverrides = [];
    private readonly List<PhotoDiaryRequest> _photoDiaryRequests = [];
    private readonly List<UserExternalLogin> _userExternalLogins = [];

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
    /// Adds a <see cref="PlanPhoto"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(PlanPhoto photo) { _planPhotos.Add(photo); return this; }

    /// <summary>
    /// Adds a <see cref="ClientOnboardingData"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ClientOnboardingData data) { _clientOnboardingData.Add(data); return this; }

    /// <summary>
    /// Adds a <see cref="PendingInvite"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(PendingInvite invite) { _pendingInvites.Add(invite); return this; }

    /// <summary>
    /// Adds a <see cref="ClientRequest"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(ClientRequest request) { _clientRequests.Add(request); return this; }

    /// <summary>
    /// Adds a <see cref="QuestionnaireResponse"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(QuestionnaireResponse response) { _questionnaireResponses.Add(response); return this; }

    /// <summary>
    /// Adds a <see cref="WeeklyCheckInSetting"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(WeeklyCheckInSetting setting) { _weeklyCheckInSettings.Add(setting); return this; }

    /// <summary>
    /// Adds a <see cref="WeeklyCheckInClientOverride"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(WeeklyCheckInClientOverride o) { _weeklyCheckInClientOverrides.Add(o); return this; }

    /// <summary>
    /// Adds a <see cref="PhotoDiaryRequest"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(PhotoDiaryRequest request) { _photoDiaryRequests.Add(request); return this; }

    /// <summary>
    /// Adds a <see cref="UserExternalLogin"/> to the mock context.
    /// </summary>
    public MockDbBuilder With(UserExternalLogin externalLogin) { _userExternalLogins.Add(externalLogin); return this; }

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
        var planPhotosSet = _planPhotos.BuildMockDbSet();
        var clientOnboardingDataSet = _clientOnboardingData.BuildMockDbSet();
        var pendingInvitesSet = _pendingInvites.BuildMockDbSet();
        var clientRequestsSet = _clientRequests.BuildMockDbSet();
        var questionnaireResponsesSet = _questionnaireResponses.BuildMockDbSet();
        var emailVerificationTokensSet = _emailVerificationTokens.BuildMockDbSet();
        var devicePushTokensSet = _devicePushTokens.BuildMockDbSet();
        var weeklyCheckInSettingsSet = _weeklyCheckInSettings.BuildMockDbSet();
        var weeklyCheckInClientOverridesSet = _weeklyCheckInClientOverrides.BuildMockDbSet();
        var photoDiaryRequestsSet = _photoDiaryRequests.BuildMockDbSet();
        var userExternalLoginsSet = _userExternalLogins.BuildMockDbSet();

        var db = Substitute.For<IApplicationDbContext>();

        db.Users.Returns(usersSet);
        db.ProfessionalProfiles.Returns(professionalProfilesSet);
        db.ClientProfiles.Returns(clientProfilesSet);
        db.ClientProfessionalLinks.Returns(clientProfessionalLinksSet);
        db.RefreshTokens.Returns(refreshTokensSet);
        db.InvitationTokens.Returns(invitationTokensSet);
        db.BodyMeasurements.Returns(bodyMeasurementsSet);
        db.PlanPhotos.Returns(planPhotosSet);
        db.ClientOnboardingData.Returns(clientOnboardingDataSet);
        db.PendingInvites.Returns(pendingInvitesSet);
        db.ClientRequests.Returns(clientRequestsSet);
        db.QuestionnaireResponses.Returns(questionnaireResponsesSet);
        db.EmailVerificationTokens.Returns(emailVerificationTokensSet);
        db.DevicePushTokens.Returns(devicePushTokensSet);
        db.WeeklyCheckInSettings.Returns(weeklyCheckInSettingsSet);
        db.WeeklyCheckInClientOverrides.Returns(weeklyCheckInClientOverridesSet);
        db.PhotoDiaryRequests.Returns(photoDiaryRequestsSet);
        db.UserExternalLogins.Returns(userExternalLoginsSet);

        db.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns(1);

        return db;
    }
}
