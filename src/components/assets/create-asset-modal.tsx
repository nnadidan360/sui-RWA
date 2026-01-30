'use client';

import { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  MapPin, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { AssetFormData, AssetType, DocumentType, FileUpload } from '@/types/assets';

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const assetTypeOptions: { value: AssetType; label: string; description: string }[] = [
  { 
    value: 'real_estate', 
    label: 'Real Estate', 
    description: 'Properties, land, buildings' 
  },
  { 
    value: 'commodity', 
    label: 'Commodity', 
    description: 'Gold, oil, agricultural products' 
  },
  { 
    value: 'invoice', 
    label: 'Invoice', 
    description: 'Trade receivables, payment obligations' 
  },
  { 
    value: 'equipment', 
    label: 'Equipment', 
    description: 'Machinery, vehicles, tools' 
  },
  { 
    value: 'other', 
    label: 'Other', 
    description: 'Custom asset types' 
  },
];

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'deed', label: 'Deed/Title' },
  { value: 'appraisal', label: 'Appraisal Report' },
  { value: 'insurance', label: 'Insurance Policy' },
  { value: 'permit', label: 'Permit/License' },
  { value: 'other', label: 'Other Document' },
];

export function CreateAssetModal({ isOpen, onClose }: CreateAssetModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<AssetFormData>({
    assetType: 'real_estate',
    title: '',
    description: '',
    valuation: {
      amount: 0,
      currency: 'USD',
    },
  });

  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([]);

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof AssetFormData] as any),
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const newFiles: FileUpload[] = selectedFiles.map(file => ({
      file,
      type: 'other',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const updateFileType = (index: number, type: DocumentType) => {
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, type } : file
    ));
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.assetType && formData.title && formData.description && email && email.includes('@'));
      case 2:
        return formData.valuation.amount > 0;
      case 3:
        return files.length > 0 && files.every(f => f.type !== 'other');
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      setError(null);
    } else {
      setError('Please fill in all required fields');
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create asset via API
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          assetType: formData.assetType,
          name: formData.title,
          description: formData.description,
          location: formData.location?.address || '',
          valuation: formData.valuation.amount,
          currency: formData.valuation.currency,
          documents: files.map(f => ({
            name: f.file.name,
            type: f.type,
            size: f.file.size
          }))
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create asset');
      }
      
      // Close modal and reset form
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      assetType: 'real_estate',
      title: '',
      description: '',
      valuation: {
        amount: 0,
        currency: 'USD',
      },
    });
    setEmail('');
    setFiles([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80" onClick={onClose} />
        
        <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tokenize Asset</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Step {currentStep} of 3: {
                  currentStep === 1 ? 'Asset Details' :
                  currentStep === 2 ? 'Valuation' : 'Documentation'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step < currentStep 
                      ? 'bg-green-500 text-gray-900 dark:text-white' 
                      : step === currentStep 
                      ? 'bg-blue-500 text-gray-900 dark:text-white' 
                      : 'bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
                <span className="text-red-400">{error}</span>
              </div>
            )}

            {/* Step 1: Asset Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Asset Type *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assetTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleInputChange('assetType', option.value)}
                        className={`p-4 text-left border rounded-xl transition-all duration-200 ${
                          formData.assetType === option.value
                            ? 'border-blue-500 bg-blue-500/10 text-gray-900 dark:text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-gray-500 text-xs mt-2">
                    Required for asset collateralization and verification notifications
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Asset Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter a descriptive title for your asset"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Provide detailed information about your asset"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location (Optional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <input
                      type="text"
                      value={formData.location?.address || ''}
                      onChange={(e) => handleInputChange('location.address', e.target.value)}
                      placeholder="Enter asset location"
                      className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Valuation */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Asset Value *
                  </label>
                  <div className="flex space-x-3">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <input
                        type="number"
                        value={formData.valuation.amount || ''}
                        onChange={(e) => handleInputChange('valuation.amount', Number(e.target.value))}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={formData.valuation.currency}
                      onChange={(e) => handleInputChange('valuation.currency', e.target.value)}
                      className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CSPR">CSPR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Appraiser (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.valuation.appraiser || ''}
                    onChange={(e) => handleInputChange('valuation.appraiser', e.target.value)}
                    placeholder="Name of certified appraiser"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-400">Valuation Guidelines</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        Provide the current market value of your asset. This will be used to determine 
                        loan-to-value ratios and collateral requirements. Professional appraisals are 
                        recommended for high-value assets.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Documentation */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Upload Documents *
                  </label>
                  
                  {/* File Upload Area */}
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-900 dark:text-white font-medium mb-2">Upload Asset Documents</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Drag and drop files here, or click to browse
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        Supported: PDF, DOC, DOCX, JPG, PNG (Max 10MB each)
                      </p>
                    </label>
                  </div>

                  {/* Uploaded Files */}
                  {files.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <h4 className="text-sm font-medium text-gray-300">Uploaded Documents</h4>
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-gray-900 dark:text-white text-sm font-medium">{file.file.name}</p>
                              <p className="text-gray-600 dark:text-gray-400 text-xs">
                                {(file.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <select
                              value={file.type}
                              onChange={(e) => updateFileType(index, e.target.value as DocumentType)}
                              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {documentTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeFile(index)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-400">Document Requirements</h4>
                      <p className="text-sm text-gray-300 mt-1">
                        Upload relevant documents such as deeds, appraisal reports, insurance policies, 
                        or permits. All documents will be stored securely on IPFS and verified by our team.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={loading || !validateStep(currentStep)}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !validateStep(3)}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? 'Creating...' : 'Create Asset'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}