package repositories

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type PostgresRoadRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRoadRepository(pool *pgxpool.Pool) *PostgresRoadRepository {
	return &PostgresRoadRepository{pool: pool}
}

func (r *PostgresRoadRepository) FindAllPassable() ([]*domain.RoadSegment, error) {
	query := `
		SELECT	segment_id, condition, flood_risk, hazard_score,
				ST_X(start_point) as start_lng, ST_Y(start_point) as start_lat,
				ST_X(end_point) as end_lng, ST_Y(end_point) as end_lat
		FROM flood_system.road_segments
		WHERE condition = 'PASSABLE'		
	`

	rows, err := r.pool.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var segments []*domain.RoadSegment
	for rows.Next() {
		s := &domain.RoadSegment{}
		err := rows.Scan(
			&s.ID,
			&s.Condition,
			&s.FloodRisk,
			&s.HazardScore,
			&s.StartPoint.Lng,
			&s.StartPoint.Lat,
			&s.EndPoint.Lng,
			&s.EndPoint.Lat,
		)
		if err != nil {
			return nil, err
		}
		segments = append(segments, s)
	}
	return segments, rows.Err()
}
