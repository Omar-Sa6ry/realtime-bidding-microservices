package mocks

import (
	"context"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
)

type MockCloudinaryService struct{}

func (m *MockCloudinaryService) UploadImage(ctx context.Context, file graphql.Upload) (string, error) {
	// Return a fake URL based on the filename
	return fmt.Sprintf("https://res.cloudinary.com/test-cloud/image/upload/v123456789/auctions/%s.jpg", file.Filename), nil
}

func (m *MockCloudinaryService) UploadMultipleImages(ctx context.Context, files []*graphql.Upload) ([]string, error) {
	var urls []string
	for _, f := range files {
		if f != nil {
			url, _ := m.UploadImage(ctx, *f)
			urls = append(urls, url)
		}
	}
	return urls, nil
}
