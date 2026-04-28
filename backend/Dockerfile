# ---- build stage ----
# SDK pinned to match backend/global.json — the rolling :10.0 tag advances
# past the pinned feature band and breaks restore inside the container.
FROM mcr.microsoft.com/dotnet/sdk:10.0.103 AS build
WORKDIR /src

# Restore dependencies first (cache-friendly layer)
COPY FitnessPlatform.Application/FitnessPlatform.Application.csproj FitnessPlatform.Application/
RUN dotnet restore FitnessPlatform.Application/FitnessPlatform.Application.csproj

# Copy everything else and publish
COPY . .
RUN dotnet publish FitnessPlatform.Application/FitnessPlatform.Application.csproj \
    -c Release \
    -o /app \
    /p:UseAppHost=false

# Generate the ASP.NET Core dev HTTPS cert so the runtime image can serve
# https://localhost:5001 — qa-tester probes that URL and the web Vite proxy
# targets it as well. Password is dev-only; never reused outside the e2e stack.
RUN mkdir -p /https && dotnet dev-certs https -ep /https/aspnetapp.pfx -p devcert

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl is needed for the compose healthcheck — the slim aspnet image
# ships neither curl nor wget. Cleaned up in the same RUN to keep the
# image lean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy published output + dev cert
COPY --from=build /app .
COPY --from=build /https/aspnetapp.pfx /https/aspnetapp.pfx

EXPOSE 8080

ENTRYPOINT ["dotnet", "FitnessPlatform.Application.dll"]
