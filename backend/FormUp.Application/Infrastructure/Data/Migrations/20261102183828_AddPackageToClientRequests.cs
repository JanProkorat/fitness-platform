using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FormUp.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPackageToClientRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "coach_discount_id",
                table: "client_requests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "coach_package_id",
                table: "client_requests",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_coach_discount_id",
                table: "client_requests",
                column: "coach_discount_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_coach_package_id",
                table: "client_requests",
                column: "coach_package_id");

            migrationBuilder.AddForeignKey(
                name: "fk_client_requests_coach_discounts_coach_discount_id",
                table: "client_requests",
                column: "coach_discount_id",
                principalTable: "coach_discounts",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_client_requests_coach_packages_coach_package_id",
                table: "client_requests",
                column: "coach_package_id",
                principalTable: "coach_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_client_requests_coach_discounts_coach_discount_id",
                table: "client_requests");

            migrationBuilder.DropForeignKey(
                name: "fk_client_requests_coach_packages_coach_package_id",
                table: "client_requests");

            migrationBuilder.DropIndex(
                name: "ix_client_requests_coach_discount_id",
                table: "client_requests");

            migrationBuilder.DropIndex(
                name: "ix_client_requests_coach_package_id",
                table: "client_requests");

            migrationBuilder.DropColumn(
                name: "coach_discount_id",
                table: "client_requests");

            migrationBuilder.DropColumn(
                name: "coach_package_id",
                table: "client_requests");
        }
    }
}
