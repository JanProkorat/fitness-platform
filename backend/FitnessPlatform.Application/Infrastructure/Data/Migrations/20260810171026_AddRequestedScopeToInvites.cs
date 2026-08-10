using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRequestedScopeToInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "requested_scope",
                table: "pending_invites",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "requested_scope",
                table: "invitation_tokens",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "requested_scope",
                table: "pending_invites");

            migrationBuilder.DropColumn(
                name: "requested_scope",
                table: "invitation_tokens");
        }
    }
}
