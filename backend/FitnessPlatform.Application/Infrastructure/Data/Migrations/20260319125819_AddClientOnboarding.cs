using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClientOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_onboarding_complete",
                table: "client_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "client_onboarding_data",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    date_of_birth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    sex = table.Column<int>(type: "integer", nullable: false),
                    height_cm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: false),
                    weight_kg = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    target_weight_kg = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    body_type = table.Column<int>(type: "integer", nullable: false),
                    primary_goal = table.Column<int>(type: "integer", nullable: false),
                    time_horizon = table.Column<int>(type: "integer", nullable: false),
                    job_type = table.Column<int>(type: "integer", nullable: false),
                    sleep_hours = table.Column<int>(type: "integer", nullable: false),
                    stress_level = table.Column<int>(type: "integer", nullable: false),
                    current_training_frequency = table.Column<int>(type: "integer", nullable: false),
                    desired_training_frequency = table.Column<int>(type: "integer", nullable: false),
                    fitness_rating = table.Column<int>(type: "integer", nullable: false),
                    gym_access = table.Column<int>(type: "integer", nullable: false),
                    preferred_activities = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    injuries = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    meals_per_day = table.Column<int>(type: "integer", nullable: false),
                    dietary_style = table.Column<int>(type: "integer", nullable: false),
                    allergies = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    diet_rating = table.Column<int>(type: "integer", nullable: false),
                    plan_experience = table.Column<int>(type: "integer", nullable: false),
                    past_blockers = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    primary_motivation = table.Column<int>(type: "integer", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_onboarding_data", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_onboarding_data_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_onboarding_data_client_profile_id",
                table: "client_onboarding_data",
                column: "client_profile_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_onboarding_data");

            migrationBuilder.DropColumn(
                name: "is_onboarding_complete",
                table: "client_profiles");
        }
    }
}
