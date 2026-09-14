using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SplitClientNutritionTargets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create the child table FIRST, while the source columns still exist on
            // client_onboarding_data, so the backfill below has both sides available.
            migrationBuilder.CreateTable(
                name: "client_nutrition_targets",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_onboarding_data_id = table.Column<long>(type: "bigint", nullable: false),
                    derived_activity_level = table.Column<int>(type: "integer", nullable: false),
                    derived_nutrition_goal = table.Column<int>(type: "integer", nullable: false),
                    bmr = table.Column<decimal>(type: "numeric", nullable: false),
                    tdee = table.Column<decimal>(type: "numeric", nullable: false),
                    adjusted_kcal = table.Column<decimal>(type: "numeric", nullable: false),
                    protein_grams = table.Column<decimal>(type: "numeric", nullable: false),
                    carbs_grams = table.Column<decimal>(type: "numeric", nullable: false),
                    fat_grams = table.Column<decimal>(type: "numeric", nullable: false),
                    meal_distribution = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_nutrition_targets", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_nutrition_targets_client_onboarding_data_client_onbo",
                        column: x => x.client_onboarding_data_id,
                        principalTable: "client_onboarding_data",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_nutrition_targets_client_onboarding_data_id",
                table: "client_nutrition_targets",
                column: "client_onboarding_data_id",
                unique: true);

            // Backfill: one child row per existing parent row, no WHERE clause. fiber_grams
            // is intentionally NOT copied — every row holds the same unused default (0) that
            // migration 20260331202837_AddFiberToOnboardingData assigned, and it never had a
            // reader on the wire.
            migrationBuilder.Sql(
                """
                INSERT INTO client_nutrition_targets
                    (client_onboarding_data_id, derived_activity_level, derived_nutrition_goal,
                     bmr, tdee, adjusted_kcal, protein_grams, carbs_grams, fat_grams,
                     meal_distribution, date_created, date_updated)
                SELECT id, derived_activity_level, derived_nutrition_goal,
                       bmr, tdee, adjusted_kcal, protein_grams, carbs_grams, fat_grams,
                       meal_distribution, date_created, date_updated
                FROM client_onboarding_data;
                """);

            migrationBuilder.DropColumn(
                name: "adjusted_kcal",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "bmr",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "carbs_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "derived_activity_level",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "derived_nutrition_goal",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "fat_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "fiber_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "meal_distribution",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "protein_grams",
                table: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "tdee",
                table: "client_onboarding_data");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "adjusted_kcal",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "bmr",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "carbs_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "derived_activity_level",
                table: "client_onboarding_data",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "derived_nutrition_goal",
                table: "client_onboarding_data",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "fat_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "fiber_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "meal_distribution",
                table: "client_onboarding_data",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "protein_grams",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "tdee",
                table: "client_onboarding_data",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            // Restore the pre-split values from the child table before dropping it.
            // fiber_grams has no source (see the Up() note) and keeps the default above.
            migrationBuilder.Sql(
                """
                UPDATE client_onboarding_data od
                SET derived_activity_level = t.derived_activity_level,
                    derived_nutrition_goal = t.derived_nutrition_goal,
                    bmr = t.bmr,
                    tdee = t.tdee,
                    adjusted_kcal = t.adjusted_kcal,
                    protein_grams = t.protein_grams,
                    carbs_grams = t.carbs_grams,
                    fat_grams = t.fat_grams,
                    meal_distribution = t.meal_distribution
                FROM client_nutrition_targets t
                WHERE t.client_onboarding_data_id = od.id;
                """);

            migrationBuilder.DropTable(
                name: "client_nutrition_targets");
        }
    }
}
