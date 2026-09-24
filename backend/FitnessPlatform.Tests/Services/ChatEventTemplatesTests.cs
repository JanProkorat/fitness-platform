using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ChatEventTemplates"/> — the per-type, per-language fallback lines
/// written into a cooperation-event <see cref="Application.Domain.Entities.ChatMessage"/>'s
/// <c>Text</c> at write time (#1100).
/// </summary>
public class ChatEventTemplatesTests
{
    public static IEnumerable<object[]> AllEventTypes() =>
        Enum.GetValues<ChatEventType>().Select(eventType => new object[] { eventType });

    [Theory]
    [MemberData(nameof(AllEventTypes))]
    public void Resolve_English_InterpolatesActorNameForEveryType(ChatEventType eventType)
    {
        var text = ChatEventTemplates.Resolve(eventType, "en", "Coach Carl");

        text.Should().Contain("Coach Carl");
        text.Should().NotContain("{actorName}");
    }

    [Theory]
    [MemberData(nameof(AllEventTypes))]
    public void Resolve_Czech_InterpolatesActorNameForEveryType(ChatEventType eventType)
    {
        var text = ChatEventTemplates.Resolve(eventType, "cs", "Kouč Karel");

        text.Should().Contain("Kouč Karel");
        text.Should().NotContain("{actorName}");
    }

    [Theory]
    [MemberData(nameof(AllEventTypes))]
    public void Resolve_German_InterpolatesActorNameForEveryType(ChatEventType eventType)
    {
        var text = ChatEventTemplates.Resolve(eventType, "de", "Trainer Karl");

        text.Should().Contain("Trainer Karl");
        text.Should().NotContain("{actorName}");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("fr")]
    [InlineData("EN")]
    public void Resolve_UnrecognizedOrMissingLanguage_FallsBackToEnglish(string? language)
    {
        var text = ChatEventTemplates.Resolve(ChatEventType.Invited, language, "Coach Carl");
        var englishText = ChatEventTemplates.Resolve(ChatEventType.Invited, "en", "Coach Carl");

        // "EN" (uppercase) also resolves the same English template — Normalize lowercases first.
        text.Should().Be(englishText);
    }

    [Fact]
    public void Resolve_DifferentEventTypes_ProduceDistinctWording()
    {
        var texts = Enum.GetValues<ChatEventType>()
            .Select(eventType => ChatEventTemplates.Resolve(eventType, "en", "Coach Carl"))
            .ToList();

        texts.Should().OnlyHaveUniqueItems();
    }
}
