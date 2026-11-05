using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FormUp.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSkipOnboardingFormToInvitesRequestsAndLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "skip_onboarding_form",
                table: "pending_invites",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "skip_onboarding_form",
                table: "client_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "skip_onboarding_form",
                table: "client_professional_links",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "skip_onboarding_form",
                table: "pending_invites");

            migrationBuilder.DropColumn(
                name: "skip_onboarding_form",
                table: "client_requests");

            migrationBuilder.DropColumn(
                name: "skip_onboarding_form",
                table: "client_professional_links");
        }
    }
}
