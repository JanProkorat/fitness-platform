using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FormUp.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropWeeklyCheckInTablesAndAddEnabledAtUtc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "weekly_check_in_client_overrides");

            migrationBuilder.DropTable(
                name: "weekly_check_in_settings");

            migrationBuilder.DropTable(
                name: "weekly_check_ins");

            migrationBuilder.AddColumn<DateTime>(
                name: "enabled_at_utc",
                table: "automation_rules",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "enabled_at_utc",
                table: "automation_client_overrides",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "enabled_at_utc",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "enabled_at_utc",
                table: "automation_client_overrides");

            migrationBuilder.CreateTable(
                name: "weekly_check_in_client_overrides",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    addendum = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: true),
                    deadline_offset_hours = table.Column<int>(type: "integer", nullable: true),
                    enabled = table.Column<bool>(type: "boolean", nullable: true),
                    profession = table.Column<string>(type: "text", nullable: false),
                    time_of_day = table.Column<TimeSpan>(type: "interval", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weekly_check_in_client_overrides", x => x.id);
                    table.ForeignKey(
                        name: "fk_weekly_check_in_client_overrides_users_client_user_id",
                        column: x => x.client_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_weekly_check_in_client_overrides_users_professional_user_id",
                        column: x => x.professional_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weekly_check_in_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    deadline_offset_hours = table.Column<int>(type: "integer", nullable: false, defaultValue: 72),
                    default_addendum = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    profession = table.Column<string>(type: "text", nullable: false),
                    time_of_day = table.Column<TimeSpan>(type: "interval", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weekly_check_in_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_weekly_check_in_settings_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weekly_check_ins",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    dismissed_by_client_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    due_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    expired_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    flags = table.Column<string>(type: "jsonb", nullable: false),
                    hunger_score = table.Column<int>(type: "integer", nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    profession = table.Column<string>(type: "text", nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by_trainer_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false, defaultValue: "Pending"),
                    week_start_date = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weekly_check_ins", x => x.id);
                    table.ForeignKey(
                        name: "fk_weekly_check_ins_users_client_user_id",
                        column: x => x.client_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_weekly_check_ins_users_professional_user_id",
                        column: x => x.professional_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_weekly_check_in_client_overrides_client_user_id_professiona",
                table: "weekly_check_in_client_overrides",
                columns: new[] { "client_user_id", "professional_user_id", "profession" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_weekly_check_in_client_overrides_professional_user_id",
                table: "weekly_check_in_client_overrides",
                column: "professional_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_weekly_check_in_settings_user_id_profession",
                table: "weekly_check_in_settings",
                columns: new[] { "user_id", "profession" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_weekly_check_ins_client_user_id_professional_user_id_profes",
                table: "weekly_check_ins",
                columns: new[] { "client_user_id", "professional_user_id", "profession", "week_start_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_weekly_check_ins_professional_user_id",
                table: "weekly_check_ins",
                column: "professional_user_id");
        }
    }
}
