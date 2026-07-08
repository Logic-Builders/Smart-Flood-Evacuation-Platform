package domain

import "github.com/google/uuid"

// AnonymousReporterID is the well-known user row used as the reporter_id for hazard
// reports submitted by the public mobile app, which has no authenticated user accounts.
// hazard_reports.reporter_id is NOT NULL REFERENCES users(user_id), so a real, seeded
// row is required (see database.sql) rather than a random uuid.New() per submission.
var AnonymousReporterID = uuid.MustParse("00000000-0000-0000-0000-000000000099")
