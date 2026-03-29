package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/dto"
	jwtutil "github.com/logicbuilders/flood-evacuation-backend/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	userRepo domain.UserRepository
}

func NewAuthHandler(userRepo domain.UserRepository) *AuthHandler {
	return &AuthHandler{userRepo: userRepo}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password required"})
		return
	}

	user, err := h.userRepo.FindByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if !user.IsAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := jwtutil.GenerateToken(user.ID.String(), string(user.Role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}

	c.JSON(http.StatusOK, dto.LoginResponse{
		Token: token,
		Role:  string(user.Role),
	})
}
