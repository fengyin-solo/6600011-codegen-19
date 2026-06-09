export interface EEGData { channels: string[]; sample_rate: number; data: Record<string, number[]>; time: number[]; duration: number; }
export interface BandPower { delta: number; theta: number; alpha: number; beta: number; gamma: number; }
export interface BrainState {
  focus: number;
  relaxation: number;
  fatigue: number;
  status: 'focused' | 'relaxed' | 'fatigued' | 'neutral';
  statusLabel: string;
  statusColor: string;
  timestamp: number;
}
export interface ChannelCorrelation {
  channel: string;
  targetChannel: string;
  correlation: number;
  coherence: number;
}
export interface CorrelationData {
  targetChannel: string;
  correlations: ChannelCorrelation[];
}

export interface BrainRegion {
  key: string;
  name: string;
  channels: string[];
}
export interface RegionPairCoordination {
  regionA: string;
  regionAName: string;
  regionB: string;
  regionBName: string;
  overall: number;
  alpha: number;
  beta: number;
  theta: number;
  correlation: number;
}
export interface BrainRegionCoordinationData {
  regions: BrainRegion[];
  matrix: number[][];
  pairs: RegionPairCoordination[];
  timestamp: number;
}
export interface CoordinationTrendPair {
  key: string;
  regionA: string;
  regionAName: string;
  regionB: string;
  regionBName: string;
}
export interface CoordinationTrendData {
  trend: Record<string, number>[];
  pairs: CoordinationTrendPair[];
}

export interface RecordingFrame {
  relativeTime: number;
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
}

export interface Recording {
  id: string;
  name: string;
  channel: string;
  startTime: number;
  endTime: number;
  duration: number;
  frames: RecordingFrame[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentFrame: RecordingFrame | null;
}
