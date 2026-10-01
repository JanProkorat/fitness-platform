using System.Text.Json;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Constants;

/// <summary>
/// Guards <see cref="FoodCategoryLabels"/> against drifting from the web portal's own source of
/// truth — <c>web/src/i18n/locales/{cs,en,de}.json</c>'s <c>foods.category*</c> keys (#1139).
/// Reads the three locale files directly off disk instead of duplicating their content in a
/// fixture, so a translator editing a label in the web package fails this backend test too.
/// </summary>
public class FoodCategoryLabelsDriftTests
{
    [Theory]
    [InlineData("cs")]
    [InlineData("en")]
    [InlineData("de")]
    public void EveryFoodCategory_MatchesWebLocaleFile(string locale)
    {
        var localeFilePath = Path.Combine(FindRepoRoot(), "web", "src", "i18n", "locales", $"{locale}.json");
        File.Exists(localeFilePath).Should().BeTrue($"the web locale file should exist at {localeFilePath}");

        using var document = JsonDocument.Parse(File.ReadAllText(localeFilePath));
        var foodsSection = document.RootElement.GetProperty("foods");

        var table = FoodCategoryLabels.ForLanguage(locale);

        foreach (var category in Enum.GetValues<FoodCategory>())
        {
            var key = $"category{category}";

            foodsSection.TryGetProperty(key, out var labelElement).Should().BeTrue(
                $"web/src/i18n/locales/{locale}.json should declare foods.{key}");

            table.Should().ContainKey(category);
            table[category].Should().Be(
                labelElement.GetString(),
                $"FoodCategoryLabels for '{locale}'/{category} should mirror foods.{key} in {locale}.json");
        }
    }

    /// <summary>
    /// Walks up from the test assembly's output directory until it finds the folder containing
    /// <c>web/src/i18n/locales</c> — the repo root.
    /// </summary>
    private static string FindRepoRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "web", "src", "i18n", "locales")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Could not locate the repo root (a folder containing web/src/i18n/locales) above {AppContext.BaseDirectory}");
    }
}
