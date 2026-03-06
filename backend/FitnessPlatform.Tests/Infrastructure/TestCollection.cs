namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Defines a shared test collection so all test classes use the same FitnessApiFactory.
/// </summary>
[CollectionDefinition(Name)]
public class TestCollection : ICollectionFixture<FitnessApiFactory>
{
    public const string Name = "Integration";
}
