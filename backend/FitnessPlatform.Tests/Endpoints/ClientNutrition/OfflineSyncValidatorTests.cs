using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientMeasurements.AddMeasurement;
using FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;
using FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;
using FitnessPlatform.Application.Features.ClientNutrition.RemoveOffPlanFood;
using FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;
using FitnessPlatform.Application.Features.ClientNutrition.UnlogMealEaten;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for the shared offline-sync rules (<c>OccurredAt</c>, <c>ClientRequestId</c>) as wired into
/// each client write validator. Asserts the error code, not the property name.
/// </summary>
public class OfflineSyncValidatorTests
{
    private static readonly LogMealEatenValidator Validator = new();

    private static TestValidationResult<LogMealEatenRequest> ValidateLog(DateTimeOffset? occurredAt, Guid? clientRequestId = null) =>
        Validator.TestValidate(new LogMealEatenRequest
        {
            MealId = Guid.NewGuid(),
            OccurredAt = occurredAt,
            ClientRequestId = clientRequestId,
        });

    private static bool HasCode<T>(TestValidationResult<T> result, string code) where T : class =>
        result.Errors.Any(e => e.ErrorCode == code);

    [Fact]
    public void Validate_NoOfflineFields_Passes() =>
        ValidateLog(null).ShouldNotHaveAnyValidationErrors();

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    public void Validate_OccurredAtWithinFutureSkew_Passes(int minutesAhead) =>
        ValidateLog(DateTimeOffset.UtcNow.AddMinutes(minutesAhead)).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_OccurredAtMoreThanFiveMinutesAhead_FailsWithInFutureCode()
    {
        var result = ValidateLog(DateTimeOffset.UtcNow.AddMinutes(10));

        HasCode(result, ErrorCodes.OccurredAtInFuture).Should().BeTrue();
        HasCode(result, ErrorCodes.OccurredAtTooOld).Should().BeFalse();
    }

    [Fact]
    public void Validate_OccurredAtSixDaysAgo_Passes() =>
        ValidateLog(DateTimeOffset.UtcNow.AddDays(-6)).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_OccurredAtOlderThanSevenDays_FailsWithTooOldCode()
    {
        var result = ValidateLog(DateTimeOffset.UtcNow.AddDays(-7).AddMinutes(-1));

        HasCode(result, ErrorCodes.OccurredAtTooOld).Should().BeTrue();
        HasCode(result, ErrorCodes.OccurredAtInFuture).Should().BeFalse();
    }

    [Fact]
    public void Validate_OffsetOccurredAt_IsComparedInUtc() =>
        ValidateLog(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(14))).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_EmptyClientRequestId_Fails() =>
        ValidateLog(null, Guid.Empty).ShouldHaveValidationErrorFor(x => x.ClientRequestId);

    [Fact]
    public void Validate_UnlogTooOld_FailsWithTooOldCode()
    {
        var result = new UnlogMealEatenValidator().TestValidate(
            new UnlogMealEatenRequest { MealId = Guid.NewGuid(), OccurredAt = DateTimeOffset.UtcNow.AddDays(-8) });

        HasCode(result, ErrorCodes.OccurredAtTooOld).Should().BeTrue();
    }

    [Fact]
    public void Validate_AddOffPlanFuture_FailsWithInFutureCode()
    {
        var result = new AddOffPlanFoodValidator().TestValidate(new AddOffPlanFoodRequest
        {
            FoodExternalId = Guid.NewGuid(),
            AmountGrams = 100,
            OccurredAt = DateTimeOffset.UtcNow.AddHours(1),
        });

        HasCode(result, ErrorCodes.OccurredAtInFuture).Should().BeTrue();
    }

    [Fact]
    public void Validate_AddOffPlanEmptyEntryId_Fails() =>
        new AddOffPlanFoodValidator().TestValidate(new AddOffPlanFoodRequest
        {
            FoodExternalId = Guid.NewGuid(),
            AmountGrams = 100,
            EntryId = Guid.Empty,
        }).ShouldHaveValidationErrorFor(x => x.EntryId);

    [Fact]
    public void Validate_AddOffPlanClientEntryId_Passes() =>
        new AddOffPlanFoodValidator().TestValidate(new AddOffPlanFoodRequest
        {
            FoodExternalId = Guid.NewGuid(),
            AmountGrams = 100,
            EntryId = Guid.NewGuid(),
        }).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_RemoveOffPlanTooOld_FailsWithTooOldCode()
    {
        var result = new RemoveOffPlanFoodValidator().TestValidate(
            new RemoveOffPlanFoodRequest { EntryId = Guid.NewGuid(), OccurredAt = DateTimeOffset.UtcNow.AddDays(-9) });

        HasCode(result, ErrorCodes.OccurredAtTooOld).Should().BeTrue();
    }

    [Fact]
    public void Validate_TickFuture_FailsWithInFutureCode()
    {
        var result = new SetShoppingListItemTickedValidator().TestValidate(new SetShoppingListItemTickedRequest
        {
            WeekNumber = 1,
            FoodExternalId = Guid.NewGuid(),
            OccurredAt = DateTimeOffset.UtcNow.AddHours(2),
        });

        HasCode(result, ErrorCodes.OccurredAtInFuture).Should().BeTrue();
    }

    [Fact]
    public void Validate_AddMeasurementTooOld_FailsWithTooOldCode_ButOldMeasuredAtStillPasses()
    {
        var result = new AddMeasurementValidator().TestValidate(new AddMeasurementRequest
        {
            MeasuredAt = DateTime.UtcNow.AddDays(-30),
            OccurredAt = DateTimeOffset.UtcNow.AddDays(-8),
        });

        HasCode(result, ErrorCodes.OccurredAtTooOld).Should().BeTrue();
        result.Errors.Should().ContainSingle();
    }
}
