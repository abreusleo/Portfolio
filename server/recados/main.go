// Command recados serves the message wall in the portfolio room.
//
// Anyone may leave one short note. There is no account, because asking a
// stranger to sign up before saying hello ends the feature. What holds the
// wall up instead is the rate limit and the moderation pipeline, and both run
// on this side of the network where the caller cannot reach them.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"recados/internal/config"
	"recados/internal/geo"
	"recados/internal/httpapi"
	"recados/internal/moderation"
	"recados/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(log); err != nil {
		log.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	if len(cfg.TrustedProxies) == 0 {
		log.Warn("TRUSTED_PROXIES is unset: X-Forwarded-For will be ignored and every request will share one rate-limit bucket")
	}

	st, err := store.Open(cfg.DBPath, cfg.IPSalt)
	if err != nil {
		return err
	}
	defer st.Close()

	resolver, err := geo.Open(cfg.GeoDBPath, len(cfg.TrustedProxies) > 0)
	if err != nil {
		return err
	}
	defer resolver.Close()

	moderator := moderation.New(
		moderation.LoadLists(os.Getenv("RECADOS_EXTRA_BLOCK"), os.Getenv("RECADOS_EXTRA_SUSPECT")),
		moderation.LoadLexicon(),
		cfg.MaxNoteRunes,
	)

	server := httpapi.New(cfg, st, resolver, moderator, log)
	defer server.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go httpapi.ForgetLoop(ctx, st, cfg.IPRetention, log)
	go httpapi.PurgeLoop(ctx, st, cfg.NoteRetention, log)

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	log.Info("recados listening", "addr", cfg.Addr, "wall", cfg.WallSize,
		"note_retention", cfg.NoteRetention, "origins", cfg.Origins)

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}
