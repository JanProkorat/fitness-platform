using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoachPackagesAndDiscounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "estimated_price",
                table: "professional_profiles");

            migrationBuilder.CreateTable(
                name: "coach_discounts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    duration = table.Column<int>(type: "integer", nullable: false),
                    duration_payments = table.Column<int>(type: "integer", nullable: true),
                    valid_from = table.Column<DateOnly>(type: "date", nullable: true),
                    valid_to = table.Column<DateOnly>(type: "date", nullable: true),
                    applies_to_all_packages = table.Column<bool>(type: "boolean", nullable: false),
                    archived_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_discounts", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_discounts_professional_profiles_professional_profile_",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coach_packages",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    billing = table.Column<int>(type: "integer", nullable: false),
                    interval_weeks = table.Column<int>(type: "integer", nullable: true),
                    runs_for_payments = table.Column<int>(type: "integer", nullable: true),
                    payment_due_days_override = table.Column<int>(type: "integer", nullable: true),
                    show_on_profile = table.Column<bool>(type: "boolean", nullable: false),
                    archived_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_packages", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_packages_professional_profiles_professional_profile_id",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coach_discount_packages",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    coach_discount_id = table.Column<long>(type: "bigint", nullable: false),
                    coach_package_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_discount_packages", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_discount_packages_coach_discounts_coach_discount_id",
                        column: x => x.coach_discount_id,
                        principalTable: "coach_discounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_coach_discount_packages_coach_packages_coach_package_id",
                        column: x => x.coach_package_id,
                        principalTable: "coach_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coach_package_prices",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    coach_package_id = table.Column<long>(type: "bigint", nullable: false),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    effective_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_package_prices", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_package_prices_coach_packages_coach_package_id",
                        column: x => x.coach_package_id,
                        principalTable: "coach_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_coach_discount_packages_coach_discount_id_coach_package_id",
                table: "coach_discount_packages",
                columns: new[] { "coach_discount_id", "coach_package_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coach_discount_packages_coach_package_id",
                table: "coach_discount_packages",
                column: "coach_package_id");

            migrationBuilder.CreateIndex(
                name: "ix_coach_discounts_professional_profile_id",
                table: "coach_discounts",
                column: "professional_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_coach_discounts_public_id",
                table: "coach_discounts",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coach_package_prices_coach_package_id_effective_from_utc",
                table: "coach_package_prices",
                columns: new[] { "coach_package_id", "effective_from_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_coach_packages_professional_profile_id",
                table: "coach_packages",
                column: "professional_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_coach_packages_public_id",
                table: "coach_packages",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "coach_discount_packages");

            migrationBuilder.DropTable(
                name: "coach_package_prices");

            migrationBuilder.DropTable(
                name: "coach_discounts");

            migrationBuilder.DropTable(
                name: "coach_packages");

            migrationBuilder.AddColumn<string>(
                name: "estimated_price",
                table: "professional_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }
    }
}
