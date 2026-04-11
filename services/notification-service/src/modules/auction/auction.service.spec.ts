import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { of, throwError } from 'rxjs';
import { AuctionService } from './auction.service';

describe('AuctionService', () => {
  let service: AuctionService;
  let mockI18n: { t: jest.Mock };
  let mockClient: { getService: jest.Mock };
  let mockAuctionGrpcService: { getAuction: jest.Mock };

  beforeEach(async () => {
    mockI18n = {
      t: jest.fn().mockReturnValue('Auction not found'),
    };
    mockAuctionGrpcService = {
      getAuction: jest.fn(),
    };
    mockClient = {
      getService: jest.fn().mockReturnValue(mockAuctionGrpcService),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: I18nService, useValue: mockI18n },
        { provide: 'GRPC_AUCTION_SERVICE', useValue: mockClient },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
    // Manually trigger init to set auctionGrpcService
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize auctionGrpcService', () => {
      service.onModuleInit();
      expect(mockClient.getService).toHaveBeenCalledWith('AuctionService');
    });
  });

  describe('findById', () => {
    const auctionId = 'auc-1';
    const mockAuctionResponse = { id: auctionId, title: 'Test Auction', exists: true };

    it('should return auction data on success', async () => {
      mockAuctionGrpcService.getAuction.mockReturnValue(of(mockAuctionResponse));

      const result = await service.findById(auctionId);

      expect(mockAuctionGrpcService.getAuction).toHaveBeenCalledWith({ auction_id: auctionId });
      expect(result).toEqual(mockAuctionResponse);
    });

    it('should throw NotFoundException if auction does not exist', async () => {
      mockAuctionGrpcService.getAuction.mockReturnValue(of({ exists: false }));

      await expect(service.findById(auctionId)).rejects.toThrow(NotFoundException);
      expect(mockI18n.t).toHaveBeenCalledWith('notification.AUCTION_NOT_FOUND');
    });

    it('should throw NotFoundException if response is null', async () => {
      mockAuctionGrpcService.getAuction.mockReturnValue(of(null));

      await expect(service.findById(auctionId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if gRPC call fails', async () => {
      mockAuctionGrpcService.getAuction.mockReturnValue(throwError(() => new Error('gRPC connection error')));

      await expect(service.findById(auctionId)).rejects.toThrow(NotFoundException);
    });
  });
});
