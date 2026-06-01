using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for WorkoutFormat, MovementType, and WodConfig round-trips through
/// <see cref="UpdateTrainingPlanEndpoint"/> at both session and per-section/exercise level,
/// plus validator rejection of invalid format configurations.
/// </summary>
public class UpdateTrainingPlanFormatTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private static ISessionLockService CreateNoOpLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<SessionLock>());
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<CancellationToken>())
            .Returns(false);
        return svc;
    }

    private UpdateTrainingPlanEndpoint CreateEndpoint(IMongoContext mongo) =>
        Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            CreateNoOpLockService(),
            Substitute.For<IRealtimeNotifier>());

    /// <summary>Builds a minimal single-section request for a given session.</summary>
    private static UpdateSectionRequest DefaultSection(List<UpdateSessionExerciseRequest>? exercises = null) =>
        new() { Name = "Hlavní", Order = 0, Exercises = exercises ?? [] };

    // ── Session-level format round-trip tests ────────────────────────────────

    [Fact]
    public async Task HandleAsync_SessionWithEmomFormat_PersistsFormatAndConfig()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "EMOM Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "EMOM Session",
                            Order = 1,
                            Format = WorkoutFormat.EMOM,
                            FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 10 },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Format == WorkoutFormat.EMOM &&
                p.Weeks[0].Sessions[0].FormatConfig!.IntervalSeconds == 60 &&
                p.Weeks[0].Sessions[0].FormatConfig!.TotalRounds == 10),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SessionWithAmrapFormat_PersistsFormatAndConfig()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "AMRAP Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 2,
                            Name = "AMRAP Session",
                            Order = 1,
                            Format = WorkoutFormat.AMRAP,
                            FormatConfig = new WodConfig { TimeCapSeconds = 1200 },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Format == WorkoutFormat.AMRAP &&
                p.Weeks[0].Sessions[0].FormatConfig!.TimeCapSeconds == 1200),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SessionWithForTimeFormat_PersistsFormatAndConfig()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "ForTime Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 3,
                            Name = "ForTime Session",
                            Order = 1,
                            Format = WorkoutFormat.ForTime,
                            FormatConfig = new WodConfig { TimeCapSeconds = 600 },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Format == WorkoutFormat.ForTime &&
                p.Weeks[0].Sessions[0].FormatConfig!.TimeCapSeconds == 600),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SessionWithTabataFormat_PersistsFormatAndConfig()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Tabata Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 4,
                            Name = "Tabata Session",
                            Order = 1,
                            Format = WorkoutFormat.Tabata,
                            FormatConfig = new WodConfig { WorkSeconds = 20, RestSeconds = 10, TotalRounds = 8 },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Format == WorkoutFormat.Tabata &&
                p.Weeks[0].Sessions[0].FormatConfig!.WorkSeconds == 20 &&
                p.Weeks[0].Sessions[0].FormatConfig!.RestSeconds == 10 &&
                p.Weeks[0].Sessions[0].FormatConfig!.TotalRounds == 8),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SessionWithStandardFormat_FormatConfigIsNull()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Standard Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "Standard Session",
                            Order = 1,
                            Format = WorkoutFormat.Standard,
                            FormatConfig = null,
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Format == WorkoutFormat.Standard &&
                p.Weeks[0].Sessions[0].FormatConfig == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Exercise-level format and MovementType round-trip tests ─────────────

    [Fact]
    public async Task HandleAsync_ExerciseWithMovementType_PersistsMovementType()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "Session",
                            Order = 1,
                            Format = WorkoutFormat.Standard,
                            Sections =
                            [
                                DefaultSection(
                                [
                                    new UpdateSessionExerciseRequest
                                    {
                                        ExerciseExternalId = Guid.NewGuid(),
                                        ExerciseName = "Plank",
                                        Order = 1,
                                        MovementType = MovementType.Time,
                                        Sets = []
                                    }
                                ])
                            ]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Exercises[0].MovementType == MovementType.Time),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ExerciseWithFormatOverride_PersistsExerciseFormat()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "Session",
                            Order = 1,
                            Format = WorkoutFormat.Standard,
                            Sections =
                            [
                                DefaultSection(
                                [
                                    new UpdateSessionExerciseRequest
                                    {
                                        ExerciseExternalId = Guid.NewGuid(),
                                        ExerciseName = "Burpees",
                                        Order = 1,
                                        MovementType = MovementType.Reps,
                                        Format = WorkoutFormat.AMRAP,
                                        FormatConfig = new WodConfig { TimeCapSeconds = 300 },
                                        Sets = []
                                    }
                                ])
                            ]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Exercises[0].Format == WorkoutFormat.AMRAP &&
                p.Weeks[0].Sessions[0].Exercises[0].FormatConfig!.TimeCapSeconds == 300),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ExerciseWithNullFormat_InheritsFromSession()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "EMOM Session",
                            Order = 1,
                            Format = WorkoutFormat.EMOM,
                            FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 10 },
                            Sections =
                            [
                                DefaultSection(
                                [
                                    new UpdateSessionExerciseRequest
                                    {
                                        ExerciseExternalId = Guid.NewGuid(),
                                        ExerciseName = "Pull-ups",
                                        Order = 1,
                                        MovementType = MovementType.Reps,
                                        Format = null, // inherits from session
                                        FormatConfig = null,
                                        Sets = []
                                    }
                                ])
                            ]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks[0].Sessions[0].Exercises[0].Format == null &&
                p.Weeks[0].Sessions[0].Exercises[0].FormatConfig == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Old documents load without the new fields ────────────────────────────

    [Fact]
    public async Task HandleAsync_OldDocWithoutFormatFields_LoadsWithDefaults()
    {
        // Simulate an existing document that was saved before Format/MovementType existed.
        // C# property defaults (Standard, Reps) apply on deserialization.
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId);

        // Add a session with a section containing an exercise — Format and MovementType at C# defaults.
        plan.Weeks[0].Sessions.Add(new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            DayOfWeek = 1,
            Name = "Legacy Session",
            Order = 1,
            // Format defaults to null, FormatConfig defaults to null
            Sections =
            [
                new TrainingSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = Guid.NewGuid(),
                            ExerciseName = "Squat",
                            Order = 1
                            // MovementType defaults to Reps, Format defaults to null
                        }
                    ]
                }
            ]
        });

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Legacy Plan Updated",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }
            ]
        };

        // Should not throw — old document loads cleanly via C# defaults.
        var act = () => ep.HandleAsync(request, TestContext.Current.CancellationToken);
        await act.Should().NotThrowAsync();

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    // ── Validator rejection tests ────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_EmomSessionWithoutIntervalSeconds_RejectsValidation()
    {
        var validator = new UpdateTrainingPlanValidator();
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "EMOM",
                            Order = 1,
                            Format = WorkoutFormat.EMOM,
                            FormatConfig = new WodConfig { TotalRounds = 10 /* IntervalSeconds missing */ },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        var result = await validator.ValidateAsync(request, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName.Contains("IntervalSeconds") || e.ErrorMessage.Contains("IntervalSeconds"));
    }

    [Fact]
    public async Task HandleAsync_AmrapSessionWithoutTimeCapSeconds_RejectsValidation()
    {
        var validator = new UpdateTrainingPlanValidator();
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "AMRAP",
                            Order = 1,
                            Format = WorkoutFormat.AMRAP,
                            FormatConfig = new WodConfig { /* TimeCapSeconds missing */ },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        var result = await validator.ValidateAsync(request, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName.Contains("TimeCapSeconds") || e.ErrorMessage.Contains("TimeCapSeconds"));
    }

    [Fact]
    public async Task HandleAsync_TabataSessionMissingWorkSeconds_RejectsValidation()
    {
        var validator = new UpdateTrainingPlanValidator();
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "Tabata",
                            Order = 1,
                            Format = WorkoutFormat.Tabata,
                            FormatConfig = new WodConfig { RestSeconds = 10, TotalRounds = 8 /* WorkSeconds missing */ },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        var result = await validator.ValidateAsync(request, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName.Contains("WorkSeconds") || e.ErrorMessage.Contains("WorkSeconds"));
    }

    [Fact]
    public async Task HandleAsync_StandardSessionWithFormatConfig_RejectsValidation()
    {
        var validator = new UpdateTrainingPlanValidator();
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "Standard",
                            Order = 1,
                            Format = WorkoutFormat.Standard,
                            FormatConfig = new WodConfig { TimeCapSeconds = 600 }, // must be null for Standard
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        var result = await validator.ValidateAsync(request, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.ErrorMessage.Contains("null") || e.ErrorMessage.Contains("Standard") ||
            e.PropertyName.Contains("FormatConfig"));
    }

    [Fact]
    public async Task HandleAsync_ForTimeSessionWithoutTimeCap_RejectsValidation()
    {
        var validator = new UpdateTrainingPlanValidator();
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            DayOfWeek = 1,
                            Name = "ForTime",
                            Order = 1,
                            Format = WorkoutFormat.ForTime,
                            FormatConfig = new WodConfig { /* TimeCapSeconds missing */ },
                            Sections = [DefaultSection()]
                        }
                    ]
                }
            ]
        };

        var result = await validator.ValidateAsync(request, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName.Contains("TimeCapSeconds") || e.ErrorMessage.Contains("TimeCapSeconds"));
    }
}
