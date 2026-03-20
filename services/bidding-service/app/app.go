package app

type App struct {
	cfg *config.Config
}

func New() *App {
	return &App{
		cfg: config.LoadConfig(),
	}
}

func (a *App) Run() {

}
