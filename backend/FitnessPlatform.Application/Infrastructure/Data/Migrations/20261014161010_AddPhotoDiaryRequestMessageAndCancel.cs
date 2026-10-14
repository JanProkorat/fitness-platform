using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoDiaryRequestMessageAndCancel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_photo_diary_requests_accepted_at_with_accepted_status",
                table: "photo_diary_requests");

            migrationBuilder.DropCheckConstraint(
                name: "ck_photo_diary_requests_mode_with_accepted_status",
                table: "photo_diary_requests");

            migrationBuilder.AddColumn<string>(
                name: "message",
                table: "photo_diary_requests",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_photo_diary_requests_accepted_at_with_accepted_status",
                table: "photo_diary_requests",
                sql: "(status IN (2,4,5) AND accepted_at IS NOT NULL) OR (status IN (1,3) AND accepted_at IS NULL) OR (status = 6)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_photo_diary_requests_mode_with_accepted_status",
                table: "photo_diary_requests",
                sql: "(status NOT IN (2,4,5) OR mode IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_photo_diary_requests_accepted_at_with_accepted_status",
                table: "photo_diary_requests");

            migrationBuilder.DropCheckConstraint(
                name: "ck_photo_diary_requests_mode_with_accepted_status",
                table: "photo_diary_requests");

            // Cancelled (6) does not exist before this migration: turn those rows into Dismissed (3),
            // which needs accepted_at and mode NULL. completed_at is cleared too, since the
            // completed_at constraint only allows it on Completed.
            migrationBuilder.Sql(
                "UPDATE photo_diary_requests SET status = 3, accepted_at = NULL, completed_at = NULL, mode = NULL " +
                "WHERE status = 6;");

            // The old rule allows mode only on Accepted (2), InProgress (4) and Completed (5).
            migrationBuilder.Sql(
                "UPDATE photo_diary_requests SET mode = NULL WHERE status NOT IN (2, 4, 5) AND mode IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "message",
                table: "photo_diary_requests");

            migrationBuilder.AddCheckConstraint(
                name: "ck_photo_diary_requests_accepted_at_with_accepted_status",
                table: "photo_diary_requests",
                sql: "(status IN (2,4,5) AND accepted_at IS NOT NULL) OR (status NOT IN (2,4,5) AND accepted_at IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_photo_diary_requests_mode_with_accepted_status",
                table: "photo_diary_requests",
                sql: "(status IN (2,4,5) AND mode IS NOT NULL) OR (status NOT IN (2,4,5) AND mode IS NULL)");
        }
    }
}
