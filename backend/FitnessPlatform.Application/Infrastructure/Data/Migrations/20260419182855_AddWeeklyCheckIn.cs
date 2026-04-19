using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWeeklyCheckIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "weekly_check_ins",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    profession = table.Column<string>(type: "text", nullable: false),
                    week_start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    flags = table.Column<string>(type: "jsonb", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    dismissed_by_client_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by_trainer_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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
                name: "ix_weekly_check_ins_client_user_id_professional_user_id_profes",
                table: "weekly_check_ins",
                columns: new[] { "client_user_id", "professional_user_id", "profession", "week_start_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_weekly_check_ins_professional_user_id",
                table: "weekly_check_ins",
                column: "professional_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "weekly_check_ins");
        }
    }
}
