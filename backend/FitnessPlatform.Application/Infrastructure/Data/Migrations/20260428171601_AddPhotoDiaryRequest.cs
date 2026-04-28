using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoDiaryRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "photo_diary_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    professional_id = table.Column<Guid>(type: "uuid", nullable: false),
                    link_id = table.Column<long>(type: "bigint", nullable: true),
                    pending_invite_id = table.Column<long>(type: "bigint", nullable: true),
                    plan_id = table.Column<Guid>(type: "uuid", nullable: true),
                    duration_days = table.Column<int>(type: "integer", nullable: false),
                    mode = table.Column<int>(type: "integer", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    dismiss_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_photo_diary_requests", x => x.id);
                    table.CheckConstraint("ck_photo_diary_requests_accepted_at_with_accepted_status", "(status IN (2,4,5) AND accepted_at IS NOT NULL) OR (status NOT IN (2,4,5) AND accepted_at IS NULL)");
                    table.CheckConstraint("ck_photo_diary_requests_completed_at_only_when_completed", "(status = 5 AND completed_at IS NOT NULL) OR (status != 5 AND completed_at IS NULL)");
                    table.CheckConstraint("ck_photo_diary_requests_dismiss_reason_only_when_dismissed", "(status = 3 OR dismiss_reason IS NULL)");
                    table.CheckConstraint("ck_photo_diary_requests_duration_days_range", "duration_days >= 1 AND duration_days <= 30");
                    table.CheckConstraint("ck_photo_diary_requests_link_xor_invite", "(link_id IS NOT NULL AND pending_invite_id IS NULL) OR (link_id IS NULL AND pending_invite_id IS NOT NULL)");
                    table.CheckConstraint("ck_photo_diary_requests_mode_with_accepted_status", "(status IN (2,4,5) AND mode IS NOT NULL) OR (status NOT IN (2,4,5) AND mode IS NULL)");
                    table.ForeignKey(
                        name: "fk_photo_diary_requests_client_professional_links_link_id",
                        column: x => x.link_id,
                        principalTable: "client_professional_links",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_photo_diary_requests_pending_invites_pending_invite_id",
                        column: x => x.pending_invite_id,
                        principalTable: "pending_invites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_photo_diary_requests_users_professional_id",
                        column: x => x.professional_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_photo_diary_requests_link_id",
                table: "photo_diary_requests",
                column: "link_id");

            migrationBuilder.CreateIndex(
                name: "ix_photo_diary_requests_pending_invite_id",
                table: "photo_diary_requests",
                column: "pending_invite_id");

            migrationBuilder.CreateIndex(
                name: "ix_photo_diary_requests_professional_status",
                table: "photo_diary_requests",
                columns: new[] { "professional_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "photo_diary_requests");
        }
    }
}
