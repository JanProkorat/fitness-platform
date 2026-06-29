// Disable cross-collection parallel execution for this test assembly.
//
// Root cause (#296): FastEndpoints sets a process-global static ServiceResolver.Provider
// when any WebApplicationFactory<Program> boots (via app.UseFastEndpoints). When the
// ResetEndpointFactoryBase factories (in [Collection("ResetTests")]) or FitnessApiFactory
// (in [Collection("Integration")]) dispose, the global provider becomes invalid. Any
// Factory.Create<TEndpoint>() call in a concurrently-running standalone (no-collection)
// test then throws:
//   ObjectDisposedException: Cannot access a disposed object. Object name: 'IServiceProvider'.
//
// The primary fix (#296) is in FitnessApiFactory.DisposeAsync() and
// ResetEndpointFactoryBase.DisposeAsync(): both skip base.DisposeAsync() so the
// IServiceProvider remains alive for the entire test-process lifetime. Containers
// are the only external resource that needs explicit cleanup.
//
// This secondary defence — assembly-level serialization — prevents two kinds of failures:
//   1. Factory.Create<T>() creates its own internal mini-WebApplicationFactory per call.
//      When that mini-factory disposes (it does not skip base.DisposeAsync()), it clears
//      the process-global ServiceResolver.Provider. Any concurrently-running Factory.Create
//      call in another implicit test collection then throws ObjectDisposedException. This
//      is exactly the failure seen when GetClientDashboardPermissionFlagsTests (added in
//      #558) ran in parallel with GetCustomFoodsEndpointTests: both collections used
//      Factory.Create, and the mini-factory dispose from one clobbered the global resolver
//      for the other. MaxParallelThreads = 1 prevents this by ensuring only one test
//      collection runs at a time.
//   2. Docker/Testcontainer port exhaustion from multiple factories starting simultaneously
//      on CI's 2-core runner.
//
// DisableTestParallelization = true: tests within a collection run sequentially (no
//   parallel tests inside one collection).
// MaxParallelThreads = 1: only one test collection runs at a time (cross-collection serial).
//
// Together these give fully deterministic serial execution in the binary-direct run
// (CI: ./FitnessPlatform.Tests/bin/Release/net10.0/FitnessPlatform.Tests).
// xunit.runner.json with parallelizeTestCollections:false covers dotnet-test / VSTest
// adapter runs via the same semantics.
//
// See also: FitnessApiFactory.cs (PhotoDiaryReminderScheduler suppression, #278 precedent).
//
// Issue #282 Finding 2 (ObjectDisposedException on FastEndpoints.ServiceResolver under parallel test load)
// addressed by this configuration + #296 (skip base.DisposeAsync to preserve
// ServiceResolver.Provider lifetime for full-factory tests).
// MaxParallelThreads = 1 added in #558 to close the gap for Factory.Create unit tests.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true, MaxParallelThreads = 1)]
