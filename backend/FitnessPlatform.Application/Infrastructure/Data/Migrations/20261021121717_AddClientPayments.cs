using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClientPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "client_payment_assignments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    client_number = table.Column<int>(type: "integer", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_payment_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_payment_assignments_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_payment_assignments_professional_profiles_profession",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_payment_terms",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_payment_assignment_id = table.Column<long>(type: "bigint", nullable: false),
                    coach_package_id = table.Column<long>(type: "bigint", nullable: false),
                    coach_discount_id = table.Column<long>(type: "bigint", nullable: true),
                    custom_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    effective_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_payment_terms", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_payment_terms_client_payment_assignments_client_paym",
                        column: x => x.client_payment_assignment_id,
                        principalTable: "client_payment_assignments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_payment_terms_coach_discounts_coach_discount_id",
                        column: x => x.coach_discount_id,
                        principalTable: "coach_discounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_client_payment_terms_coach_packages_coach_package_id",
                        column: x => x.coach_package_id,
                        principalTable: "coach_packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "client_payments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_payment_assignment_id = table.Column<long>(type: "bigint", nullable: false),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    period_start = table.Column<DateOnly>(type: "date", nullable: true),
                    period_end = table.Column<DateOnly>(type: "date", nullable: true),
                    due_date = table.Column<DateOnly>(type: "date", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    variable_symbol = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    message = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    requested_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    paid_on = table.Column<DateOnly>(type: "date", nullable: true),
                    waive_reason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    package_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    base_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    discount_label = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    account_iban = table.Column<string>(type: "character varying(34)", maxLength: 34, nullable: true),
                    account_holder = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_payments", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_payments_client_payment_assignments_client_payment_a",
                        column: x => x.client_payment_assignment_id,
                        principalTable: "client_payment_assignments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_entity_id",
                table: "audit_logs",
                column: "entity_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_assignments_client_profile_id",
                table: "client_payment_assignments",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_assignments_professional_profile_id_client_n",
                table: "client_payment_assignments",
                columns: new[] { "professional_profile_id", "client_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_assignments_professional_profile_id_client_p",
                table: "client_payment_assignments",
                columns: new[] { "professional_profile_id", "client_profile_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_assignments_public_id",
                table: "client_payment_assignments",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_terms_client_payment_assignment_id_effective",
                table: "client_payment_terms",
                columns: new[] { "client_payment_assignment_id", "effective_from_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_terms_coach_discount_id",
                table: "client_payment_terms",
                column: "coach_discount_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_payment_terms_coach_package_id",
                table: "client_payment_terms",
                column: "coach_package_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_payments_client_payment_assignment_id_due_date",
                table: "client_payments",
                columns: new[] { "client_payment_assignment_id", "due_date" });

            migrationBuilder.CreateIndex(
                name: "ix_client_payments_client_payment_assignment_id_period_start",
                table: "client_payments",
                columns: new[] { "client_payment_assignment_id", "period_start" },
                unique: true,
                filter: "period_start IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_client_payments_professional_profile_id_variable_symbol",
                table: "client_payments",
                columns: new[] { "professional_profile_id", "variable_symbol" },
                unique: true,
                filter: "variable_symbol IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_client_payments_public_id",
                table: "client_payments",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_payment_terms");

            migrationBuilder.DropTable(
                name: "client_payments");

            migrationBuilder.DropTable(
                name: "client_payment_assignments");

            migrationBuilder.DropIndex(
                name: "ix_audit_logs_entity_id",
                table: "audit_logs");
        }
    }
}
