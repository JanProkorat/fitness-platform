using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNutritionProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "hunger_score",
                table: "weekly_check_ins",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "dislikes",
                table: "client_onboarding_data",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<List<string>>(
                name: "habits",
                table: "client_onboarding_data",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<decimal>(
                name: "fibre_grams",
                table: "client_nutrition_targets",
                type: "numeric(5,1)",
                precision: 5,
                scale: 1,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "hunger_score",
                table: "weekly_check_ins");

            migrationBuilder.DropColumn(
                name: "dislikes",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "habits",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "fibre_grams",
                table: "client_nutrition_targets");
        }
    }
}
