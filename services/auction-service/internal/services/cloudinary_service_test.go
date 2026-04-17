package service

import (
	"context"
	"errors"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockUploader struct {
	mock.Mock
}

func (m *MockUploader) Upload(ctx context.Context, file interface{}, params uploader.UploadParams) (*uploader.UploadResult, error) {
	args := m.Called(ctx, file, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*uploader.UploadResult), args.Error(1)
}

func TestUploadImage(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		mockUploader := new(MockUploader)
		svc := &cloudinaryService{uploader: mockUploader}

		ctx := context.Background()
		file := graphql.Upload{File: nil} // In reality this would be an io.Reader
		secureURL := "https://res.cloudinary.com/test/image/upload/v1/auctions/sample.jpg"

		mockUploader.On("Upload", ctx, file.File, uploader.UploadParams{Folder: "auctions"}).
			Return(&uploader.UploadResult{SecureURL: secureURL}, nil)

		url, err := svc.UploadImage(ctx, file)

		assert.NoError(t, err)
		assert.Equal(t, secureURL, url)
		mockUploader.AssertExpectations(t)
	})

	t.Run("API Error", func(t *testing.T) {
		mockUploader := new(MockUploader)
		svc := &cloudinaryService{uploader: mockUploader}

		ctx := context.Background()
		file := graphql.Upload{File: nil}

		mockUploader.On("Upload", ctx, file.File, mock.Anything).
			Return(nil, errors.New("cloudinary error"))

		url, err := svc.UploadImage(ctx, file)

		assert.Error(t, err)
		assert.Equal(t, "", url)
		assert.Contains(t, err.Error(), "cloudinary error")
	})
}

func TestUploadMultipleImages(t *testing.T) {
	t.Run("Upload All Success", func(t *testing.T) {
		mockUploader := new(MockUploader)
		svc := &cloudinaryService{uploader: mockUploader}
		ctx := context.Background()

		files := []*graphql.Upload{
			{File: nil},
			{File: nil},
		}

		mockUploader.On("Upload", ctx, mock.Anything, mock.Anything).
			Return(&uploader.UploadResult{SecureURL: "url1"}, nil).Once()
		mockUploader.On("Upload", ctx, mock.Anything, mock.Anything).
			Return(&uploader.UploadResult{SecureURL: "url2"}, nil).Once()

		urls, err := svc.UploadMultipleImages(ctx, files)

		assert.NoError(t, err)
		assert.Len(t, urls, 2)
		assert.Equal(t, []string{"url1", "url2"}, urls)
	})

	t.Run("Stop on Error", func(t *testing.T) {
		mockUploader := new(MockUploader)
		svc := &cloudinaryService{uploader: mockUploader}
		ctx := context.Background()

		files := []*graphql.Upload{
			{File: nil},
			{File: nil},
		}

		mockUploader.On("Upload", ctx, mock.Anything, mock.Anything).
			Return(nil, errors.New("failed first")).Once()

		urls, err := svc.UploadMultipleImages(ctx, files)

		assert.Error(t, err)
		assert.Nil(t, urls)
		// Second upload should NOT be called
		mockUploader.AssertNumberOfCalls(t, "Upload", 1)
	})

	t.Run("Skip Nil Files", func(t *testing.T) {
		mockUploader := new(MockUploader)
		svc := &cloudinaryService{uploader: mockUploader}
		ctx := context.Background()

		files := []*graphql.Upload{
			nil,
			{File: nil},
		}

		mockUploader.On("Upload", ctx, mock.Anything, mock.Anything).
			Return(&uploader.UploadResult{SecureURL: "url1"}, nil)

		urls, err := svc.UploadMultipleImages(ctx, files)

		assert.NoError(t, err)
		assert.Len(t, urls, 1)
		mockUploader.AssertNumberOfCalls(t, "Upload", 1)
	})
}
