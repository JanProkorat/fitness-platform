using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionnaireResponseKindSeenCheckIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "check_in_due_at_utc",
                table: "questionnaire_responses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "check_in_week_start",
                table: "questionnaire_responses",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "questionnaire_responses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "reviewed_by_coach_at_utc",
                table: "questionnaire_responses",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "check_in_due_at_utc",
                table: "questionnaire_responses");

            migrationBuilder.DropColumn(
                name: "check_in_week_start",
                table: "questionnaire_responses");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "questionnaire_responses");

            migrationBuilder.DropColumn(
                name: "reviewed_by_coach_at_utc",
                table: "questionnaire_responses");
        }
    }
}
