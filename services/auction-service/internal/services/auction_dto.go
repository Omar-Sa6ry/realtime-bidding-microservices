package service

import "github.com/99designs/gqlgen/graphql"

type CreateAuctionParams struct {
	Title         string
	Description   string
	StartingPrice float64
	Currency      string
	StartTime     string
	EndTime       string
	Images        []*graphql.Upload
}
