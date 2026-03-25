package translation

import (
	"context"
	"encoding/json"
	"path/filepath"
	"runtime"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

var bundle *i18n.Bundle

type contextKey string

const LangContextKey contextKey = "lang"

func Init() {
	bundle = i18n.NewBundle(language.English)
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	_, filename, _, _ := runtime.Caller(0)
	localesPath := filepath.Join(filepath.Dir(filename), "locales")

	bundle.MustLoadMessageFile(filepath.Join(localesPath, "en.json"))
	bundle.MustLoadMessageFile(filepath.Join(localesPath, "ar.json"))
}

func T(ctx context.Context, messageID string) string {
	lang, ok := ctx.Value(LangContextKey).(string)
	if !ok || lang == "" {
		lang = "en"
	}

	localizer := i18n.NewLocalizer(bundle, lang)
	translation, err := localizer.Localize(&i18n.LocalizeConfig{
		MessageID: messageID,
	})

	if err != nil {
		return messageID
	}
	return translation
}
