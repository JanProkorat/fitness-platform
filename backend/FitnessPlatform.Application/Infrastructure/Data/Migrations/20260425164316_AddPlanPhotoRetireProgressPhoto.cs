using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanPhotoRetireProgressPhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Create the new plan_photos table ───────────────────────────────
            migrationBuilder.CreateTable(
                name: "plan_photos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    plan_id = table.Column<Guid>(type: "uuid", nullable: true),
                    plan_type = table.Column<string>(type: "text", nullable: true),
                    link_id = table.Column<Guid>(type: "uuid", nullable: true),
                    category = table.Column<string>(type: "text", nullable: false),
                    blob_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    meal_log_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    taken_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    uploaded_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    diary_request_id = table.Column<Guid>(type: "uuid", nullable: true),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_plan_photos", x => x.id);
                    table.ForeignKey(
                        name: "fk_plan_photos_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_plan_photos_users_uploaded_by_user_id",
                        column: x => x.uploaded_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_plan_photos_client_profile_id_category",
                table: "plan_photos",
                columns: new[] { "client_profile_id", "category" });

            migrationBuilder.CreateIndex(
                name: "ix_plan_photos_plan_id",
                table: "plan_photos",
                column: "plan_id");

            migrationBuilder.CreateIndex(
                name: "ix_plan_photos_public_id",
                table: "plan_photos",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_plan_photos_uploaded_by_user_id",
                table: "plan_photos",
                column: "uploaded_by_user_id");

            // ── 2. Idempotent data fold: migrate progress_photos → plan_photos ────
            //
            // We fold only if the progress_photos table still exists (idempotent:
            // running this migration a second time does nothing because the table
            // was already dropped after the first successful run).
            //
            // For each legacy row:
            //   - category      = 'Body'
            //   - plan_id       = NULL  (legacy rows have no plan context)
            //   - plan_type     = NULL
            //   - link_id       = NULL
            //   - uploaded_by_user_id = the client's user_id resolved via client_profiles
            //   - public_id     is preserved from the source row so external refs remain stable
            //   - taken_at      is preserved
            //   - blob_url      is preserved (trimmed to 500 chars for safety)
            //   - description   is preserved
            //
            // The ON CONFLICT clause on public_id makes the INSERT idempotent:
            // re-running the migration a second time (e.g. in dev after a rollback)
            // will not insert duplicate rows.
            migrationBuilder.Sql(@"
DO $$
DECLARE
    orphan_count bigint;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'progress_photos'
    ) THEN
        -- Pre-migration audit: surface any orphaned progress_photos rows whose
        -- client_profile no longer exists. These rows will be skipped by the
        -- INNER JOIN in the fold INSERT below and lost when progress_photos is
        -- dropped. We surface the count via RAISE NOTICE so the DBA can act
        -- before committing (but we do NOT abort the migration on orphans).
        SELECT COUNT(*)
        INTO orphan_count
        FROM progress_photos pp
        LEFT JOIN client_profiles cp ON cp.id = pp.client_profile_id
        WHERE cp.id IS NULL;

        IF orphan_count > 0 THEN
            RAISE NOTICE 'Pre-migration audit: % orphaned progress_photos rows will not be folded into plan_photos. Their client_profile_id no longer exists.', orphan_count;
        END IF;

        INSERT INTO plan_photos (
            client_profile_id,
            plan_id,
            plan_type,
            link_id,
            category,
            blob_url,
            description,
            meal_log_id,
            taken_at,
            uploaded_by_user_id,
            diary_request_id,
            date_created,
            date_updated,
            public_id
        )
        SELECT
            pp.client_profile_id,
            NULL::uuid,
            NULL::text,
            NULL::uuid,
            'Body',
            LEFT(pp.blob_url, 500),
            pp.description,
            NULL::text,
            pp.taken_at,
            cp.user_id,
            NULL::uuid,
            pp.date_created,
            pp.date_updated,
            pp.public_id
        FROM progress_photos pp
        INNER JOIN client_profiles cp ON cp.id = pp.client_profile_id
        ON CONFLICT (public_id) DO NOTHING;
    END IF;
END
$$;
");

            // ── 3. Retire progress_photos: drop table (safety net already committed) ──
            //
            // The table is dropped here. If you need a rollback point after the data
            // fold, back up the table before applying this migration in production.
            migrationBuilder.DropTable(
                name: "progress_photos");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recreate progress_photos so the previous migration's model is restored.
            // NOTE: data that was folded into plan_photos is NOT moved back — this
            // Down migration is a structural rollback only.
            migrationBuilder.DropTable(
                name: "plan_photos");

            migrationBuilder.CreateTable(
                name: "progress_photos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_profile_id = table.Column<long>(type: "bigint", nullable: false),
                    blob_url = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    taken_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_progress_photos", x => x.id);
                    table.ForeignKey(
                        name: "fk_progress_photos_client_profiles_client_profile_id",
                        column: x => x.client_profile_id,
                        principalTable: "client_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_progress_photos_client_profile_id",
                table: "progress_photos",
                column: "client_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_progress_photos_public_id",
                table: "progress_photos",
                column: "public_id",
                unique: true);
        }
    }
}
