using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanPhotoDiaryRequestFk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_plan_photos_diary_request_id",
                table: "plan_photos",
                column: "diary_request_id");

            migrationBuilder.AddForeignKey(
                name: "fk_plan_photos_photo_diary_requests_diary_request_id",
                table: "plan_photos",
                column: "diary_request_id",
                principalTable: "photo_diary_requests",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_plan_photos_photo_diary_requests_diary_request_id",
                table: "plan_photos");

            migrationBuilder.DropIndex(
                name: "ix_plan_photos_diary_request_id",
                table: "plan_photos");
        }
    }
}
