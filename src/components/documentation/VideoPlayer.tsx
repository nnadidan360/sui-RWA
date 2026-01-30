'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Settings,
  ChevronDown,
  FileText,
  Languages
} from 'lucide-react';

export interface VideoChapter {
  time: string;
  title: string;
}

export interface VideoLanguage {
  videoUrl: string;
  subtitles: string;
}

export interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  description?: string;
  duration?: string;
  chapters?: VideoChapter[];
  languages?: Record<string, VideoLanguage>;
  transcriptUrl?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  autoPlay?: boolean;
  showControls?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  title,
  description,
  duration,
  chapters = [],
  languages = {},
  transcriptUrl,
  onProgress,
  onComplete,
  autoPlay = false,
  showControls = true
}) => {
  const { t, i18n } = useTranslation('documentation');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [transcript, setTranscript] = useState<string>('');

  // Load transcript
  useEffect(() => {
    if (transcriptUrl) {
      fetch(transcriptUrl)
        .then(response => response.text())
        .then(text => setTranscript(text))
        .catch(error => console.error('Failed to load transcript:', error));
    }
  }, [transcriptUrl]);

  // Update video source when language changes
  useEffect(() => {
    if (languages[selectedLanguage] && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      videoRef.current.src = languages[selectedLanguage].videoUrl;
      videoRef.current.currentTime = currentTime;
    }
  }, [selectedLanguage, languages]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onProgress) {
        const progress = (video.currentTime / video.duration) * 100;
        onProgress(progress);
      }
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onProgress, onComplete]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const jumpToChapter = (timeString: string) => {
    const [minutes, seconds] = timeString.split(':').map(Number);
    const time = minutes * 60 + seconds;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentChapter = () => {
    if (chapters.length === 0) return null;
    
    for (let i = chapters.length - 1; i >= 0; i--) {
      const [minutes, seconds] = chapters[i].time.split(':').map(Number);
      const chapterTime = minutes * 60 + seconds;
      if (currentTime >= chapterTime) {
        return chapters[i];
      }
    }
    return chapters[0];
  };

  const currentChapter = getCurrentChapter();

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      {/* Video Element */}
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          src={languages[selectedLanguage]?.videoUrl || videoUrl}
          className="w-full h-full"
          autoPlay={autoPlay}
          onClick={togglePlay}
        >
          {languages[selectedLanguage]?.subtitles && (
            <track
              kind="subtitles"
              src={languages[selectedLanguage].subtitles}
              srcLang={selectedLanguage}
              default
            />
          )}
        </video>

        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <button
              onClick={togglePlay}
              className="bg-white bg-opacity-90 rounded-full p-4 hover:bg-opacity-100 transition-all"
            >
              <Play className="h-12 w-12 text-black ml-1" />
            </button>
          </div>
        )}

        {/* Current Chapter Overlay */}
        {currentChapter && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
            {currentChapter.title}
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="bg-gray-900 text-white p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={videoDuration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(videoDuration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="p-2 hover:bg-gray-800 rounded"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-gray-800 rounded"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Time Display */}
              <span className="text-sm text-gray-400">
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Chapters */}
              {chapters.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowChapters(!showChapters)}
                    className="flex items-center space-x-1 px-3 py-2 hover:bg-gray-800 rounded text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Chapters</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  
                  {showChapters && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg p-2 w-64 max-h-64 overflow-y-auto">
                      {chapters.map((chapter, index) => (
                        <button
                          key={index}
                          onClick={() => jumpToChapter(chapter.time)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm"
                        >
                          <div className="font-medium">{chapter.title}</div>
                          <div className="text-gray-400 text-xs">{chapter.time}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Language Selection */}
              {Object.keys(languages).length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center space-x-1 px-3 py-2 hover:bg-gray-800 rounded text-sm"
                  >
                    <Languages className="h-4 w-4" />
                    <span>{selectedLanguage.toUpperCase()}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg p-2 w-48">
                      <div className="text-xs text-gray-400 px-3 py-1 border-b border-gray-700 mb-2">
                        Language
                      </div>
                      {Object.keys(languages).map(lang => (
                        <button
                          key={lang}
                          onClick={() => {
                            setSelectedLanguage(lang);
                            setShowSettings(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm ${
                            selectedLanguage === lang ? 'bg-gray-700' : ''
                          }`}
                        >
                          {lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : lang === 'ar' ? 'العربية' : lang}
                        </button>
                      ))}
                      
                      <div className="text-xs text-gray-400 px-3 py-1 border-b border-gray-700 mb-2 mt-2">
                        Speed
                      </div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                        <button
                          key={speed}
                          onClick={() => {
                            changePlaybackSpeed(speed);
                            setShowSettings(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm ${
                            playbackSpeed === speed ? 'bg-gray-700' : ''
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Settings */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-800 rounded"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Info */}
      <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            {description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            {duration && <span>Duration: {duration}</span>}
            {currentChapter && <span>Current: {currentChapter.title}</span>}
          </div>
          
          {transcriptUrl && (
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              <FileText className="h-4 w-4" />
              <span>Transcript</span>
            </button>
          )}
        </div>

        {/* Transcript */}
        {showTranscript && transcript && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Transcript
            </h4>
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {transcript}
            </div>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;