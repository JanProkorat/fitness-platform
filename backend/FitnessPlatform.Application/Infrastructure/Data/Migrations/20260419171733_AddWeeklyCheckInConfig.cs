using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWeeklyCheckInConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "weekly_check_in_client_overrides",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    profession = table.Column<string>(type: "text", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: true),
                    time_of_day = table.Column<TimeSpan>(type: "interval", nullable: true),
                    enabled = table.Column<bool>(type: "boolean", nullable: true),
                    addendum = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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
                    profession = table.Column<string>(type: "text", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    time_of_day = table.Column<TimeSpan>(type: "interval", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    default_addendum = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "weekly_check_in_client_overrides");

            migrationBuilder.DropTable(
                name: "weekly_check_in_settings");
        }
    }
}
