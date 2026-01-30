interface IPFSUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export class IPFSService {
  private apiKey: string;
  private secretKey: string;
  private baseUrl = 'https://api.pinata.cloud';

  constructor() {
    this.apiKey = process.env.PINATA_API_KEY || '';
    this.secretKey = process.env.PINATA_SECRET_API_KEY || '';
    
    if (!this.apiKey || !this.secretKey) {
      console.warn('IPFS service not configured - Pinata API keys missing');
    }
  }

  async uploadFile(file: File): Promise<string> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    const formData = new FormData();
    formData.append('file', file);

    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size.toString(),
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

    const result: IPFSUploadResponse = await response.json();
    return result.IpfsHash;
  }

  async uploadJSON(data: any, name: string): Promise<string> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

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

    const result: IPFSUploadResponse = await response.json();
    return result.IpfsHash;
  }

  getGatewayUrl(hash: string): string {
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  }

  async getFileInfo(hash: string): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('IPFS service not configured');
    }

    const response = await fetch(`${this.baseUrl}/data/pinList?hashContains=${hash}`, {
      headers: {
        'pinata_api_key': this.apiKey,
        'pinata_secret_api_key': this.secretKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get file info from IPFS');
    }

    const result = await response.json();
    return result.rows[0] || null;
  }
}

export const ipfsService = new IPFSService();