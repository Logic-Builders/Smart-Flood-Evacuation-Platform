package domain

import "github.com/google/uuid"

type UserRole string

const (
	RolePublic UserRole = "PUBLIC"
	RoleAdmin  UserRole = "ADMIN"
	RoleRescue UserRole = "RESCUE"
)

type User struct {
	ID    uuid.UUID
	Email string
	Role  UserRole
}

func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}
