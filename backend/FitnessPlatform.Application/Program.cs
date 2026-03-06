using System.Threading.RateLimiting;
using FastEndpoints;
using FastEndpoints.Security;
using FastEndpoints.Swagger;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Application.Middleware;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .WriteTo.Console());

// PostgreSQL + EF Core
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString(ConfigKeys.PostgreSql))
        .UseSnakeCaseNamingConvention());
builder.Services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

// ASP.NET Identity
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 8;
    options.User.RequireUniqueEmail = true;
})
.AddRoles<ApplicationRole>()
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// FastEndpoints + JWT
var jwtSecret = builder.Configuration[ConfigKeys.JwtSecret]
    ?? throw new InvalidOperationException("JWT secret is not configured.");

builder.Services
    .AddAuthenticationJwtBearer(s =>
    {
        s.SigningKey = jwtSecret;
    })
    .AddAuthorization()
    .AddFastEndpoints()
    .SwaggerDocument(o =>
    {
        o.DocumentSettings = s =>
        {
            s.Title = "Fitness Platform API";
            s.Version = "v1";
        };
    });

// Rate Limiting
var rateLimitingDisabled = builder.Configuration.GetValue<bool>("RateLimiting:Disabled");

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(AppPolicies.AuthRateLimit, context =>
        rateLimitingDisabled
            ? RateLimitPartition.GetNoLimiter("disabled")
            : RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0
                }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy(AppPolicies.AllowWebApp, policy =>
    {
        var origins = builder.Configuration.GetSection(ConfigKeys.CorsAllowedOrigins).Get<string[]>()
            ?? ["http://localhost:5173"];
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Email
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// Audit
builder.Services.AddScoped<IAuditService, AuditService>();

// Exception handling
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

// Seed data
if (args.Contains("--seed"))
{
    await ApplicationDbContextSeed.SeedAsync(app.Services);
    return;
}

// Middleware pipeline
app.UseExceptionHandler();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors(AppPolicies.AllowWebApp);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseFastEndpoints();
app.UseSwaggerGen();

app.Run();
