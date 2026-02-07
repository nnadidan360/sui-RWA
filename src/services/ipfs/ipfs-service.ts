/**
 * IPFS Service for Backend
 * 
 * Handles file uploads and management via Pinata IPFS service
 */

import { logger } from '../../utils/logger';

interface IPFSUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface FileUploadResult {
  hash: string;
  size: number;
  timestamp: string;
  gatewayUrl: string;
}

export class IPFSService {
  private apiKey: string;
  private secretKey: string;
  private baseUrl = 'https://api.pinata.cloud';
  private gatewayUrl = 'https://gateway.pinata.cloud/ipfs';

  constructor() {
    this.apiKey = process.env.PINATA_API_KEY || '';
    this.secretKey = process.env.PINATA_SECRET_KEY || '';
    
    if (!this.apiKey || !this.secretKey) {
      logger.warn('IPFS service not configured - Pinata API keys missing');
    }
  }

  /**
   * Upload file buffer to IPFS
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType?: string
  ): Promise<FileUploadResult> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    try {
      logger.info('Uploading file to IPFS', { fileName, size: fileBuffer.length });

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);

      const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          uploadedAt: new Date().toISOString(),
          fileType: mimeType || 'application/octet-stream',
          fileSize: fileBuffer.length.toString(),
        }
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 0,
      });
      formData.append('pinataOptions', options);

      const response = await fetch(`${this.baseUrl}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          'pinata_api_key': this.apiKey,
          'pinata_secret_api_key': this.secretKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`IPFS upload failed: ${error}`);
      }

      const result = await response.json() as IPFSUploadResponse;
      
      const uploadResult: FileUploadResult = {
        hash: result.IpfsHash,
        size: result.PinSize,
        timestamp: result.Timestamp,
        gatewayUrl: this.getGatewayUrl(result.IpfsHash),
      };

      logger.info('File uploaded to IPFS successfully', { 
        fileName, 
        hash: result.IpfsHash,
        size: result.PinSize 
      });

      return uploadResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upload file to IPFS', { 
        error: errorMessage, 
        fileName 
      });
      throw error;
    }
  }

  /**
   * Upload JSON data to IPFS
   */
  async uploadJSON(data: any, name: string): Promise<FileUploadResult> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    try {
      logger.info('Uploading JSON to IPFS', { name });

      const metadata = {
        name,
        keyvalues: {
          uploadedAt: new Date().toISOString(),
          dataType: 'json',
        }
      };

      const body = {
        pinataContent: data,
        pinataMetadata: metadata,
        pinataOptions: {
          cidVersion: 0,
        }
      };

      const response = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.apiKey,
          'pinata_secret_api_key': this.secretKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`IPFS JSON upload failed: ${error}`);
      }

      const result = await response.json() as IPFSUploadResponse;
      
      const uploadResult: FileUploadResult = {
        hash: result.IpfsHash,
        size: result.PinSize,
        timestamp: result.Timestamp,
        gatewayUrl: this.getGatewayUrl(result.IpfsHash),
      };

      logger.info('JSON uploaded to IPFS successfully', { 
        name, 
        hash: result.IpfsHash,
        size: result.PinSize 
      });

      return uploadResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upload JSON to IPFS', { 
        error: errorMessage, 
        name 
      });
      throw error;
    }
  }

  /**
   * Get IPFS gateway URL for a hash
   */
  getGatewayUrl(hash: string): string {
    return `${this.gatewayUrl}/${hash}`;
  }

  /**
   * Get file information from Pinata
   */
  async getFileInfo(hash: string): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    try {
      logger.info('Getting file info from IPFS', { hash });

      const response = await fetch(`${this.baseUrl}/data/pinList?hashContains=${hash}`, {
        headers: {
          'pinata_api_key': this.apiKey,
          'pinata_secret_api_key': this.secretKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get file info from IPFS');
      }

      const result: any = await response.json();
      const fileInfo = result.rows?.[0] || null;

      logger.info('File info retrieved from IPFS', { hash, found: !!fileInfo });
      return fileInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get file info from IPFS', { 
        error: errorMessage, 
        hash 
      });
      throw error;
    }
  }

  /**
   * Unpin file from IPFS
   */
  async unpinFile(hash: string): Promise<boolean> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    try {
      logger.info('Unpinning file from IPFS', { hash });

      const response = await fetch(`${this.baseUrl}/pinning/unpin/${hash}`, {
        method: 'DELETE',
        headers: {
          'pinata_api_key': this.apiKey,
          'pinata_secret_api_key': this.secretKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to unpin file: ${error}`);
      }

      logger.info('File unpinned from IPFS successfully', { hash });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to unpin file from IPFS', { 
        error: errorMessage, 
        hash 
      });
      return false;
    }
  }

  /**
   * List pinned files
   */
  async listPinnedFiles(
    limit: number = 10,
    offset: number = 0
  ): Promise<{ files: any[]; total: number }> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    try {
      logger.info('Listing pinned files from IPFS', { limit, offset });

      const response = await fetch(
        `${this.baseUrl}/data/pinList?pageLimit=${limit}&pageOffset=${offset}`,
        {
          headers: {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list pinned files');
      }

      const result: any = await response.json();
      
      logger.info('Pinned files listed successfully', { 
        count: result.rows?.length || 0,
        total: result.count 
      });

      return {
        files: result.rows || [],
        total: result.count || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list pinned files', { 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Validate IPFS hash format
   */
  isValidHash(hash: string): boolean {
    // Basic IPFS hash validation (CIDv0 and CIDv1)
    const cidv0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
    const cidv1Regex = /^[a-z2-7]{59}$/;
    
    return cidv0Regex.test(hash) || cidv1Regex.test(hash);
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    error?: string;
  }> {
    const configured = !!(this.apiKey && this.secretKey);
    
    if (!configured) {
      return {
        configured: false,
        connected: false,
        error: 'API keys not configured',
      };
    }

    try {
      // Test connection by getting account info
      const response = await fetch(`${this.baseUrl}/data/testAuthentication`, {
        headers: {
          'pinata_api_key': this.apiKey,
          'pinata_secret_api_key': this.secretKey,
        },
      });

      const connected = response.ok;
      
      return {
        configured: true,
        connected,
        error: connected ? undefined : 'Authentication failed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        configured: true,
        connected: false,
        error: errorMessage,
      };
    }
  }
}