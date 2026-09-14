using System.Reflection;
using System.Text.RegularExpressions;
using FitnessPlatform.Application.Domain.Constants;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Constants;

/// <summary>
/// Guards <see cref="MongoCollections"/> against reintroducing a snake_case collection name
/// (#1033 fixed the one outlier, <c>TrainerNotes</c>, which was snake_case for no reason other
/// than a misread of issue #492). Every constant must be camelCase, matching the on-disk Mongo
/// collection naming used everywhere else in this backend.
/// </summary>
public partial class MongoCollectionsNamingTests
{
    [GeneratedRegex("^[a-z][a-zA-Z0-9]*$")]
    private static partial Regex CamelCasePattern();

    [Fact]
    public void AllCollectionConstants_MatchCamelCase()
    {
        var collectionNames = typeof(MongoCollections)
            .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
            .Where(field => field.IsLiteral && field.FieldType == typeof(string))
            .Select(field => (Name: field.Name, Value: (string)field.GetRawConstantValue()!))
            .ToList();

        collectionNames.Should().NotBeEmpty("MongoCollections should declare at least one collection constant");

        foreach (var (name, value) in collectionNames)
        {
            CamelCasePattern().IsMatch(value).Should().BeTrue(
                $"{name} = \"{value}\" must be camelCase, matching every other MongoCollections constant");
        }
    }
}
