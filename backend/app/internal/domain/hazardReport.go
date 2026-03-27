package domain

import (
	"github.com/google/uuid"
	"time"
)

type ReportType string

const (
	ReportTypeFloodedRoad   ReportType = "FLOODED_ROAD"
	ReportTypeDamagedBridge ReportType = "DAMAGED_BRIDGE"
	ReportTypeBlockedRoad   ReportType = "BLOCKED_ROAD"
)

type ValidationStatus string

const (
	StatusPending  ValidationStatus = "PENDING"
	StatusApproved ValidationStatus = "APPROVED"
	StatusRejected ValidationStatus = "REJECTED"
	StatusArchived ValidationStatus = "ARCHIVED"
)

const DefaultTTL = 3 * time.Hour

type HazardReport struct {
	ID               uuid.UUID
	ReporterID       uuid.UUID
	Location         GeoPoint
	ReportType       ReportType
	Severity         int
	Description      string
	ValidationStatus ValidationStatus
	CreatedAt        time.Time
	ExpiresAt        time.Time
}

func NewHazardReport(reporterID uuid.UUID, loc GeoPoint, rType ReportType, severity int, desc string) *HazardReport {
	now := time.Now()
	return &HazardReport{
		ID:               uuid.New(),
		ReporterID:       reporterID,
		Location:         loc,
		ReportType:       rType,
		Severity:         severity,
		Description:      desc,
		ValidationStatus: StatusPending,
		CreatedAt:        now,
		ExpiresAt:        now.Add(DefaultTTL),
	}
}

func (h *HazardReport) IsExpired() bool {
	return time.Now().After(h.ExpiresAt)
}

func (h *HazardReport) Approve() {
	h.ValidationStatus = StatusApproved
}

func (h *HazardReport) Reject() {
	h.ValidationStatus = StatusRejected
}

func (h *HazardReport) IsActive() bool {
	return h.ValidationStatus == StatusApproved && !h.IsExpired()
}
