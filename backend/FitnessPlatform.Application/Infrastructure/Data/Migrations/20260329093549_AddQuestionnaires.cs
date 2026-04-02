using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionnaires : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "injuries",
                table: "client_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "questionnaires",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_questionnaires", x => x.id);
                    table.ForeignKey(
                        name: "fk_questionnaires_users_professional_id",
                        column: x => x.professional_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "questionnaire_questions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: false),
                    order_index = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    label = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    helper_text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_required = table.Column<bool>(type: "boolean", nullable: false),
                    is_hidden = table.Column<bool>(type: "boolean", nullable: false),
                    config = table.Column<string>(type: "text", nullable: true),
                    mapped_field = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_questionnaire_questions", x => x.id);
                    table.ForeignKey(
                        name: "fk_questionnaire_questions_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "questionnaire_responses",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: false),
                    link_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_questionnaire_responses", x => x.id);
                    table.ForeignKey(
                        name: "fk_questionnaire_responses_client_professional_links_link_id",
                        column: x => x.link_id,
                        principalTable: "client_professional_links",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_questionnaire_responses_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "questionnaire_answers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    response_id = table.Column<long>(type: "bigint", nullable: false),
                    question_id = table.Column<long>(type: "bigint", nullable: false),
                    value_text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    value_number = table.Column<decimal>(type: "numeric", nullable: true),
                    value_json = table.Column<string>(type: "text", nullable: true),
                    file_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_questionnaire_answers", x => x.id);
                    table.ForeignKey(
                        name: "fk_questionnaire_answers_questionnaire_questions_question_id",
                        column: x => x.question_id,
                        principalTable: "questionnaire_questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_questionnaire_answers_questionnaire_responses_response_id",
                        column: x => x.response_id,
                        principalTable: "questionnaire_responses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_answers_public_id",
                table: "questionnaire_answers",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_answers_question_id",
                table: "questionnaire_answers",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_answers_response_id",
                table: "questionnaire_answers",
                column: "response_id");

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_questions_public_id",
                table: "questionnaire_questions",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_questions_questionnaire_id",
                table: "questionnaire_questions",
                column: "questionnaire_id");

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_responses_link_id",
                table: "questionnaire_responses",
                column: "link_id");

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_responses_public_id",
                table: "questionnaire_responses",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_questionnaire_responses_questionnaire_id",
                table: "questionnaire_responses",
                column: "questionnaire_id");

            migrationBuilder.CreateIndex(
                name: "ix_questionnaires_professional_id",
                table: "questionnaires",
                column: "professional_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_questionnaires_public_id",
                table: "questionnaires",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "questionnaire_answers");

            migrationBuilder.DropTable(
                name: "questionnaire_questions");

            migrationBuilder.DropTable(
                name: "questionnaire_responses");

            migrationBuilder.DropTable(
                name: "questionnaires");

            migrationBuilder.DropColumn(
                name: "injuries",
                table: "client_profiles");
        }
    }
}
