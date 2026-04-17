package service

import (
	"context"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

type CloudinaryUploader interface {
	Upload(ctx context.Context, file interface{}, params uploader.UploadParams) (*uploader.UploadResult, error)
}

type realUploader struct {
	client *cloudinary.Cloudinary
}

func (u *realUploader) Upload(ctx context.Context, file interface{}, params uploader.UploadParams) (*uploader.UploadResult, error) {
	return u.client.Upload.Upload(ctx, file, params)
}

type CloudinaryService interface {
	UploadImage(ctx context.Context, file graphql.Upload) (string, error)
	UploadMultipleImages(ctx context.Context, files []*graphql.Upload) ([]string, error)
}

type cloudinaryService struct {
	uploader CloudinaryUploader
}

func NewCloudinaryService(cloudName, apiKey, apiSecret string) (CloudinaryService, error) {
	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cloudinary: %w", err)
	}

	return &cloudinaryService{
		uploader: &realUploader{client: cld},
	}, nil
}

func (s *cloudinaryService) UploadImage(ctx context.Context, file graphql.Upload) (string, error) {
	resp, err := s.uploader.Upload(ctx, file.File, uploader.UploadParams{
		Folder: "auctions",
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload image: %w", err)
	}

	return resp.SecureURL, nil
}

func (s *cloudinaryService) UploadMultipleImages(ctx context.Context, files []*graphql.Upload) ([]string, error) {
	var urls []string
	for _, file := range files {
		if file == nil {
			continue
		}

		url, err := s.UploadImage(ctx, *file)
		if err != nil {
			return nil, err
		}

		urls = append(urls, url)
	}
	return urls, nil
}
