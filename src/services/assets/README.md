# RWA Asset Intelligence Services

This directory contains services for processing, verifying, and attesting Real World Assets (RWA) in the Credit OS platform.

## Services Overview

### Document Processing
- **DocumentHashingService**: Cryptographic hashing (SHA-256) for document integrity
- **MetadataExtractionService**: Extract metadata from PDFs, images, and text files
- **DocumentUploadService**: Upload, validate, and store documents with GridFS and IPFS

### Asset Verification
- **AssetConfidenceScoringService**: Calculate confidence scores (0-100) based on 7 weighted factors
- **AssetVerificationService**: Complete verification workflow with manual approval/rejection
- **JurisdictionValidationService**: Validate assets across 18+ jurisdictions with specific requirements

### Blockchain Attestation
- **AttestationMintingService**: Mint RWA attestation NFTs on Sui blockchain
- **RWAAttestationIntegrationService**: Orchestrate document upload to on-chain attestation

## RWA Attestation NFTs

### Move Smart Contract
Location: `sui backend/contracts/sources/rwa_asset.move`

The `RWAAttestationObject` is an NFT that represents a verified real-world asset on the Sui blockchain:

```move
struct RWAAttestationObject {
  id: UID,
  internal_asset_id: String,
  owner_account_id: String,
  asset_type: String,
  jurisdiction_code: String,
  document_hashes: vector<DocumentHash>,
  confidence_score: u64,
  verification_status: u8,
  verified_by: String,
  created_at: u64,
  verified_at: u64,
  last_updated: u64,
  metadata_uri: String,
}
```

### Supported Asset Types
- Property (real estate)
- Vehicle
- Equipment
- Invoice
- Receivable
- Inventory
- Intellectual Property
- Commodity
- Other

### Supported Jurisdictions
**Fully Supported**: US, UK, CA, AU, DE, SG  
**Partially Supported**: FR, JP, CH, NL, SE, NO, DK, ES, IT, BE, AT, IE, NZ, KR, HK, AE, IN, BR, MX

### Document Types
- Deed
- Title
- Registration
- Invoice
- Appraisal
- Inspection
- Insurance
- Tax Document
- Ownership Proof
- Other

## Confidence Scoring Algorithm

The confidence score (0-100) is calculated using weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Document Quality | 20% | File types, completeness, required documents |
| Verification Status | 25% | Manual verification, approval status |
| Registry Match | 20% | Match with external registries |
| Duplicate Check | 15% | No duplicate assets detected |
| Metadata Completeness | 10% | All required fields present |
| Jurisdiction Validity | 5% | Valid jurisdiction with support |
| Document Age | 5% | Recency of documents |

## Usage Example

```typescript
import {
  AttestationMintingService,
  RWAAttestationIntegrationService,
  AssetConfidenceScoringService,
  JurisdictionValidationService,
} from './services/assets';
import { SuiClient } from '@mysten/sui.js/client';

// Initialize services
const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
const attestationService = new AttestationMintingService(
  suiClient,
  'PACKAGE_ID',
  '0x6' // Clock object
);

const scoringService = new AssetConfidenceScoringService();
const jurisdictionService = new JurisdictionValidationService();

const integrationService = new RWAAttestationIntegrationService(
  attestationService,
  scoringService,
  jurisdictionService
);

// Create attestation for verified asset
const result = await integrationService.createAttestationForAsset({
  assetId: 'asset_123',
  userId: 'user_456',
  assetType: 'property',
  jurisdiction: 'United States',
  documents: [
    { hash: 'abc123...', type: 'deed', filename: 'property_deed.pdf' },
    { hash: 'def456...', type: 'title', filename: 'title_doc.pdf' },
  ],
  verificationStatus: 'verified',
  registryMatch: true,
});

console.log('Attestation created:', result.attestationId);
console.log('Confidence score:', result.confidenceScore);
```

## Workflow

1. **Document Upload**: User uploads RWA documents
2. **Hashing**: Documents are cryptographically hashed (SHA-256)
3. **Metadata Extraction**: Extract relevant metadata from documents
4. **Duplicate Check**: Verify no duplicate assets exist
5. **Verification**: Manual or automated verification process
6. **Confidence Scoring**: Calculate confidence score based on factors
7. **Attestation Minting**: Create on-chain NFT attestation on Sui
8. **Capability Issuance**: User can now use asset as collateral

## Security Features

- **Cryptographic Hashing**: SHA-256 for document integrity
- **Duplicate Prevention**: Hash-based duplicate detection
- **Jurisdiction Validation**: Country-specific requirements
- **Verification Workflow**: Manual approval for high-value assets
- **On-Chain Attestation**: Immutable blockchain records
- **Revocation Support**: Ability to revoke fraudulent attestations

## Future Enhancements

- IPFS integration for decentralized document storage
- Multi-signature verification for high-value assets
- Oracle integration for real-time asset valuation
- Cross-chain attestation bridging
- Automated registry checks via APIs
