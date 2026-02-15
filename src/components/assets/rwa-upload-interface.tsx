'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';

export interface RWADocument {
  file: File;
  type: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'invoice' | 'equipment_title' | 'other';
  hash?: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'hashing' | 'complete' | 'error';
  error?: string;
}

export interface RWAUploadInterfaceProps {
  onUploadComplete?: (documents: RWADocument[]) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
}

const DOCUMENT_TYPES = [
  { value: 'deed', label: 'Property Deed/Title', description: 'Legal ownership document' },
  { value: 'appraisal', label: 'Appraisal Report', description: 'Professional valuation' },
  { value: 'insurance', label: 'Insurance Policy', description: 'Coverage documentation' },
  { value: 'permit', label: 'Permit/License', description: 'Regulatory approval' },
  { value: 'invoice', label: 'Invoice/Receivable', description: 'Payment obligation' },
  { value: 'equipment_title', label: 'Equipment Title', description: 'Vehicle/equipment ownership' },
  { value: 'other', label: 'Other Document', description: 'Additional documentation' },
];

export function RWAUploadInterface({
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  maxFileSize = 10
}: RWAUploadInterfaceProps) {
  const [documents, setDocuments] = useState<RWADocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFee] = useState(10); // $10 upload fee per requirement

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [documents, maxFiles, maxFileSize]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, [documents, maxFiles, maxFileSize]);

  const handleFiles = (files: File[]) => {
    // Validate file count
    if (documents.length + files.length > maxFiles) {
      onUploadError?.(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes and types
    const validFiles: RWADocument[] = [];
    for (const file of files) {
      const fileSizeMB = file.size / (1024 * 1024);
      
      if (fileSizeMB > maxFileSize) {
        onUploadError?.(`File ${file.name} exceeds ${maxFileSize}MB limit`);
        continue;
      }

      if (!file.type.match(/^(application\/pdf|image\/(jpeg|jpg|png)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/)) {
        onUploadError?.(`File ${file.name} has unsupported format`);
        continue;
      }

      validFiles.push({
        file,
        type: 'other',
        uploadProgress: 0,
        status: 'pending'
      });
    }

    setDocuments(prev => [...prev, ...validFiles]);
  };

  const updateDocumentType = (index: number, type: RWADocument['type']) => {
    setDocuments(prev => prev.map((doc, i) => 
      i === index ? { ...doc, type } : doc
    ));
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadDocument = async (index: number) => {
    const doc = documents[index];
    
    try {
      // Update status to uploading
      setDocuments(prev => prev.map((d, i) => 
        i === index ? { ...d, status: 'uploading' as const, uploadProgress: 0 } : d
      ));

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setDocuments(prev => prev.map((d, i) => 
          i === index ? { ...d, uploadProgress: progress } : d
        ));
      }

      // Generate cryptographic hash (SHA-256)
      setDocuments(prev => prev.map((d, i) => 
        i === index ? { ...d, status: 'hashing' as const } : d
      ));

      const hash = await generateFileHash(doc.file);

      // Upload to backend
      const formData = new FormData();
      formData.append('file', doc.file);
      formData.append('type', doc.type);
      formData.append('hash', hash);

      const response = await fetch('/api/assets/upload-document', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      // Mark as complete
      setDocuments(prev => prev.map((d, i) => 
        i === index ? { 
          ...d, 
          status: 'complete' as const, 
          hash: result.hash,
          uploadProgress: 100 
        } : d
      ));

    } catch (error: any) {
      setDocuments(prev => prev.map((d, i) => 
        i === index ? { 
          ...d, 
          status: 'error' as const, 
          error: error.message || 'Upload failed' 
        } : d
      ));
      onUploadError?.(error.message || 'Upload failed');
    }
  };

  const uploadAllDocuments = async () => {
    const pendingDocs = documents
      .map((doc, index) => ({ doc, index }))
      .filter(({ doc }) => doc.status === 'pending');

    for (const { index } of pendingDocs) {
      await uploadDocument(index);
    }

    const allComplete = documents.every(doc => doc.status === 'complete');
    if (allComplete) {
      onUploadComplete?.(documents);
    }
  };

  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const getStatusIcon = (status: RWADocument['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'uploading':
      case 'hashing':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: RWADocument['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'hashing':
        return 'Generating hash...';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const totalCost = documents.length > 0 ? uploadFee : 0;
  const allComplete = documents.length > 0 && documents.every(doc => doc.status === 'complete');
  const hasErrors = documents.some(doc => doc.status === 'error');

  return (
    <div className="space-y-6">
      {/* Upload Fee Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Asset Upload Fee: ${uploadFee}
            </p>
            <p className="text-blue-800 dark:text-blue-200">
              One-time fee for document processing, cryptographic hashing, and on-chain attestation NFT creation.
            </p>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
          id="rwa-file-upload"
        />
        <label htmlFor="rwa-file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-white font-medium mb-2">
            Upload RWA Documents
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-xs">
            Supported: PDF, DOC, DOCX, JPG, PNG • Max {maxFileSize}MB per file • Up to {maxFiles} files
          </p>
        </label>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Documents ({documents.length}/{maxFiles})
            </h3>
            {documents.some(doc => doc.status === 'pending') && (
              <button
                onClick={uploadAllDocuments}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Upload All
              </button>
            )}
          </div>

          <div className="space-y-3">
            {documents.map((doc, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1">
                    {getStatusIcon(doc.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white font-medium truncate">
                        {doc.file.name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {(doc.file.size / (1024 * 1024)).toFixed(2)} MB • {getStatusText(doc.status)}
                      </p>
                      {doc.hash && (
                        <p className="text-gray-500 dark:text-gray-500 text-xs font-mono mt-1">
                          Hash: {doc.hash.substring(0, 16)}...
                        </p>
                      )}
                      {doc.error && (
                        <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                          {doc.error}
                        </p>
                      )}
                    </div>
                  </div>
                  {doc.status === 'pending' && (
                    <button
                      onClick={() => removeDocument(index)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Document Type Selector */}
                {doc.status === 'pending' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Document Type
                    </label>
                    <select
                      value={doc.type}
                      onChange={(e) => updateDocumentType(index, e.target.value as RWADocument['type'])}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Upload Progress */}
                {(doc.status === 'uploading' || doc.status === 'hashing') && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        {doc.status === 'hashing' ? 'Generating SHA-256 hash...' : 'Uploading...'}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {doc.uploadProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${doc.uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 dark:text-white font-medium">
                  Total Cost
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} • Includes hashing & attestation
                </p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${totalCost}
              </p>
            </div>
          </div>

          {/* Status Messages */}
          {allComplete && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
                <p className="text-green-900 dark:text-green-100 font-medium">
                  All documents uploaded successfully! RWA attestation NFTs will be created on Sui blockchain.
                </p>
              </div>
            </div>
          )}

          {hasErrors && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
                <p className="text-red-900 dark:text-red-100 font-medium">
                  Some documents failed to upload. Please try again or remove failed documents.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
