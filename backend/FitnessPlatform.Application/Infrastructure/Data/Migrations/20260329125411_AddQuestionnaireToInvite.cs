using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionnaireToInvite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "questionnaire_id",
                table: "pending_invites",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_pending_invites_questionnaire_id",
                table: "pending_invites",
                column: "questionnaire_id");

            migrationBuilder.AddForeignKey(
                name: "fk_pending_invites_questionnaires_questionnaire_id",
                table: "pending_invites",
                column: "questionnaire_id",
                principalTable: "questionnaires",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_pending_invites_questionnaires_questionnaire_id",
                table: "pending_invites");

            migrationBuilder.DropIndex(
                name: "ix_pending_invites_questionnaire_id",
                table: "pending_invites");

            migrationBuilder.DropColumn(
                name: "questionnaire_id",
                table: "pending_invites");
        }
    }
}
