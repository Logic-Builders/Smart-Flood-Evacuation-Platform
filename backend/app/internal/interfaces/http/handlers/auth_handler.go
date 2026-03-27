package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/dto"
	jwtutil "github.com/logicbuilders/flood-evacuation-backend/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	adminUsername     string
	adminPasswordHash string
	adminID           string
}

func NewAuthHandler() *AuthHandler {
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	return &AuthHandler{
		adminUsername:     "admin",
		adminPasswordHash: string(hash),
		adminID:           "admin-001",
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password required"})
		return
	}

	if req.Username != h.adminUsername {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(h.adminPasswordHash), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
	}

	token, err := jwtutil.GenerateToken(h.adminID, "ADMIN")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}

	c.JSON(http.StatusOK, dto.LoginResponse{
		Token: token,
		Role:  "ADMIN",
	})

}
