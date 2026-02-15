/**
 * Metadata Extraction Service for Credit OS
 * 
 * Extracts metadata from various document formats (PDF, images, etc.)
 */

import { logger } from '../../utils/logger';

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  extractedText?: string;
  keywords: string[];
  createdDate?: Date;
  modifiedDate?: Date;
  author?: string;
  title?: string;
  pageCount?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  format?: string;
}

export interface ExtractionResult {
  metadata: DocumentMetadata;
  success: boolean;
  errors?: string[];
}

export class MetadataExtractionService {
  /**
   * Extract metadata from document buffer
   */
  async extractMetadata(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<ExtractionResult> {
    try {
      const metadata: DocumentMetadata = {
        fileName,
        fileSize: buffer.length,
        mimeType,
        keywords: []
      };

      // Extract based on mime type
      if (mimeType.startsWith('image/')) {
        await this.extractImageMetadata(buffer, metadata);
      } else if (mimeType === 'application/pdf') {
        await this.extractPDFMetadata(buffer, metadata);
      } else if (mimeType.includes('text/')) {
        await this.extractTextMetadata(buffer, metadata);
      }

      // Extract keywords from filename
      metadata.keywords = this.extractKeywordsFromFilename(fileName);

      logger.info('Metadata extracted successfully', {
        fileName,
        mimeType,
        keywordCount: metadata.keywords.length
      });

      return {
        metadata,
        success: true
      };
    } catch (error: any) {
      logger.error('Failed to extract metadata', {
        error: error.message,
        fileName,
        mimeType
      });

      return {
        metadata: {
          fileName,
          fileSize: buffer.length,
          mimeType,
          keywords: []
        },
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Extract metadata from image files
   */
  private async extractImageMetadata(
    buffer: Buffer,
    metadata: DocumentMetadata
  ): Promise<void> {
    try {
      // Mock implementation - in production would use image processing library
      // like sharp or jimp to extract EXIF data, dimensions, etc.
      
      metadata.format = 'image';
      
      // Basic image type detection
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        metadata.format = 'JPEG';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        metadata.format = 'PNG';
      }

      logger.debug('Image metadata extracted', {
        format: metadata.format
      });
    } catch (error: any) {
      logger.warn('Failed to extract image metadata', {
        error: error.message
      });
    }
  }

  /**
   * Extract metadata from PDF files
   */
  private async extractPDFMetadata(
    buffer: Buffer,
    metadata: DocumentMetadata
  ): Promise<void> {
    try {
      // Mock implementation - in production would use pdf-parse or similar
      // to extract text, page count, author, title, etc.
      
      metadata.format = 'PDF';
      
      // Try to extract basic PDF info from header
      const headerString = buffer.slice(0, 1024).toString('utf-8', 0, 1024);
      
      // Look for PDF version
      const versionMatch = headerString.match(/%PDF-(\d+\.\d+)/);
      if (versionMatch) {
        metadata.title = `PDF Document (v${versionMatch[1]})`;
      }

      logger.debug('PDF metadata extracted', {
        format: metadata.format
      });
    } catch (error: any) {
      logger.warn('Failed to extract PDF metadata', {
        error: error.message
      });
    }
  }

  /**
   * Extract metadata from text files
   */
  private async extractTextMetadata(
    buffer: Buffer,
    metadata: DocumentMetadata
  ): Promise<void> {
    try {
      // Extract text content
      const text = buffer.toString('utf-8');
      metadata.extractedText = text.substring(0, 10000); // Limit to first 10KB
      
      // Extract keywords from text
      const textKeywords = this.extractKeywordsFromText(text);
      metadata.keywords.push(...textKeywords);

      metadata.format = 'text';

      logger.debug('Text metadata extracted', {
        textLength: text.length,
        keywordCount: textKeywords.length
      });
    } catch (error: any) {
      logger.warn('Failed to extract text metadata', {
        error: error.message
      });
    }
  }

  /**
   * Extract keywords from filename
   */
  private extractKeywordsFromFilename(fileName: string): string[] {
    try {
      // Remove extension
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      
      // Split by common separators and filter
      const keywords = nameWithoutExt
        .split(/[-_\s.]+/)
        .filter(word => word.length > 2)
        .map(word => word.toLowerCase());

      return [...new Set(keywords)]; // Remove duplicates
    } catch (error: any) {
      logger.warn('Failed to extract keywords from filename', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Extract keywords from text content
   */
  private extractKeywordsFromText(text: string): string[] {
    try {
      // Simple keyword extraction - in production would use NLP library
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);

      // Count word frequency
      const wordFreq = new Map<string, number>();
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }

      // Get top 20 most frequent words
      const sortedWords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word]) => word);

      return sortedWords;
    } catch (error: any) {
      logger.warn('Failed to extract keywords from text', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Validate document format
   */
  async validateDocumentFormat(
    buffer: Buffer,
    expectedMimeType: string
  ): Promise<{ isValid: boolean; detectedMimeType?: string; reason?: string }> {
    try {
      // Check file signatures (magic numbers)
      const signatures: Record<string, number[]> = {
        'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'image/gif': [0x47, 0x49, 0x46],
      };

      let detectedMimeType: string | undefined;

      for (const [mimeType, signature] of Object.entries(signatures)) {
        if (this.matchesSignature(buffer, signature)) {
          detectedMimeType = mimeType;
          break;
        }
      }

      if (!detectedMimeType) {
        return {
          isValid: false,
          reason: 'Unknown file format'
        };
      }

      if (detectedMimeType !== expectedMimeType) {
        return {
          isValid: false,
          detectedMimeType,
          reason: `Expected ${expectedMimeType} but detected ${detectedMimeType}`
        };
      }

      return {
        isValid: true,
        detectedMimeType
      };
    } catch (error: any) {
      logger.error('Failed to validate document format', {
        error: error.message
      });
      return {
        isValid: false,
        reason: error.message
      };
    }
  }

  /**
   * Check if buffer matches file signature
   */
  private matchesSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }
}
