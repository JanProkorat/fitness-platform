using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInvitePackageTerms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "coach_discount_id",
                table: "pending_invites",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "coach_package_id",
                table: "pending_invites",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_pending_invites_coach_discount_id",
                table: "pending_invites",
                column: "coach_discount_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_invites_coach_package_id",
                table: "pending_invites",
                column: "coach_package_id");

            migrationBuilder.AddForeignKey(
                name: "fk_pending_invites_coach_discounts_coach_discount_id",
                table: "pending_invites",
                column: "coach_discount_id",
                principalTable: "coach_discounts",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_pending_invites_coach_packages_coach_package_id",
                table: "pending_invites",
                column: "coach_package_id",
                principalTable: "coach_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_pending_invites_coach_discounts_coach_discount_id",
                table: "pending_invites");

            migrationBuilder.DropForeignKey(
                name: "fk_pending_invites_coach_packages_coach_package_id",
                table: "pending_invites");

            migrationBuilder.DropIndex(
                name: "ix_pending_invites_coach_discount_id",
                table: "pending_invites");

            migrationBuilder.DropIndex(
                name: "ix_pending_invites_coach_package_id",
                table: "pending_invites");

            migrationBuilder.DropColumn(
                name: "coach_discount_id",
                table: "pending_invites");

            migrationBuilder.DropColumn(
                name: "coach_package_id",
                table: "pending_invites");
        }
    }
}
