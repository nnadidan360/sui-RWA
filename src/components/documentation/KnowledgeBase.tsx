'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  BookOpen, 
  Play,
  FileText,
  HelpCircle,
  ChevronRight,
  Star
} from 'lucide-react';

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  type: 'article' | 'video' | 'faq' | 'guide' | 'tutorial';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime?: string;
  videoUrl?: string;
  videoDuration?: string;
  lastUpdated: Date;
  popularity: number;
  helpful: number;
  notHelpful: number;
}

export interface KnowledgeBaseProps {
  items: KnowledgeBaseItem[];
  categories: string[];
  onItemClick?: (item: KnowledgeBaseItem) => void;
  showFilters?: boolean;
  showSearch?: boolean;
  maxResults?: number;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  items,
  categories,
  onItemClick,
  showFilters = true,
  showSearch = true,
  maxResults = 50
}) => {
  const { t } = useTranslation('documentation');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'popularity' | 'recent'>('relevance');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Filter and search items
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(item => item.difficulty === selectedDifficulty);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort results
    switch (sortBy) {
      case 'popularity':
        filtered.sort((a, b) => b.popularity - a.popularity);
        break;
      case 'recent':
        filtered.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
      case 'relevance':
      default:
        // For relevance, prioritize exact matches and popular content
        if (searchQuery.trim()) {
          filtered.sort((a, b) => {
            const aExactMatch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0;
            const bExactMatch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0;
            if (aExactMatch !== bExactMatch) return bExactMatch - aExactMatch;
            return b.popularity - a.popularity;
          });
        } else {
          filtered.sort((a, b) => b.popularity - a.popularity);
        }
        break;
    }

    return filtered.slice(0, maxResults);
  }, [items, selectedCategory, selectedType, selectedDifficulty, searchQuery, sortBy, maxResults]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'faq':
        return <HelpCircle className="h-4 w-4" />;
      case 'guide':
      case 'tutorial':
        return <BookOpen className="h-4 w-4" />;
      case 'article':
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const handleItemClick = (item: KnowledgeBaseItem) => {
    if (expandedItem === item.id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(item.id);
      onItemClick?.(item);
    }
  };

  const markHelpful = (itemId: string, helpful: boolean) => {
    // This would typically update the backend
    console.log(`Marked item ${itemId} as ${helpful ? 'helpful' : 'not helpful'}`);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Knowledge Base
        </h2>

        {/* Search */}
        {showSearch && (
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search knowledge base..."
            />
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="article">Articles</option>
                <option value="video">Videos</option>
                <option value="faq">FAQ</option>
                <option value="guide">Guides</option>
                <option value="tutorial">Tutorials</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Difficulty
              </label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="relevance">Relevance</option>
                <option value="popularity">Popularity</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No results found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search terms or filters
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedItem === item.id;
            
            return (
              <div key={item.id} className="p-4">
                <button
                  onClick={() => handleItemClick(item)}
                  className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="flex items-center text-gray-500 dark:text-gray-400">
                          {getTypeIcon(item.type)}
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(item.difficulty)}`}>
                          {item.difficulty}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {item.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{item.category}</span>
                        {item.estimatedReadTime && (
                          <span>{item.estimatedReadTime} read</span>
                        )}
                        {item.videoDuration && (
                          <span>{item.videoDuration} video</span>
                        )}
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3" />
                          <span>{item.popularity}</span>
                        </div>
                      </div>
                    </div>
                    
                    <ChevronRight 
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`} 
                    />
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 ml-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: item.content }} />
                    </div>
                    
                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="mt-4">
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Video Player */}
                    {item.type === 'video' && item.videoUrl && (
                      <div className="mt-4">
                        <div className="aspect-w-16 aspect-h-9">
                          <iframe
                            src={item.videoUrl}
                            title={item.title}
                            className="w-full h-64 rounded-lg"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}

                    {/* Helpful Feedback */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Was this helpful?
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => markHelpful(item.id, true)}
                            className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                          >
                            👍 Yes ({item.helpful})
                          </button>
                          <button
                            onClick={() => markHelpful(item.id, false)}
                            className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                          >
                            👎 No ({item.notHelpful})
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Results Summary */}
      {filteredItems.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredItems.length} of {items.length} results
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;