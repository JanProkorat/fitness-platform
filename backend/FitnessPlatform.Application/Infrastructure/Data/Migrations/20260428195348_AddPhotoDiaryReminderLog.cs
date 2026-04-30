using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoDiaryReminderLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "photo_diary_reminder_logs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    diary_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_photo_diary_reminder_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_photo_diary_reminder_logs_photo_diary_requests_diary_reques",
                        column: x => x.diary_request_id,
                        principalTable: "photo_diary_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_photo_diary_reminder_logs_request_date",
                table: "photo_diary_reminder_logs",
                columns: new[] { "diary_request_id", "client_local_date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "photo_diary_reminder_logs");
        }
    }
}
