using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Bundles the field accessors <see cref="TrainingContentRuleSet.ApplyExerciseChildRules{TExercise,TSet}"/>
/// needs to validate an exercise-and-its-sets subtree, regardless of the concrete DTO/document
/// shape carrying that data. An interface was considered and rejected here: the three call sites'
/// exercise/set types disagree on nullability (<c>CreateSessionTemplateRequest.Format</c> is
/// non-nullable <see cref="WorkoutFormat"/>; the plan write path's is <c>WorkoutFormat?</c>) and on
/// set element type (<see cref="Documents.ExerciseSet"/> vs the plan path's
/// <c>UpdateExerciseSetRequest</c>) — a shared interface would force edits to three request DTOs
/// and two Mongo documents just to satisfy a validator. A bundle of accessors composes over the
/// existing shapes with zero DTO/document changes. In-repo precedent for a
/// <c>readonly record struct</c> carrying a bundle of related values: <see cref="CoachEntitlements"/>.
/// </summary>
/// <remarks>
/// Every scalar member is <see cref="Expression{TDelegate}"/>, not a pre-compiled
/// <see cref="Func{T,TResult}"/> — the same fix as <c>SessionTemplateRuleSet</c> (#892 review):
/// every call site already constructs this bundle from literal <c>e =&gt; e.ExerciseExternalId</c>
/// lambdas, so an <c>Expression&lt;&gt;</c>-typed member lets <c>TrainingContentRuleSet</c> pass it
/// straight to <c>RuleFor</c> with the real member-access expression intact, resolving
/// <c>PropertyName</c> from actual reflection metadata (including the global camelCasing
/// resolver, once the app host boots) instead of a pinned literal. <see cref="Sets"/> stays
/// <see cref="Func{T,TResult}"/>: <c>RuleForEach</c> requires an
/// <c>IEnumerable&lt;TElement&gt;</c>-shaped expression, which a pre-built
/// <c>Expression&lt;Func&lt;TExercise,List&lt;TSet&gt;&gt;&gt;</c> member has no variance to satisfy
/// without a fresh lambda at the call site — the caller cannot supply one when reusing this shared
/// bundle, so <c>TrainingContentRuleSet</c> keeps the delegate-invoke-plus-<c>OverridePropertyName</c>
/// form for this one member only.
/// </remarks>
public readonly record struct SessionExerciseAccessors<TExercise, TSet>(
    Expression<Func<TExercise, Guid>> ExerciseExternalId,
    Expression<Func<TExercise, string>> ExerciseName,
    Expression<Func<TExercise, int>> Order,
    Expression<Func<TExercise, int?>> RestSeconds,
    Expression<Func<TExercise, WorkoutFormat?>> Format,
    Expression<Func<TExercise, WodConfig?>> FormatConfig,
    Func<TExercise, List<TSet>> Sets,
    Expression<Func<TSet, int>> SetNumber,
    Expression<Func<TSet, int?>> Reps,
    Expression<Func<TSet, decimal?>> WeightKg,
    Expression<Func<TSet, decimal?>> Rpe);
