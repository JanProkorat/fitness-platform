using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class PendingInviteStatusCoachFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "status",
                table: "pending_invites",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Pending = 0 (column default), Accepted = 1. A previously declined invite also had
            // is_accepted = true and cannot be told apart, so it reads as Accepted.
            migrationBuilder.Sql("UPDATE pending_invites SET status = 1 WHERE is_accepted;");

            migrationBuilder.DropColumn(
                name: "is_accepted",
                table: "pending_invites");

            migrationBuilder.AddColumn<bool>(
                name: "online",
                table: "professional_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "share_history",
                table: "client_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "online",
                table: "professional_profiles");

            migrationBuilder.DropColumn(
                name: "share_history",
                table: "client_requests");

            migrationBuilder.AddColumn<bool>(
                name: "is_accepted",
                table: "pending_invites",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Accepted (1) and Declined (2) were both stored as is_accepted = true.
            migrationBuilder.Sql("UPDATE pending_invites SET is_accepted = true WHERE status IN (1, 2);");

            migrationBuilder.DropColumn(
                name: "status",
                table: "pending_invites");
        }
    }
}
