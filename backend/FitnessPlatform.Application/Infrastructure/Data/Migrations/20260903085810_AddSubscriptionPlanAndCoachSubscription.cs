using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionPlanAndCoachSubscription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subscription_plans",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<string>(type: "text", nullable: false),
                    name_cs = table.Column<string>(type: "text", nullable: false),
                    name_en = table.Column<string>(type: "text", nullable: false),
                    name_de = table.Column<string>(type: "text", nullable: false),
                    applicable_roles = table.Column<int>(type: "integer", nullable: false),
                    can_create_plans = table.Column<bool>(type: "boolean", nullable: false),
                    can_message = table.Column<bool>(type: "boolean", nullable: false),
                    can_send_questionnaires = table.Column<bool>(type: "boolean", nullable: false),
                    can_use_weekly_check_ins = table.Column<bool>(type: "boolean", nullable: false),
                    can_use_per_client_check_in_config = table.Column<bool>(type: "boolean", nullable: false),
                    max_active_clients = table.Column<int>(type: "integer", nullable: true),
                    price_minor_units = table.Column<long>(type: "bigint", nullable: false),
                    currency = table.Column<string>(type: "text", nullable: false),
                    billing_interval = table.Column<int>(type: "integer", nullable: false),
                    external_price_id = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_subscription_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "coach_subscriptions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    subscription_plan_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    trial_ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    current_period_ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    external_customer_id = table.Column<string>(type: "text", nullable: true),
                    external_subscription_id = table.Column<string>(type: "text", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coach_subscriptions", x => x.id);
                    table.ForeignKey(
                        name: "fk_coach_subscriptions_professional_profiles_professional_prof",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_coach_subscriptions_subscription_plans_subscription_plan_id",
                        column: x => x.subscription_plan_id,
                        principalTable: "subscription_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_coach_subscriptions_professional_profile_id",
                table: "coach_subscriptions",
                column: "professional_profile_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coach_subscriptions_subscription_plan_id",
                table: "coach_subscriptions",
                column: "subscription_plan_id");

            migrationBuilder.CreateIndex(
                name: "ix_subscription_plans_code",
                table: "subscription_plans",
                column: "code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "coach_subscriptions");

            migrationBuilder.DropTable(
                name: "subscription_plans");
        }
    }
}
