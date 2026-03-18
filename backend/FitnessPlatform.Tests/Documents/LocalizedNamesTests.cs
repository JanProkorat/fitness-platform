using FitnessPlatform.Application.Domain.Documents;
using FluentAssertions;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Unit tests for <see cref="LocalizedNames"/> resolve/fallback logic.
/// </summary>
public class LocalizedNamesTests
{
    [Fact]
    public void Resolve_ExactMatch_ReturnsPreferredLanguage()
    {
        var names = new LocalizedNames { En = "Apple", Cs = "Jablko", De = "Apfel" };

        names.Resolve("cs").Should().Be("Jablko");
        names.Resolve("de").Should().Be("Apfel");
        names.Resolve("en").Should().Be("Apple");
    }

    [Fact]
    public void Resolve_PreferredMissing_FallsBackToEnglish()
    {
        var names = new LocalizedNames { En = "Apple", Cs = null, De = null };

        names.Resolve("cs").Should().Be("Apple");
        names.Resolve("de").Should().Be("Apple");
    }

    [Fact]
    public void Resolve_PreferredAndEnglishMissing_FallsBackToCzechThenGerman()
    {
        var names = new LocalizedNames { En = null, Cs = "Jablko", De = null };
        names.Resolve("de").Should().Be("Jablko");

        var names2 = new LocalizedNames { En = null, Cs = null, De = "Apfel" };
        names2.Resolve("cs").Should().Be("Apfel");
    }

    [Fact]
    public void Resolve_AllNull_ReturnsNull()
    {
        var names = new LocalizedNames { En = null, Cs = null, De = null };
        names.Resolve("en").Should().BeNull();
    }

    [Fact]
    public void Resolve_NullLanguage_FallsBackToEnglish()
    {
        var names = new LocalizedNames { En = "Apple", Cs = "Jablko", De = "Apfel" };
        names.Resolve(null).Should().Be("Apple");
    }

    [Fact]
    public void Resolve_UnsupportedLanguage_FallsBackToEnglish()
    {
        var names = new LocalizedNames { En = "Apple", Cs = "Jablko", De = "Apfel" };
        names.Resolve("fr").Should().Be("Apple");
    }
}
