using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameToProfessionalProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_invitation_tokens_trainer_profiles_trainer_profile_id",
                table: "invitation_tokens");

            migrationBuilder.DropTable(
                name: "client_trainer_links");

            migrationBuilder.DropTable(
                name: "trainer_profiles");

            migrationBuilder.RenameColumn(
                name: "trainer_profile_id",
                table: "invitation_tokens",
                newName: "professional_profile_id");

            migrationBuilder.RenameIndex(
                name: "ix_invitation_tokens_trainer_profile_id",
                table: "invitation_tokens",
                newName: "ix_invitation_tokens_professional_profile_id");

            migrationBuilder.CreateTable(
                name: "professional_profiles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bio = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    specialization = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_professional_profiles", x => x.id);
                    table.ForeignKey(
                        name: "fk_professional_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_professional_links",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    professional_role = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_professional_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_professional_links_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_professional_links_professional_profiles_professiona",
                        column: x => x.professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_professional_links_client_profile_id_professional_pr",
                table: "client_professional_links",
                columns: new[] { "client_profile_id", "professional_profile_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_professional_links_professional_profile_id",
                table: "client_professional_links",
                column: "professional_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_professional_links_public_id",
                table: "client_professional_links",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_professional_profiles_public_id",
                table: "professional_profiles",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_professional_profiles_user_id",
                table: "professional_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_invitation_tokens_professional_profiles_professional_profil",
                table: "invitation_tokens",
                column: "professional_profile_id",
                principalTable: "professional_profiles",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_invitation_tokens_professional_profiles_professional_profil",
                table: "invitation_tokens");

            migrationBuilder.DropTable(
                name: "client_professional_links");

            migrationBuilder.DropTable(
                name: "professional_profiles");

            migrationBuilder.RenameColumn(
                name: "professional_profile_id",
                table: "invitation_tokens",
                newName: "trainer_profile_id");

            migrationBuilder.RenameIndex(
                name: "ix_invitation_tokens_professional_profile_id",
                table: "invitation_tokens",
                newName: "ix_invitation_tokens_trainer_profile_id");

            migrationBuilder.CreateTable(
                name: "trainer_profiles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bio = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specialization = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_trainer_profiles", x => x.id);
                    table.ForeignKey(
                        name: "fk_trainer_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_trainer_links",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    trainer_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trainer_role = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_trainer_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_trainer_links_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_trainer_links_trainer_profiles_trainer_profile_id",
                        column: x => x.trainer_profile_id,
                        principalTable: "trainer_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_trainer_links_client_profile_id_trainer_profile_id",
                table: "client_trainer_links",
                columns: new[] { "client_profile_id", "trainer_profile_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_trainer_links_public_id",
                table: "client_trainer_links",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_trainer_links_trainer_profile_id",
                table: "client_trainer_links",
                column: "trainer_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_trainer_profiles_public_id",
                table: "trainer_profiles",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_trainer_profiles_user_id",
                table: "trainer_profiles",
                column: "user_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_invitation_tokens_trainer_profiles_trainer_profile_id",
                table: "invitation_tokens",
                column: "trainer_profile_id",
                principalTable: "trainer_profiles",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
