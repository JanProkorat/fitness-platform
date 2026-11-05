using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FormUp.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckInAutomationRule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "check_in_missed_notified_at_utc",
                table: "questionnaire_responses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "check_in_reminder_sent_at_utc",
                table: "questionnaire_responses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "answer_window_hours",
                table: "automation_rules",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_coach_on_missed_week",
                table: "automation_rules",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "reminder_after_hours",
                table: "automation_rules",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "schedule_weekday",
                table: "automation_rules",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "answer_window_hours",
                table: "automation_client_overrides",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_coach_on_missed_week",
                table: "automation_client_overrides",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "reminder_after_hours",
                table: "automation_client_overrides",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "schedule_weekday",
                table: "automation_client_overrides",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "check_in_missed_notified_at_utc",
                table: "questionnaire_responses");

            migrationBuilder.DropColumn(
                name: "check_in_reminder_sent_at_utc",
                table: "questionnaire_responses");

            migrationBuilder.DropColumn(
                name: "answer_window_hours",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "notify_coach_on_missed_week",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "reminder_after_hours",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "schedule_weekday",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "answer_window_hours",
                table: "automation_client_overrides");

            migrationBuilder.DropColumn(
                name: "notify_coach_on_missed_week",
                table: "automation_client_overrides");

            migrationBuilder.DropColumn(
                name: "reminder_after_hours",
                table: "automation_client_overrides");

            migrationBuilder.DropColumn(
                name: "schedule_weekday",
                table: "automation_client_overrides");
        }
    }
}
