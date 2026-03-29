package repositories

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type PostgresUserRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresUserRepository(pool *pgxpool.Pool) *PostgresUserRepository {
	return &PostgresUserRepository{pool: pool}
}

func (r *PostgresUserRepository) FindByEmail(email string) (*domain.User, error) {
	query := `
	SELECT user_id, email, password_hash, role
		FROM flood_system.users
		WHERE email = $1 AND is_active = TRUE
	`

	row := r.pool.QueryRow(context.Background(), query, email)

	u := &domain.User{}
	var passwordHash string
	var role string

	err := row.Scan(&u.ID, &u.Email, &passwordHash, &role)
	if err != nil {
		return nil, err
	}

	u.Role = domain.UserRole(role)
	u.PasswordHash = passwordHash

	return u, nil
}
