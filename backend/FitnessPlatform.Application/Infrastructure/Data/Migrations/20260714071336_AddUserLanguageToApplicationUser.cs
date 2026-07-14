using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserLanguageToApplicationUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "language",
                table: "users",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "language",
                table: "users");
        }
    }
}
