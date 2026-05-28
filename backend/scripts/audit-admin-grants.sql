-- audit-admin-grants.sql
-- Issue #308 — defense-in-depth against Admin self-promotion via POST /users/me/roles
--
-- Purpose:
--   Report all current Admin role holders so an operator can verify that only
--   legitimately seeded/out-of-band Admin accounts exist in the database.
--   The only expected Admin account in a standard deployment is
--   admin@goodfellas.local (seeded by ApplicationDbContextSeed).
--   Any additional Admin holder should be correlated against documented
--   out-of-band grants from the #230 history.
--
-- Usage:
--   psql "$CONNECTION_STRING" -f audit-admin-grants.sql
--
-- Note on audit_logs join:
--   The audit_logs table (AuditLog entity) does not persist the caller's role
--   at write time — it stores UserId, Action, EntityType, EntityId, OldValues,
--   NewValues, IpAddress, and DateCreated. Detecting whether an Admin grant was
--   made by an already-privileged account via audit_logs alone is therefore
--   unreliable. The operator should treat any Admin holder not present in the
--   seed as suspicious and investigate via application logs / git history.
--
--   The richer audit-based query (correlating AddRole audit rows against the
--   granting user's role at the time of the write) would require a caller_role
--   column on audit_logs. If that column is added in a future issue, update this
--   script accordingly.
--
-- Note on grant timestamp:
--   The standard ASP.NET Identity user_roles join table (IdentityUserRole<Guid>)
--   does not include a timestamp column. The date shown below is the user's
--   account creation time (users.date_created from ApplicationUser.DateCreated),
--   which is a rough lower-bound on when the Admin role could have been granted.
--   For a more precise grant time, correlate with:
--
--     SELECT * FROM audit_logs
--     WHERE action = 'AddRole'
--       AND new_values LIKE '%Admin%';

SELECT
    u.id            AS user_id,
    u.email         AS email,
    r.name          AS granted_role,
    u.date_created  AS user_created_at
FROM user_roles    ur
JOIN users         u  ON u.id  = ur.user_id
JOIN roles         r  ON r.id  = ur.role_id
WHERE r.normalized_name = 'ADMIN'
ORDER BY u.date_created;
