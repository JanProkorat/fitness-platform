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
// This assembly-level parallelization disable is retained as a secondary defence:
// it prevents Docker/Testcontainer port exhaustion from multiple factories starting
// simultaneously on CI's 2-core runner, and serialises the execution order to make
// failures easier to diagnose when they do occur.
//
// The CollectionBehavior attribute is the xUnit v3 mechanism for binary-direct runs
// (CI: ./FitnessPlatform.Tests/bin/Release/net10.0/FitnessPlatform.Tests).
// xunit.runner.json covers dotnet-test / VSTest adapter runs.
//
// See also: FitnessApiFactory.cs (PhotoDiaryReminderScheduler suppression, #278 precedent).
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]
