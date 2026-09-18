using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClientTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "client_tags",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_professional_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    color_hex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_tags", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_tags_professional_profiles_owner_professional_profil",
                        column: x => x.owner_professional_profile_id,
                        principalTable: "professional_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_tag_assignments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_tag_id = table.Column<long>(type: "bigint", nullable: false),
                    client_professional_link_id = table.Column<long>(type: "bigint", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_tag_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_client_tag_assignments_client_professional_links_client_pro",
                        column: x => x.client_professional_link_id,
                        principalTable: "client_professional_links",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_client_tag_assignments_client_tags_client_tag_id",
                        column: x => x.client_tag_id,
                        principalTable: "client_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_tag_assignments_client_professional_link_id",
                table: "client_tag_assignments",
                column: "client_professional_link_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_tag_assignments_client_tag_id_client_professional_li",
                table: "client_tag_assignments",
                columns: new[] { "client_tag_id", "client_professional_link_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_tags_owner_professional_profile_id_name",
                table: "client_tags",
                columns: new[] { "owner_professional_profile_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_client_tags_public_id",
                table: "client_tags",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_tag_assignments");

            migrationBuilder.DropTable(
                name: "client_tags");
        }
    }
}
