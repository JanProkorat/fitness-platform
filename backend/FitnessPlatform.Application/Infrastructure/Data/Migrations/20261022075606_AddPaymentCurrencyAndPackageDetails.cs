using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentCurrencyAndPackageDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "profile_currency",
                table: "coach_payment_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "currency",
                table: "coach_packages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "coach_packages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "currency",
                table: "coach_discounts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "scope",
                table: "coach_discounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "currency",
                table: "client_payments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Scope: 0 = all packages, 1 = selected packages (the old false flag).
            migrationBuilder.Sql("UPDATE coach_discounts SET scope = 1 WHERE applies_to_all_packages = FALSE;");

            migrationBuilder.DropColumn(
                name: "applies_to_all_packages",
                table: "coach_discounts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "applies_to_all_packages",
                table: "coach_discounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("UPDATE coach_discounts SET applies_to_all_packages = (scope <> 1);");

            migrationBuilder.DropColumn(
                name: "profile_currency",
                table: "coach_payment_settings");

            migrationBuilder.DropColumn(
                name: "currency",
                table: "coach_packages");

            migrationBuilder.DropColumn(
                name: "description",
                table: "coach_packages");

            migrationBuilder.DropColumn(
                name: "currency",
                table: "coach_discounts");

            migrationBuilder.DropColumn(
                name: "scope",
                table: "coach_discounts");

            migrationBuilder.DropColumn(
                name: "currency",
                table: "client_payments");
        }
    }
}
