package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("Auction Service Started 🚀")
	fmt.Println("Waiting for events...")

	// Keep the application running without deadlock
	for {
		time.Sleep(time.Hour)
	}
}
