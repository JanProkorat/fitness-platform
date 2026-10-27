using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Variable symbol generation: the preferred symbol per format and the collision cases.
/// </summary>
public class VariableSymbolGeneratorTests
{
    private static readonly DateOnly November = new(2026, 11, 1);

    private static IReadOnlySet<string> Used(params string[] symbols) => new HashSet<string>(symbols);

    [Fact]
    public void Generate_ClientNumberFormat_IsMonthThenTheZeroPaddedClientNumber()
    {
        VariableSymbolGenerator.Generate(VariableSymbolFormat.YearMonthClientNumber, November, 7, Used())
            .Should().Be("2026110007");
    }

    [Fact]
    public void Generate_ClientNumberFormat_SecondPaymentInTheMonth_TakesTheHighestFreeTail()
    {
        VariableSymbolGenerator.Generate(
                VariableSymbolFormat.YearMonthClientNumber, November, 142, Used("2026110142"))
            .Should().Be("2026119999");
    }

    [Fact]
    public void Generate_ClientNumberFormat_ThirdPaymentInTheMonth_SkipsTheTakenHighTail()
    {
        VariableSymbolGenerator.Generate(
                VariableSymbolFormat.YearMonthClientNumber, November, 142, Used("2026110142", "2026119999"))
            .Should().Be("2026119998");
    }

    [Fact]
    public void Generate_SequenceFormat_StartsAtOneAndTakesTheLowestFreeTail()
    {
        VariableSymbolGenerator.Generate(VariableSymbolFormat.YearMonthSequence, November, 142, Used())
            .Should().Be("2026110001");
        VariableSymbolGenerator.Generate(
                VariableSymbolFormat.YearMonthSequence, November, 142, Used("2026110001", "2026110002", "2026110004"))
            .Should().Be("2026110003");
    }

    [Fact]
    public void Generate_FormatSwitchedMidMonth_NeverReusesASymbolMadeUnderTheOldFormat()
    {
        // The old format gave this client 2026110142; the sequence must not collide with it either.
        var used = Used("2026110001", "2026110142");

        VariableSymbolGenerator.Generate(VariableSymbolFormat.YearMonthSequence, November, 142, used)
            .Should().Be("2026110002");
    }

    [Theory]
    [InlineData(VariableSymbolFormat.YearMonthClientNumber)]
    [InlineData(VariableSymbolFormat.YearMonthSequence)]
    public void Generate_EveryTailOfTheMonthTaken_ReturnsNull(VariableSymbolFormat format)
    {
        var used = Enumerable.Range(1, 9999).Select(tail => "202611" + tail.ToString("D4")).ToHashSet();

        VariableSymbolGenerator.Generate(format, November, 142, used).Should().BeNull();
    }
}
