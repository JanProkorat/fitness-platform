using FluentAssertions;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Services;
using Microsoft.Extensions.Configuration;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// The four coach notification emails (check-in, join request, photos, workout) rendered in every language.
/// </summary>
public class EmailTemplateRendererNotificationTests
{
    private const string ActionUrl = "https://app.example/clients/abc/forms";

    private static readonly EmailTemplateRenderer Renderer = new(new ConfigurationBuilder().Build());

    private static NotificationEmailWorkItem Item(
        NotificationEvent notificationEvent, string language, params (string Key, string Value)[] extra)
    {
        var values = new Dictionary<string, string>
        {
            [NotificationEmailWorkItem.ClientNameKey] = "Petra Svobodova",
            [NotificationEmailWorkItem.ActionUrlKey] = ActionUrl,
        };

        foreach (var (key, value) in extra)
        {
            values[key] = value;
        }

        return new NotificationEmailWorkItem("coach@example.com", language, Guid.NewGuid(), notificationEvent, values);
    }

    public static TheoryData<NotificationEvent, string> EveryEventAndLanguage()
    {
        var data = new TheoryData<NotificationEvent, string>();

        foreach (var notificationEvent in new[]
                 {
                     NotificationEvent.WeeklyCheckInSubmitted, NotificationEvent.JoinRequest,
                     NotificationEvent.ProgressPhotosSubmitted, NotificationEvent.WorkoutFinished
                 })
        {
            foreach (var language in new[] { "en", "cs", "de" })
            {
                data.Add(notificationEvent, language);
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(EveryEventAndLanguage))]
    public void RenderNotification_EveryEventAndLanguage_FillsEveryPlaceholderAndLinksThePortal(
        NotificationEvent notificationEvent, string language)
    {
        var (subject, html) = Renderer.RenderNotification(Item(
            notificationEvent, language, (NotificationEmailWorkItem.PhotoCountKey, "3")));

        subject.Should().NotBeNullOrWhiteSpace().And.NotContain("{{");
        html.Should().NotContain("{{").And.Contain(ActionUrl).And.Contain("Petra");
        html.Should().Contain($"lang=\"{language}\"");
    }

    [Theory]
    [MemberData(nameof(EveryEventAndLanguage))]
    public void RenderNotification_EveryEventAndLanguage_UsesNeutralCopyAndNeverTheBannedCzechWord(
        NotificationEvent notificationEvent, string language)
    {
        var (subject, html) = Renderer.RenderNotification(Item(
            notificationEvent, language, (NotificationEmailWorkItem.PhotoCountKey, "1")));
        var copy = $"{subject} {html}".ToLowerInvariant();

        copy.Should().NotContain("kouč");
        copy.Should().NotContain(" her ").And.NotContain(" she ").And.NotContain(" his ");
        copy.Should().NotContain("(a)");
    }

    [Fact]
    public void RenderNotification_ClientNameWithMarkup_IsHtmlEncoded()
    {
        var item = Item(NotificationEvent.JoinRequest, "en");
        var hostile = item with
        {
            Values = new Dictionary<string, string>(item.Values) { [NotificationEmailWorkItem.ClientNameKey] = "<script>alert(1)</script>" }
        };

        var (_, html) = Renderer.RenderNotification(hostile);

        html.Should().NotContain("<script>alert(1)</script>").And.Contain("&lt;script&gt;");
    }

    [Fact]
    public void RenderNotification_CheckInWithWeight_ShowsTheWeightTile()
    {
        var (_, withWeight) = Renderer.RenderNotification(Item(
            NotificationEvent.WeeklyCheckInSubmitted, "en", (NotificationEmailWorkItem.WeightKey, "68.4 kg")));
        var (_, withoutWeight) = Renderer.RenderNotification(Item(NotificationEvent.WeeklyCheckInSubmitted, "en"));

        withWeight.Should().Contain("68.4 kg").And.Contain("Weight");
        withoutWeight.Should().NotContain("Weight");
    }

    [Fact]
    public void RenderNotification_JoinRequestMessageAndPackageAreOptional()
    {
        var (_, full) = Renderer.RenderNotification(Item(
            NotificationEvent.JoinRequest, "en",
            (NotificationEmailWorkItem.MessageKey, "Two sessions a week"),
            (NotificationEmailWorkItem.PackageNameKey, "Starter")));
        var (_, bare) = Renderer.RenderNotification(Item(NotificationEvent.JoinRequest, "en"));

        full.Should().Contain("Two sessions a week").And.Contain("Package: Starter");
        bare.Should().NotContain("Package:").And.NotContain("&ldquo;");
    }

    [Theory]
    [InlineData("en", "3", "3 photos")]
    [InlineData("en", "1", "1 photo")]
    [InlineData("cs", "1", "1 fotku")]
    [InlineData("cs", "3", "3 fotky")]
    [InlineData("cs", "5", "5 fotek")]
    [InlineData("de", "2", "2 Fotos")]
    public void RenderNotification_Photos_SaysPhotosGenericallyWithTheRightPlural(string language, string count, string expected)
    {
        var (_, html) = Renderer.RenderNotification(Item(
            NotificationEvent.ProgressPhotosSubmitted, language, (NotificationEmailWorkItem.PhotoCountKey, count)));

        html.Should().Contain(expected);
    }

    [Fact]
    public void RenderNotification_PhotosWithRequestDate_NamesTheLocalizedDate()
    {
        var (_, html) = Renderer.RenderNotification(Item(
            NotificationEvent.ProgressPhotosSubmitted, "cs",
            (NotificationEmailWorkItem.PhotoCountKey, "2"),
            (NotificationEmailWorkItem.RequestDateKey, "2026-10-12")));

        html.Should().Contain("12. 10. 2026");
    }

    [Fact]
    public void RenderNotification_WorkoutWithStats_ShowsTilesAndTheClientNote()
    {
        var (_, html) = Renderer.RenderNotification(Item(
            NotificationEvent.WorkoutFinished, "en",
            (NotificationEmailWorkItem.SessionNameKey, "Upper body A"),
            (NotificationEmailWorkItem.PlanNameKey, "Lean cut"),
            (NotificationEmailWorkItem.DurationMinutesKey, "47"),
            (NotificationEmailWorkItem.ExerciseCountKey, "6"),
            (NotificationEmailWorkItem.SetCountKey, "18"),
            (NotificationEmailWorkItem.NoteKey, "Felt strong")));

        html.Should().Contain("Upper body A").And.Contain("47 min").And.Contain("18").And.Contain("Felt strong");
    }

    [Fact]
    public void RenderNotification_EventWithoutTemplate_Throws()
    {
        var act = () => Renderer.RenderNotification(Item(NotificationEvent.NewMessage, "en"));

        act.Should().Throw<NotSupportedException>();
    }
}
