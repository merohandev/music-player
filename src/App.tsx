import { useState, useRef, useEffect } from 'react';
import './App.css';

// Audio context and nodes for sound processing
interface AudioNodes {
  audioContext: AudioContext | null;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  bassFilter: BiquadFilterNode | null;
  midFilter: BiquadFilterNode | null;
  trebleFilter: BiquadFilterNode | null;
  delayNode: DelayNode | null;
  reverbNode: ConvolverNode | null;
  reverbGain: GainNode | null;
  dryGain: GainNode | null;
}

function App() {
  // State for audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.65);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // State for sound tuning controls
  const [playbackRate, setPlaybackRate] = useState(1.2);
  const [pitch, setPitch] = useState(-5);
  const [reverbAmount, setReverbAmount] = useState(0.4);
  const [eqLow, setEqLow] = useState(6);
  const [eqMid, setEqMid] = useState(2);
  const [eqHigh, setEqHigh] = useState(-3);
  
  // Audio processing nodes
  const audioNodesRef = useRef<AudioNodes>({
    audioContext: null,
    source: null,
    gainNode: null,
    bassFilter: null,
    midFilter: null,
    trebleFilter: null,
    delayNode: null,
    reverbNode: null,
    reverbGain: null,
    dryGain: null
  });
  
  // Audio buffer for the track
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  // Initialize audio context and load audio file
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioNodesRef.current.audioContext = audioContext;

        // Load audio file from public directory
        const response = await fetch('/audio/demo.mp3');
        if (!response.ok) {
          throw new Error(`Failed to load audio file: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        setAudioBuffer(audioBuffer);
        setDuration(audioBuffer.duration);

        // Create audio processing nodes
        const nodes = createAudioNodes(audioContext);

        // Store nodes
        audioNodesRef.current.gainNode = nodes.gainNode;
        audioNodesRef.current.bassFilter = nodes.bassFilter;
        audioNodesRef.current.midFilter = nodes.midFilter;
        audioNodesRef.current.trebleFilter = nodes.trebleFilter;
        audioNodesRef.current.delayNode = nodes.delayNode;
        audioNodesRef.current.reverbNode = nodes.reverbNode;
        audioNodesRef.current.reverbGain = nodes.reverbGain;
        audioNodesRef.current.dryGain = nodes.dryGain;

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing audio:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load audio file');
        setIsLoading(false);
      }
    };

    initializeAudio();
  }, []);

  // Create a simple reverb impulse response
  const createReverbImpulse = (audioContext: AudioContext, reverbNode: ConvolverNode) => {
    const sampleRate = audioContext.sampleRate;
    const impulseLength = sampleRate * 0.5; // 0.5 second reverb
    const impulseBuffer = audioContext.createBuffer(2, impulseLength, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulseBuffer.getChannelData(channel);
      
      for (let i = 0; i < impulseLength; i++) {
        // Create a decaying impulse
        const decay = Math.exp(-i / (sampleRate * 0.1));
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
      }
    }

    reverbNode.buffer = impulseBuffer;
  };

  // Create audio processing nodes
  const createAudioNodes = (audioContext: AudioContext) => {
    const gainNode = audioContext.createGain();
    const bassFilter = audioContext.createBiquadFilter();
    const midFilter = audioContext.createBiquadFilter();
    const trebleFilter = audioContext.createBiquadFilter();
    const delayNode = audioContext.createDelay(2.0);
    const reverbNode = audioContext.createConvolver();
    const reverbGain = audioContext.createGain();
    const dryGain = audioContext.createGain();

    // Configure main gain
    gainNode.gain.value = volume;

    // Configure EQ filters
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 320;
    bassFilter.gain.value = eqLow;

    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = eqMid;

    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3200;
    trebleFilter.gain.value = eqHigh;

    // Configure delay and reverb
    delayNode.delayTime.value = 0.1;
    reverbGain.gain.value = reverbAmount;
    dryGain.gain.value = 1 - reverbAmount;

    // Create reverb impulse
    createReverbImpulse(audioContext, reverbNode);

    // Connect processing chain: 
    // source -> gainNode -> bassFilter -> midFilter -> trebleFilter -> split to dry/wet
    gainNode.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    
    // Dry signal path
    trebleFilter.connect(dryGain);
    dryGain.connect(audioContext.destination);
    
    // Wet signal path (reverb)
    trebleFilter.connect(delayNode);
    delayNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(audioContext.destination);

    return {
      gainNode,
      bassFilter,
      midFilter,
      trebleFilter,
      delayNode,
      reverbNode,
      reverbGain,
      dryGain
    };
  };
  // Play/pause functionality
  const togglePlayback = async () => {
    if (!audioNodesRef.current.audioContext || !audioBuffer) return;

    // Resume audio context if suspended (required by modern browsers)
    if (audioNodesRef.current.audioContext.state === 'suspended') {
      await audioNodesRef.current.audioContext.resume();
    }

    if (isPlaying) {
      // Stop playback
      if (audioNodesRef.current.source) {
        audioNodesRef.current.source.stop();
        audioNodesRef.current.source = null;
      }
      // Save current time for resume
      pauseTimeRef.current = currentTime;
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      // Start playback
      const audioContext = audioNodesRef.current.audioContext;
      
      // Recreate audio nodes to ensure they're all from the same context
      const nodes = createAudioNodes(audioContext);
      
      // Update the refs with the new nodes
      audioNodesRef.current.gainNode = nodes.gainNode;
      audioNodesRef.current.bassFilter = nodes.bassFilter;
      audioNodesRef.current.midFilter = nodes.midFilter;
      audioNodesRef.current.trebleFilter = nodes.trebleFilter;
      audioNodesRef.current.delayNode = nodes.delayNode;
      audioNodesRef.current.reverbNode = nodes.reverbNode;
      audioNodesRef.current.reverbGain = nodes.reverbGain;
      audioNodesRef.current.dryGain = nodes.dryGain;
      
      // Create source and connect to the processing chain
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(nodes.gainNode);
      
      // Set playback rate with pitch adjustment
      const pitchRate = Math.pow(2, pitch / 12);
      source.playbackRate.value = playbackRate * pitchRate;
      
      // Start playback
      source.start(0, pauseTimeRef.current);
      audioNodesRef.current.source = source;
      setIsPlaying(true);

      // Update current time
      startTimeRef.current = audioContext.currentTime - pauseTimeRef.current;
      const updateTime = () => {
        if (isPlaying && audioNodesRef.current.source) {
          const elapsed = audioContext.currentTime - startTimeRef.current;
          setCurrentTime(Math.min(elapsed, duration));
          if (elapsed < duration) {
            animationFrameRef.current = requestAnimationFrame(updateTime);
          }
        }
      };
      updateTime();

      // Handle playback end
      source.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        audioNodesRef.current.source = null;
      };
    }
  };

  // Update volume
  useEffect(() => {
    if (audioNodesRef.current.gainNode) {
      audioNodesRef.current.gainNode.gain.value = volume;
    }
  }, [volume]);

  // Update playback rate (handled in pitch effect now)

  // Update EQ settings
  useEffect(() => {
    if (audioNodesRef.current.bassFilter) {
      audioNodesRef.current.bassFilter.gain.value = eqLow;
    }
  }, [eqLow]);

  useEffect(() => {
    if (audioNodesRef.current.midFilter) {
      audioNodesRef.current.midFilter.gain.value = eqMid;
    }
  }, [eqMid]);

  useEffect(() => {
    if (audioNodesRef.current.trebleFilter) {
      audioNodesRef.current.trebleFilter.gain.value = eqHigh;
    }
  }, [eqHigh]);

  // Update reverb
  useEffect(() => {
    if (audioNodesRef.current.reverbGain && audioNodesRef.current.dryGain) {
      audioNodesRef.current.reverbGain.gain.value = reverbAmount;
      audioNodesRef.current.dryGain.gain.value = 1 - reverbAmount;
    }
  }, [reverbAmount]);

  // Update pitch (using playback rate as approximation)
  useEffect(() => {
    if (audioNodesRef.current.source) {
      // Convert semitones to playback rate: 2^(semitones/12)
      const pitchRate = Math.pow(2, pitch / 12);
      audioNodesRef.current.source.playbackRate.value = playbackRate * pitchRate;
    }
  }, [pitch, playbackRate]);

  // Control handlers
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaybackRate(parseFloat(e.target.value));
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPitch(parseFloat(e.target.value));
  };

  const handleReverbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReverbAmount(parseFloat(e.target.value));
  };

  const handleEqLowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEqLow(parseFloat(e.target.value));
  };

  const handleEqMidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEqMid(parseFloat(e.target.value));
  };

  const handleEqHighChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEqHigh(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Create floating particles
  const createParticles = () => {
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push(
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${Math.random() * 4 + 6}s`,
          }}
        />
      );
    }
    return particles;
  };

  return (
    <div className="app-container">
      <div className="background-animation"></div>
      <div className="floating-particles">{createParticles()}</div>
      
      <div className="container">
        <div className="main-title">
          <h1>🎵 Pro Music Player</h1>
          <p>Stream and live-tune your demo track</p>
        </div>
        
        <div className="content-wrapper">
          <div className="glow-effect"></div>
          
          <div className="player-container">
          <div className="album-art">
            <div className="music-icon">🎵</div>
          </div>
          
          <div className="track-info">
            <div className="track-title">
              {isLoading ? 'Loading...' : loadError ? 'Error' : 'Audio Track'}
            </div>
            <div className="track-description">
              {isLoading ? 'Loading audio file...' : loadError ? loadError : 'Ready to play'}
            </div>
          </div>
          
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <div 
              className={`play-button ${isLoading || loadError ? 'disabled' : ''}`} 
              onClick={!isLoading && !loadError ? togglePlayback : undefined}
            >
              <div className="play-icon">
                {isLoading ? '⏳' : loadError ? '❌' : isPlaying ? '⏸' : '▶'}
              </div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
          </div>
          
          <div className="volume-control">
            <div className="volume-icon">🔊</div>
            <div className="volume-slider">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="slider-input"
              />
              <div 
                className="volume-fill"
                style={{ width: `${volume * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="controls-panel">
          <div className="panel-title">Live Sound Tuning</div>
          
          <div className="controls-grid">
            {/* Left Column */}
            <div className="control-group">
              <div className="control-label">
                <div className="control-dot"></div>
                <span>SPEED</span>
              </div>
              <div className="control-slider">
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={playbackRate}
                  onChange={handleSpeedChange}
                  className="slider-input"
                />
                <div 
                  className="slider-fill speed-fill"
                  style={{ width: `${((playbackRate - 0.5) / 1.5) * 100}%` }}
                ></div>
              </div>
              <div className="value-display">{playbackRate.toFixed(1)}x</div>
            </div>
            
            <div className="control-group">
              <div className="control-label">
                <div className="control-dot"></div>
                <span>PITCH</span>
              </div>
              <div className="control-slider">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={pitch}
                  onChange={handlePitchChange}
                  className="slider-input"
                />
                <div 
                  className="slider-fill pitch-fill"
                  style={{ width: `${((pitch + 12) / 24) * 100}%` }}
                ></div>
              </div>
              <div className="value-display">{pitch > 0 ? '+' : ''}{pitch} Semitones</div>
            </div>
            
            <div className="control-group">
              <div className="control-label">
                <div className="control-dot"></div>
                <span>REVERB</span>
              </div>
              <div className="control-slider">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={reverbAmount}
                  onChange={handleReverbChange}
                  className="slider-input"
                />
                <div 
                  className="slider-fill reverb-fill"
                  style={{ width: `${reverbAmount * 100}%` }}
                ></div>
              </div>
              <div className="value-display">{Math.round(reverbAmount * 100)}%</div>
            </div>

            {/* Right Column */}
            <div className="control-group">
              <div className="control-label">
                <div className="control-dot"></div>
                <span>BASS (LOW)</span>
              </div>
              <div className="control-slider">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eqLow}
                  onChange={handleEqLowChange}
                  className="slider-input"
                />
                <div 
                  className="slider-fill bass-fill"
                  style={{ width: `${((eqLow + 12) / 24) * 100}%` }}
                ></div>
              </div>
              <div className="value-display">{eqLow > 0 ? '+' : ''}{eqLow}dB</div>
            </div>
            
            <div className="control-group">
              <div className="control-label">
                <div className="control-dot"></div>
                <span>MID</span>
              </div>
              <div className="control-slider">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eqMid}
                  onChange={handleEqMidChange}
                  className="slider-input"
                />
                <div 
                  className="slider-fill mid-fill"
                  style={{ width: `${((eqMid + 12) / 24) * 100}%` }}
                ></div>
              </div>
              <div className="value-display">{eqMid > 0 ? '+' : ''}{eqMid}dB</div>
            </div>
            
            <div className="control-group">
              <div className="control-label">
                <div className="control-dot"></div>
                <span>TREBLE (HIGH)</span>
              </div>
              <div className="control-slider">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eqHigh}
                  onChange={handleEqHighChange}
                  className="slider-input"
                />
                <div 
                  className="slider-fill treble-fill"
                  style={{ width: `${((eqHigh + 12) / 24) * 100}%` }}
                ></div>
              </div>
              <div className="value-display">{eqHigh > 0 ? '+' : ''}{eqHigh}dB</div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default App;
