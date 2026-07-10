// Package floodhub auto-predicts flood zones from Google Flood Hub gauge
// data. It only runs when config.FloodHubAPIKey is set (see cmd/api/main.go)
// — with no key, the system behaves exactly as it does today: flood zones
// stay manual-only. This has NOT been tested against the real Flood Hub API
// (no key was available while building it) — verify WatchPoints have actual
// gauge coverage and that GoogleFloodAdapter's request/response shape
// matches the real API before relying on it.
package floodhub

import (
	"log"
	"time"

	"github.com/logicbuilders/flood-evacuation-backend/internal/application/floodzones"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/external"
)

// WatchPoint is a location the poller checks on every cycle. Replace these
// placeholders with real gauge locations relevant to your deployment —
// there's no way to discover them programmatically without an API key.
var WatchPoints = []WatchPoint{
	{GaugeID: "FLOODHUB-AMPARA-01", Label: "Ampara Watch Point", Lat: 7.2833, Lng: 81.6667, RadiusKM: 8},
	{GaugeID: "FLOODHUB-GALOYA-01", Label: "Gal Oya Watch Point", Lat: 7.2833, Lng: 81.5667, RadiusKM: 10},
}

type WatchPoint struct {
	GaugeID  string
	Label    string
	Lat, Lng float64
	RadiusKM float64
}

const defaultPollInterval = 15 * time.Minute

type Poller struct {
	adapter      *external.GoogleFloodAdapter
	zoneService  *floodzones.FloodZoneService
	watchPoints  []WatchPoint
	pollInterval time.Duration
}

func NewPoller(adapter *external.GoogleFloodAdapter, zoneService *floodzones.FloodZoneService) *Poller {
	return &Poller{
		adapter:      adapter,
		zoneService:  zoneService,
		watchPoints:  WatchPoints,
		pollInterval: defaultPollInterval,
	}
}

// Run blocks, polling on a ticker until the process exits. Call it in its
// own goroutine (go poller.Run()) — it never returns and never panics the
// caller (each cycle is recovered individually).
func (p *Poller) Run() {
	log.Printf("[floodhub] poller starting — %d watch point(s), every %s", len(p.watchPoints), p.pollInterval)
	p.pollOnce()
	ticker := time.NewTicker(p.pollInterval)
	defer ticker.Stop()
	for range ticker.C {
		p.pollOnce()
	}
}

func (p *Poller) pollOnce() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[floodhub] poll cycle panicked (recovered): %v", r)
		}
	}()
	for _, wp := range p.watchPoints {
		p.pollWatchPoint(wp)
	}
}

func (p *Poller) pollWatchPoint(wp WatchPoint) {
	status, err := p.adapter.GetGaugeStatus(wp.Lat, wp.Lng)
	if err != nil {
		log.Printf("[floodhub] %s: failed to fetch gauge status: %v", wp.GaugeID, err)
		return
	}

	severity := domain.FloodSeverity(status)
	hasActiveZone := p.zoneService.HasActiveZoneForGauge(wp.GaugeID)

	switch severity {
	case domain.SeverityWarning, domain.SeverityExtreme:
		if hasActiveZone {
			return // already have a zone for this gauge; not updating severity in-place yet
		}
		zone, blocked, err := p.zoneService.CreateAutoZone(
			wp.Label+" (auto)", severity, wp.Lat, wp.Lng, wp.RadiusKM, wp.GaugeID,
		)
		if err != nil {
			log.Printf("[floodhub] %s: failed to auto-create zone: %v", wp.GaugeID, err)
			return
		}
		log.Printf("[floodhub] %s: auto-created %s zone %s (%d road(s) blocked)", wp.GaugeID, severity, zone.ID, blocked)

	case domain.SeverityNormal, domain.SeverityWatch:
		if !hasActiveZone {
			return
		}
		reopened, err := p.zoneService.DeactivateZoneByGauge(wp.GaugeID)
		if err != nil {
			log.Printf("[floodhub] %s: failed to auto-clear zone: %v", wp.GaugeID, err)
			return
		}
		log.Printf("[floodhub] %s: gauge back to %s, auto-cleared zone (%d road(s) reopened)", wp.GaugeID, severity, reopened)

	default:
		log.Printf("[floodhub] %s: unrecognized gauge status %q, skipping", wp.GaugeID, status)
	}
}
