using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AllowMultipleQuestionnaires : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_questionnaires_professional_id",
                table: "questionnaires");

            migrationBuilder.AddColumn<bool>(
                name: "is_default",
                table: "questionnaires",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "questionnaire_id",
                table: "client_professional_links",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_questionnaires_professional_id",
                table: "questionnaires",
                column: "professional_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_professional_links_questionnaire_id",
                table: "client_professional_links",
                column: "questionnaire_id");

            migrationBuilder.AddForeignKey(
                name: "fk_client_professional_links_questionnaires_questionnaire_id",
                table: "client_professional_links",
                column: "questionnaire_id",
                principalTable: "questionnaires",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_client_professional_links_questionnaires_questionnaire_id",
                table: "client_professional_links");

            migrationBuilder.DropIndex(
                name: "ix_questionnaires_professional_id",
                table: "questionnaires");

            migrationBuilder.DropIndex(
                name: "ix_client_professional_links_questionnaire_id",
                table: "client_professional_links");

            migrationBuilder.DropColumn(
                name: "is_default",
                table: "questionnaires");

            migrationBuilder.DropColumn(
                name: "questionnaire_id",
                table: "client_professional_links");

            migrationBuilder.CreateIndex(
                name: "ix_questionnaires_professional_id",
                table: "questionnaires",
                column: "professional_id",
                unique: true);
        }
    }
}
