package logger

import (
	"fmt"
	"time"
)

const (
	colorYellow  = "\033[33m"
	colorReset   = "\033[0m"
	colorGreen   = "\033[32m"
	colorCyan    = "\033[36m"
	colorMagenta = "\033[35m"
)

func Log(context string, message string) {
	timestamp := time.Now().Format("01/02/2006, 3:04:05 PM")
	fmt.Printf("%s[Go]%s %d  - %s     %sLOG%s %s[%s]%s %s%s%s\n",
		colorGreen, colorReset,
		1, // Placeholder for PID-like feel
		timestamp,
		colorGreen, colorReset,
		colorMagenta, context, colorReset,
		colorGreen, message, colorReset,
	)
}

func Info(context string, message string) {
	Log(context, message)
}

func Error(context string, message string, err error) {
	timestamp := time.Now().Format("01/02/2006, 3:04:05 PM")
	fmt.Printf("%s[Go]%s %d  - %s     \033[31mERROR\033[0m %s[%s]%s \033[31m%s: %v\033[0m\n",
		colorGreen, colorReset,
		1,
		timestamp,
		colorMagenta, context, colorReset,
		message, err,
	)
}

func Warn(context string, message string) {
	timestamp := time.Now().Format("01/02/2006, 3:04:05 PM")
	fmt.Printf("%s[Go]%s %d  - %s     %sWARN%s %s[%s]%s %s%s%s\n",
		colorGreen, colorReset,
		1,
		timestamp,
		colorYellow, colorReset, // Yellow for WARN text
		colorMagenta, context, colorReset,
		colorYellow, message, colorReset,
	)
}
