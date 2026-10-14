using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanPhotoViewers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "plan_photo_viewers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    plan_photo_id = table.Column<long>(type: "bigint", nullable: false),
                    professional_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_plan_photo_viewers", x => x.id);
                    table.ForeignKey(
                        name: "fk_plan_photo_viewers_plan_photos_plan_photo_id",
                        column: x => x.plan_photo_id,
                        principalTable: "plan_photos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_plan_photo_viewers_users_professional_user_id",
                        column: x => x.professional_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_plan_photo_viewers_plan_photo_id_professional_user_id",
                table: "plan_photo_viewers",
                columns: new[] { "plan_photo_id", "professional_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_plan_photo_viewers_professional_user_id",
                table: "plan_photo_viewers",
                column: "professional_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "plan_photo_viewers");
        }
    }
}
