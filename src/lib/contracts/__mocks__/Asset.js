/**
 * Mock Asset model for testing
 */

// Store for mock data
let mockAssets = [];
let mockIdCounter = 1;

class Asset {
  constructor(data) {
    Object.assign(this, data);
    this._id = data._id || `asset_${mockIdCounter++}`;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  async save() {
    this.updatedAt = new Date();
    const existingIndex = mockAssets.findIndex(asset => asset._id === this._id);
    if (existingIndex >= 0) {
      mockAssets[existingIndex] = this;
    } else {
      mockAssets.push(this);
    }
    return this;
  }

  static async findById(id) {
    return mockAssets.find(asset => asset._id === id) || null;
  }

  static async find(query = {}) {
    if (Object.keys(query).length === 0) {
      return [...mockAssets];
    }
    
    return mockAssets.filter(asset => {
      return Object.keys(query).every(key => {
        if (key === 'owner') {
          return asset.owner === query[key];
        }
        return asset[key] === query[key];
      });
    });
  }

  static async findOne(query = {}) {
    const results = await Asset.find(query);
    return results[0] || null;
  }

  static async create(data) {
    const asset = new Asset(data);
    await asset.save();
    return asset;
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const asset = await Asset.findById(id);
    if (!asset) {
      return null;
    }
    
    Object.assign(asset, update);
    asset.updatedAt = new Date();
    
    if (options.new !== false) {
      await asset.save();
    }
    
    return asset;
  }

  static async findByIdAndDelete(id) {
    const assetIndex = mockAssets.findIndex(asset => asset._id === id);
    if (assetIndex >= 0) {
      const deletedAsset = mockAssets.splice(assetIndex, 1)[0];
      return deletedAsset;
    }
    return null;
  }

  // Clear all mock data - this is what was missing!
  static clearMocks() {
    mockAssets = [];
    mockIdCounter = 1;
  }

  // Helper method to get all mock data for testing
  static getMockData() {
    return [...mockAssets];
  }

  // Helper method to set mock data for testing
  static setMockData(data) {
    mockAssets = [...data];
  }
}

module.exports = { Asset };