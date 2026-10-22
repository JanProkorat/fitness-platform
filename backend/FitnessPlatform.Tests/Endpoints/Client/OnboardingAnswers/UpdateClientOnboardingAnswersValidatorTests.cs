using FitnessPlatform.Application.Features.Client.OnboardingAnswers.Update;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Client.OnboardingAnswers;

/// <summary>
/// Unit tests for <see cref="UpdateClientOnboardingAnswersValidator"/>.
/// </summary>
public class UpdateClientOnboardingAnswersValidatorTests
{
    private static bool Passes(UpdateClientOnboardingAnswersRequest request) =>
        new UpdateClientOnboardingAnswersValidator().TestValidate(request).IsValid;

    [Fact]
    public void Validate_EmptyBody_Passes() => Passes(new()).Should().BeTrue();

    [Fact]
    public void Validate_AllFieldsValid_Passes() =>
        Passes(new()
        {
            PrimaryGoal = "loseFat",
            TargetWeightKg = 70m,
            DesiredTrainingFrequency = "ThreePerWeek",
            GymAccess = "Sometimes",
            Injuries = ["knees"],
            DietaryStyle = "Vegan",
            Allergies = ["nuts"],
            Dislikes = ["mushrooms"],
        }).Should().BeTrue();

    [Theory]
    [InlineData("99")]
    [InlineData("Flying")]
    public void Validate_NumericOrUnknownEnum_Fails(string value)
    {
        Passes(new() { PrimaryGoal = value }).Should().BeFalse();
        Passes(new() { DesiredTrainingFrequency = value }).Should().BeFalse();
        Passes(new() { GymAccess = value }).Should().BeFalse();
        Passes(new() { DietaryStyle = value }).Should().BeFalse();
    }

    [Theory]
    [InlineData(39.9, false)]
    [InlineData(40, true)]
    [InlineData(250, true)]
    [InlineData(250.1, false)]
    public void Validate_TargetWeightBoundary(double weight, bool valid) =>
        Passes(new() { TargetWeightKg = (decimal)weight }).Should().Be(valid);

    [Fact]
    public void Validate_AllergyListJoinedOver200_Fails() =>
        Passes(new() { Allergies = [new string('a', 100), new string('b', 100)] }).Should().BeFalse();

    [Fact]
    public void Validate_InjuryListJoinedAt200_Passes() =>
        Passes(new() { Injuries = [new string('a', 99), new string('b', 100)] }).Should().BeTrue();

    [Theory]
    [InlineData(" ")]
    [InlineData("a,b")]
    public void Validate_BlankOrCommaItem_Fails(string item)
    {
        Passes(new() { Allergies = [item] }).Should().BeFalse();
        Passes(new() { Injuries = [item] }).Should().BeFalse();
    }

    [Theory]
    [InlineData(0, 0, false)]
    [InlineData(-13, 1, false)]
    [InlineData(-13, 0, true)]
    [InlineData(-101, 1, true)]
    [InlineData(-101, 0, false)]
    public void Validate_DateOfBirthAgeBoundary(int yearsOffset, int daysOffset, bool valid)
    {
        var dateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(yearsOffset).AddDays(daysOffset);

        Passes(new() { DateOfBirth = dateOfBirth }).Should().Be(valid);
    }

    [Theory]
    [InlineData("99")]
    [InlineData("Flying")]
    public void Validate_NumericOrUnknownLifestyleEnum_Fails(string value)
    {
        Passes(new() { Sex = value }).Should().BeFalse();
        Passes(new() { JobType = value }).Should().BeFalse();
        Passes(new() { CurrentTrainingFrequency = value }).Should().BeFalse();
        Passes(new() { MealsPerDay = value }).Should().BeFalse();
    }

    [Theory]
    [InlineData(139.9, 5, 3, false)]
    [InlineData(140, 1, 1, true)]
    [InlineData(220, 10, 5, true)]
    [InlineData(220.1, 5, 3, false)]
    [InlineData(170.04, 5, 3, false)]
    [InlineData(170, 0, 3, false)]
    [InlineData(170, 11, 3, false)]
    [InlineData(170, 5, 0, false)]
    [InlineData(170, 5, 6, false)]
    public void Validate_HeightSleepStressRanges(double height, int sleep, int stress, bool valid) =>
        Passes(new() { HeightCm = (decimal)height, SleepHours = sleep, StressLevel = stress }).Should().Be(valid);

    [Fact]
    public void Validate_PreferredActivityWithComma_Fails() =>
        Passes(new() { PreferredActivities = ["strength,cardio"] }).Should().BeFalse();

    [Fact]
    public void Validate_TooManyOrTooLongHabits_Fails()
    {
        Passes(new() { Habits = [.. Enumerable.Repeat("x", 21)] }).Should().BeFalse();
        Passes(new() { Habits = [new string('x', 61)] }).Should().BeFalse();
        Passes(new() { Habits = [.. Enumerable.Repeat("x", 20)] }).Should().BeTrue();
    }

    [Fact]
    public void Validate_TooManyOrTooLongDislikes_Fails()
    {
        Passes(new() { Dislikes = [.. Enumerable.Repeat("x", 21)] }).Should().BeFalse();
        Passes(new() { Dislikes = [new string('x', 61)] }).Should().BeFalse();
    }
}
