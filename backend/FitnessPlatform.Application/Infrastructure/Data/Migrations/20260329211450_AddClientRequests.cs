using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClientRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "client_requests",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_requests_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_requests_professional_profiles_professional_profile_",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_requests_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_client_profile_id",
                table: "client_requests",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_professional_profile_id",
                table: "client_requests",
                column: "professional_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_public_id",
                table: "client_requests",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_requests_questionnaire_id",
                table: "client_requests",
                column: "questionnaire_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_requests");
        }
    }
}
