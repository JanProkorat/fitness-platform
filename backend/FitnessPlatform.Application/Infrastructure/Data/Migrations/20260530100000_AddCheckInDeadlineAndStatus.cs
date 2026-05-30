using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckInDeadlineAndStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── WeeklyCheckIn: add Status, DueAt, ExpiredAt ──────────────────────────
            //
            // Status is the lifecycle state derived from the audit timestamp columns.
            // Default is 'Pending' for all new and existing rows.
            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "weekly_check_ins",
                type: "text",
                nullable: false,
                defaultValue: "Pending");

            // DueAt is SentAt + DeadlineOffsetHours. Set to null by default (backfilled below).
            migrationBuilder.AddColumn<DateTime>(
                name: "due_at",
                table: "weekly_check_ins",
                type: "timestamp with time zone",
                nullable: true);

            // ExpiredAt is the moment the sweeper transitioned this row to Expired.
            migrationBuilder.AddColumn<DateTime>(
                name: "expired_at",
                table: "weekly_check_ins",
                type: "timestamp with time zone",
                nullable: true);

            // ── WeeklyCheckInSetting: add DeadlineOffsetHours ────────────────────────
            //
            // Default 72 hours (3 days) matches the platform's design-reviewed default.
            migrationBuilder.AddColumn<int>(
                name: "deadline_offset_hours",
                table: "weekly_check_in_settings",
                type: "integer",
                nullable: false,
                defaultValue: 72);

            // ── WeeklyCheckInClientOverride: add nullable DeadlineOffsetHours ────────
            //
            // Null = inherit from the professional's WeeklyCheckInSetting.
            migrationBuilder.AddColumn<int>(
                name: "deadline_offset_hours",
                table: "weekly_check_in_client_overrides",
                type: "integer",
                nullable: true);

            // ── Backfill: DeadlineOffsetHours on all existing settings → 72 ─────────
            //
            // All existing settings were created without a deadline offset.
            // We stamp them with the default 72h so their future check-ins inherit it.
            migrationBuilder.Sql(
                @"UPDATE weekly_check_in_settings
                  SET deadline_offset_hours = 72
                  WHERE deadline_offset_hours IS NULL OR deadline_offset_hours = 0;");

            // ── Backfill: DueAt on existing WeeklyCheckIn rows → SentAt + 72 hours ──
            //
            // Existing rows have no DueAt. We use SentAt + INTERVAL '72 hours' as the
            // retroactive deadline. This gives all existing Pending rows a fair window
            // before the sweeper can expire them (the sweeper only expires past-due
            // rows, so most backfilled rows will be safe since they're in the past).
            migrationBuilder.Sql(
                @"UPDATE weekly_check_ins
                  SET due_at = sent_at + INTERVAL '72 hours'
                  WHERE due_at IS NULL;");

            // ── Backfill: Status on existing WeeklyCheckIn rows from audit timestamps ─
            //
            // Priority: Reviewed > Responded > Dismissed > Pending.
            // (A row marked reviewed may also have responded_at — Reviewed takes precedence.)
            // ExpiredAt is NOT backfilled here — the sweeper will handle any
            // past-due Pending rows on the next hourly tick.
            migrationBuilder.Sql(
                @"UPDATE weekly_check_ins
                  SET status = CASE
                    WHEN reviewed_by_trainer_at IS NOT NULL THEN 'Reviewed'
                    WHEN responded_at           IS NOT NULL THEN 'Responded'
                    WHEN dismissed_by_client_at IS NOT NULL THEN 'Dismissed'
                    ELSE 'Pending'
                  END
                  WHERE status = 'Pending';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "status",
                table: "weekly_check_ins");

            migrationBuilder.DropColumn(
                name: "due_at",
                table: "weekly_check_ins");

            migrationBuilder.DropColumn(
                name: "expired_at",
                table: "weekly_check_ins");

            migrationBuilder.DropColumn(
                name: "deadline_offset_hours",
                table: "weekly_check_in_settings");

            migrationBuilder.DropColumn(
                name: "deadline_offset_hours",
                table: "weekly_check_in_client_overrides");
        }
    }
}
