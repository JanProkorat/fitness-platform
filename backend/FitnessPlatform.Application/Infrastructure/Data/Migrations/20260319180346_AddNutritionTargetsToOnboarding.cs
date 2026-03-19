using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNutritionTargetsToOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "adjusted_kcal",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "bmr",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "carbs_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "derived_activity_level",
                table: "client_onboarding_data",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "derived_nutrition_goal",
                table: "client_onboarding_data",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "fat_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "protein_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "tdee",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "adjusted_kcal",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "bmr",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "carbs_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "derived_activity_level",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "derived_nutrition_goal",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "fat_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "protein_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "tdee",
                table: "client_onboarding_data");
        }
    }
}
