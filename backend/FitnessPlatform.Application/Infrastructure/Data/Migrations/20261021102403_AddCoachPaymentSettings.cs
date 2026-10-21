using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoachPaymentSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "can_use_payments",
                table: "subscription_plans",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "coach_bank_account_changes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    previous_iban = table.Column<string>(type: "character varying(34)", maxLength: 34, nullable: true),
                    previous_account_holder = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    new_iban = table.Column<string>(type: "character varying(34)", maxLength: 34, nullable: false),
                    new_account_holder = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    undo_token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    undo_expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    undone_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_bank_account_changes", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_bank_account_changes_professional_profiles_profession",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coach_payment_settings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    iban = table.Column<string>(type: "character varying(34)", maxLength: 34, nullable: true),
                    account_holder = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    payment_due_days = table.Column<int>(type: "integer", nullable: false, defaultValue: 7),
                    message_format = table.Column<int>(type: "integer", nullable: false),
                    variable_symbol_format = table.Column<int>(type: "integer", nullable: false),
                    bank_account_changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_payment_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_payment_settings_professional_profiles_professional_p",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "coach_reauth_codes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    failed_attempts = table.Column<int>(type: "integer", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_reauth_codes", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_reauth_codes_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_coach_bank_account_changes_professional_profile_id",
                table: "coach_bank_account_changes",
                column: "professional_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_coach_bank_account_changes_undo_token_hash",
                table: "coach_bank_account_changes",
                column: "undo_token_hash",
                unique: true,
                filter: "undo_token_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_coach_payment_settings_professional_profile_id",
                table: "coach_payment_settings",
                column: "professional_profile_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coach_payment_settings_public_id",
                table: "coach_payment_settings",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coach_reauth_codes_user_id_expires_at",
                table: "coach_reauth_codes",
                columns: new[] { "user_id", "expires_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "coach_bank_account_changes");

            migrationBuilder.DropTable(
                name: "coach_payment_settings");

            migrationBuilder.DropTable(
                name: "coach_reauth_codes");

            migrationBuilder.DropColumn(
                name: "can_use_payments",
                table: "subscription_plans");
        }
    }
}
