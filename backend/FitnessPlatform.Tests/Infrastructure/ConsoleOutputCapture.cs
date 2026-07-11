namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Redirects <see cref="Console.Out"/> to an in-memory buffer for the lifetime of the
/// instance, then restores the original writer on <see cref="Dispose"/>.
/// </summary>
/// <remarks>
/// Use this when a test needs to assert on actual log output rather than DB/broadcast side
/// effects. The app's Serilog pipeline (<c>Program.cs</c>'s <c>builder.Host.UseSerilog(...)</c>)
/// does NOT forward log events to DI-registered <see cref="Microsoft.Extensions.Logging.ILoggerProvider"/>
/// instances — Serilog's <c>UseSerilog</c> defaults <c>writeToProviders</c> to <c>false</c>, so a
/// custom <c>ILoggerProvider</c> added via <c>services.AddSingleton&lt;ILoggerProvider&gt;(...)</c>
/// is silently never invoked. Capturing the actual Console sink text is the only test-only
/// (non-production-code) way to observe log level/content in this codebase.
/// <para>
/// Safe to use because the test assembly runs with <c>DisableTestParallelization = true</c> /
/// <c>MaxParallelThreads = 1</c> (see <c>TestAssemblyConfig.cs</c>) — no other test writes to
/// <see cref="Console.Out"/> concurrently while this capture is active.
/// </para>
/// </remarks>
public sealed class ConsoleOutputCapture : IDisposable
{
    private readonly TextWriter _originalOut;
    private readonly StringWriter _buffer = new();

    public ConsoleOutputCapture()
    {
        _originalOut = Console.Out;
        Console.SetOut(_buffer);
    }

    /// <summary>Everything written to <see cref="Console.Out"/> since construction.</summary>
    public string Output => _buffer.ToString();

    public void Dispose() => Console.SetOut(_originalOut);
}
