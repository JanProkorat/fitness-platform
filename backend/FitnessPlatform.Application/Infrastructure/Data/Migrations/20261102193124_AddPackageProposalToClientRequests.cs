using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPackageProposalToClientRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "proposed_at",
                table: "client_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "proposed_discount_id",
                table: "client_requests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "proposed_package_id",
                table: "client_requests",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_proposed_discount_id",
                table: "client_requests",
                column: "proposed_discount_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_proposed_package_id",
                table: "client_requests",
                column: "proposed_package_id");

            migrationBuilder.AddForeignKey(
                name: "fk_client_requests_coach_discounts_proposed_discount_id",
                table: "client_requests",
                column: "proposed_discount_id",
                principalTable: "coach_discounts",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_client_requests_coach_packages_proposed_package_id",
                table: "client_requests",
                column: "proposed_package_id",
                principalTable: "coach_packages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_client_requests_coach_discounts_proposed_discount_id",
                table: "client_requests");

            migrationBuilder.DropForeignKey(
                name: "fk_client_requests_coach_packages_proposed_package_id",
                table: "client_requests");

            migrationBuilder.DropIndex(
                name: "ix_client_requests_proposed_discount_id",
                table: "client_requests");

            migrationBuilder.DropIndex(
                name: "ix_client_requests_proposed_package_id",
                table: "client_requests");

            migrationBuilder.DropColumn(
                name: "proposed_at",
                table: "client_requests");

            migrationBuilder.DropColumn(
                name: "proposed_discount_id",
                table: "client_requests");

            migrationBuilder.DropColumn(
                name: "proposed_package_id",
                table: "client_requests");
        }
    }
}
