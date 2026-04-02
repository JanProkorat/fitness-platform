using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "accept_new_clients",
                table: "professional_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "certificates",
                table: "professional_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "professional_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "collaboration_type",
                table: "professional_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "estimated_price",
                table: "professional_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "instagram",
                table: "professional_profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "languages",
                table: "professional_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "linked_in",
                table: "professional_profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "max_clients",
                table: "professional_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "show_in_search",
                table: "professional_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "specializations",
                table: "professional_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "website",
                table: "professional_profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "accept_new_clients",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "certificates",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "city",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "collaboration_type",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "estimated_price",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "instagram",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "languages",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "linked_in",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "max_clients",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "show_in_search",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "specializations",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "website",
                table: "professional_profiles");
        }
    }
}
