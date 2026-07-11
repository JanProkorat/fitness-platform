using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillTrainerCanViewTrainingPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Backfill: can_view_training_plans for Trainer links ──────────────────
            //
            // 20260321131547_AddPlanViewPermissions added can_view_training_plans with
            // defaultValue: false and never backfilled it. professional_role = 1 ==
            // UserRole.Trainer (Admin=0, Trainer=1, Nutritionist=2, Client=3). This
            // restores the role default that AcceptClientRequestEndpoint already applies
            // to every NEW trainer link (CanViewTrainingPlans = professionalRole ==
            // UserRole.Trainer) — no endpoint lets a trainer's own client toggle this
            // flag, so no deliberate false setting is being clobbered here.
            // Nutrition is intentionally out of scope: can_view_nutrition_plans is left
            // untouched.
            migrationBuilder.Sql(
                @"UPDATE client_professional_links
                  SET can_view_training_plans = true
                  WHERE professional_role = 1 AND can_view_training_plans = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentional no-op: this is a one-way data backfill. Reversing it would
            // require knowing which rows were false before the Up() ran, which we no
            // longer have — flipping every Trainer link back to false would re-introduce
            // the #735 bug for links that were correctly true before this migration.
        }
    }
}
