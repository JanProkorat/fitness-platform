namespace FitnessPlatform.Application.Infrastructure.Data;

/// <summary>
/// Factory for building connection strings.
/// </summary>
public static class ConnectionStringFactory
{
    /// <summary>
    /// Builds a connection string for PostgreSQL.
    /// </summary>
    /// <param name="config"></param>
    /// <returns></returns>
    /// <exception cref="InvalidOperationException"></exception>
    public static string BuildPostgres(IConfiguration config)
    {
        var conn = config.GetConnectionString("PostgreSQl")
                   ?? throw new InvalidOperationException("Connection string not found");

        var password = config["POSTGRES_PASSWORD"]
                       ?? throw new InvalidOperationException("POSTGRES_PASSWORD not set");

        return conn + $";Password={password}";
    }
    
    /// <summary>
    /// Builds a connection string for MongoDB.
    /// </summary>
    /// <param name="config"></param>
    /// <returns></returns>
    /// <exception cref="InvalidOperationException"></exception>
    public static string BuildMongo(IConfiguration config)
    {
        var conn = config.GetConnectionString("MongoDB")
                   ?? throw new InvalidOperationException("MongoDB connection string not found");

        var password = config["MONGO_PASSWORD"]
                       ?? throw new InvalidOperationException("MONGO_PASSWORD not set");

        return conn.Contains("{0}") ? string.Format(conn, password) : conn;
    }
}