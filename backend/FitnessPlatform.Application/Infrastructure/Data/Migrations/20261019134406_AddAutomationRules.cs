using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomationRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "automation_rules",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    action_type = table.Column<int>(type: "integer", nullable: false),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: true),
                    trigger_kind = table.Column<int>(type: "integer", nullable: false),
                    schedule_interval = table.Column<int>(type: "integer", nullable: true),
                    schedule_unit = table.Column<int>(type: "integer", nullable: true),
                    local_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    event_type = table.Column<int>(type: "integer", nullable: true),
                    event_offset_days = table.Column<int>(type: "integer", nullable: true),
                    event_offset_direction = table.Column<int>(type: "integer", nullable: true),
                    once_per_plan = table.Column<bool>(type: "boolean", nullable: false),
                    skip_while_previous_unanswered = table.Column<bool>(type: "boolean", nullable: false),
                    stop_after_sends = table.Column<int>(type: "integer", nullable: true),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    audience = table.Column<int>(type: "integer", nullable: false),
                    audience_tag_id = table.Column<long>(type: "bigint", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_rules", x => x.id);
                    table.ForeignKey(
                        name: "fk_automation_rules_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_rules_client_tags_audience_tag_id",
                        column: x => x.audience_tag_id,
                        principalTable: "client_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_automation_rules_professional_profiles_owner_professional_p",
                        column: x => x.owner_professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_rules_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "automation_client_overrides",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    automation_rule_id = table.Column<long>(type: "bigint", nullable: false),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    is_customized = table.Column<bool>(type: "boolean", nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    trigger_kind = table.Column<int>(type: "integer", nullable: false),
                    schedule_interval = table.Column<int>(type: "integer", nullable: true),
                    schedule_unit = table.Column<int>(type: "integer", nullable: true),
                    local_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    event_type = table.Column<int>(type: "integer", nullable: true),
                    event_offset_days = table.Column<int>(type: "integer", nullable: true),
                    event_offset_direction = table.Column<int>(type: "integer", nullable: true),
                    once_per_plan = table.Column<bool>(type: "boolean", nullable: false),
                    skip_while_previous_unanswered = table.Column<bool>(type: "boolean", nullable: false),
                    stop_after_sends = table.Column<int>(type: "integer", nullable: true),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    is_paused = table.Column<bool>(type: "boolean", nullable: false),
                    paused_until = table.Column<DateOnly>(type: "date", nullable: true),
                    pause_note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_client_overrides", x => x.id);
                    table.ForeignKey(
                        name: "fk_automation_client_overrides_automation_rules_automation_rul",
                        column: x => x.automation_rule_id,
                        principalTable: "automation_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_client_overrides_client_profiles_client_profile_",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "automation_rule_audience_clients",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    automation_rule_id = table.Column<long>(type: "bigint", nullable: false),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_rule_audience_clients", x => x.id);
                    table.ForeignKey(
                        name: "fk_automation_rule_audience_clients_automation_rules_automatio",
                        column: x => x.automation_rule_id,
                        principalTable: "automation_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_rule_audience_clients_client_profiles_client_pro",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "automation_runs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    automation_rule_id = table.Column<long>(type: "bigint", nullable: false),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    occurrence = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    skip_reason = table.Column<int>(type: "integer", nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    answered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_runs", x => x.id);
                    table.ForeignKey(
                        name: "fk_automation_runs_automation_rules_automation_rule_id",
                        column: x => x.automation_rule_id,
                        principalTable: "automation_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_runs_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "automation_schedules",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    automation_rule_id = table.Column<long>(type: "bigint", nullable: false),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    next_run_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    local_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    time_zone_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_schedules", x => x.id);
                    table.ForeignKey(
                        name: "fk_automation_schedules_automation_rules_automation_rule_id",
                        column: x => x.automation_rule_id,
                        principalTable: "automation_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_automation_schedules_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_automation_client_overrides_automation_rule_id_client_profi",
                table: "automation_client_overrides",
                columns: new[] { "automation_rule_id", "client_profile_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_client_overrides_client_profile_id",
                table: "automation_client_overrides",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_rule_audience_clients_automation_rule_id_client_",
                table: "automation_rule_audience_clients",
                columns: new[] { "automation_rule_id", "client_profile_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_rule_audience_clients_client_profile_id",
                table: "automation_rule_audience_clients",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_audience_tag_id",
                table: "automation_rules",
                column: "audience_tag_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_client_profile_id",
                table: "automation_rules",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_owner_professional_profile_id_client_profi",
                table: "automation_rules",
                columns: new[] { "owner_professional_profile_id", "client_profile_id" });

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_public_id",
                table: "automation_rules",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_rules_questionnaire_id",
                table: "automation_rules",
                column: "questionnaire_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_runs_automation_rule_id_client_profile_id_occurr",
                table: "automation_runs",
                columns: new[] { "automation_rule_id", "client_profile_id", "occurrence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_runs_client_profile_id_sent_at",
                table: "automation_runs",
                columns: new[] { "client_profile_id", "sent_at" });

            migrationBuilder.CreateIndex(
                name: "ix_automation_schedules_automation_rule_id_client_profile_id",
                table: "automation_schedules",
                columns: new[] { "automation_rule_id", "client_profile_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_automation_schedules_client_profile_id",
                table: "automation_schedules",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_automation_schedules_next_run_at",
                table: "automation_schedules",
                column: "next_run_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "automation_client_overrides");

            migrationBuilder.DropTable(
                name: "automation_rule_audience_clients");

            migrationBuilder.DropTable(
                name: "automation_runs");

            migrationBuilder.DropTable(
                name: "automation_schedules");

            migrationBuilder.DropTable(
                name: "automation_rules");
        }
    }
}
