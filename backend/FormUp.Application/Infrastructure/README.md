Command to update database on dev supabase:

POSTGRES_PASSWORD='F!tn3ss-Platf0rmDev' ASPNETCORE_ENVIRONMENT=Development \
dotnet ef database update \
--startup-project ../FormUp.Application.csproj \
--context ApplicationDbContext