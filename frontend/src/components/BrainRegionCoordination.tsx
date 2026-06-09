import React, { useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import { useEEGStore } from '../store/eeg';
import { BrainRegionCoordinationData, CoordinationTrendData } from '../types';

const API_BASE = 'http://localhost:8000/api/eeg';

const PAIR_COLORS = [
  '#e53935', '#8e24aa', '#1e88e5', '#00897b', '#43a047',
  '#f4511e', '#6d4c41', '#3949ab', '#00acc1', '#7cb342',
];

const getHeatColor = (value: number): string => {
  if (value >= 0.8) return '#1b5e20';
  if (value >= 0.6) return '#388e3c';
  if (value >= 0.4) return '#fbc02d';
  if (value >= 0.2) return '#f57c00';
  return '#c62828';
};

const getHeatBg = (value: number): string => {
  if (value >= 0.8) return 'rgba(27,94,32,0.15)';
  if (value >= 0.6) return 'rgba(56,142,60,0.12)';
  if (value >= 0.4) return 'rgba(251,192,45,0.12)';
  if (value >= 0.2) return 'rgba(245,124,0,0.12)';
  return 'rgba(198,40,40,0.12)';
};

const getStrengthLabel = (value: number): string => {
  if (value >= 0.8) return '极强';
  if (value >= 0.6) return '强';
  if (value >= 0.4) return '中等';
  if (value >= 0.2) return '弱';
  return '极弱';
};

const HeatmapCanvas: React.FC<{ data: BrainRegionCoordinationData }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { regions, matrix } = data;
  const n = regions.length;
  const cellSize = 56;
  const labelWidth = 48;
  const padding = 4;
  const totalSize = labelWidth + n * cellSize + padding;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalSize * dpr;
    canvas.height = totalSize * dpr;
    canvas.style.width = `${totalSize}px`;
    canvas.style.height = `${totalSize}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalSize, totalSize);

    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {
      ctx.fillStyle = '#555';
      ctx.fillText(regions[i].name, labelWidth + i * cellSize + cellSize / 2, labelWidth / 2);
      ctx.fillText(regions[i].name, labelWidth / 2, labelWidth + i * cellSize + cellSize / 2);
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j];
        const x = labelWidth + j * cellSize + padding / 2;
        const y = labelWidth + i * cellSize + padding / 2;
        const size = cellSize - padding;
        ctx.fillStyle = getHeatColor(val);
        ctx.globalAlpha = i === j ? 0.25 : 0.85;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 4);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = i === j ? '#999' : '#fff';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(val.toFixed(2), x + size / 2, y + size / 2);
      }
    }
  }, [data, n, matrix, regions, totalSize]);

  return <canvas ref={canvasRef} />;
};

export const BrainRegionCoordination: React.FC = () => {
  const {
    brainRegionCoordination,
    coordinationTrend,
    setBrainRegionCoordination,
    setCoordinationTrend,
    isStreaming,
    playbackMode,
  } = useEEGStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCoordination = useCallback(async () => {
    try {
      const [coordRes, trendRes] = await Promise.all([
        axios.get(`${API_BASE}/brain-region-coordination?duration=5.0`),
        axios.get(`${API_BASE}/coordination-trend?duration=5.0&window=1.0`),
      ]);
      setBrainRegionCoordination(coordRes.data);
      setCoordinationTrend(trendRes.data);
    } catch {}
  }, [setBrainRegionCoordination, setCoordinationTrend]);

  useEffect(() => {
    if (isStreaming && !playbackMode) {
      fetchCoordination();
      intervalRef.current = setInterval(fetchCoordination, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming, playbackMode, fetchCoordination]);

  if (!brainRegionCoordination) {
    return (
      <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🧩</span>
          <span>脑区协同分析</span>
          <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>区域间联动强弱与变化趋势</span>
        </h3>
        <div style={{ color: '#999', padding: '40px 0', textAlign: 'center' }}>开始数据流后显示脑区协同数据...</div>
      </div>
    );
  }

  const { regions, matrix, pairs } = brainRegionCoordination;
  const topPairs = [...pairs].sort((a, b) => b.overall - a.overall).slice(0, 3);

  const trendChartData = coordinationTrend
    ? coordinationTrend.trend.map((pt) => {
        const item: Record<string, number | string> = { time: `${pt.time}s` };
        for (const pair of coordinationTrend.pairs) {
          item[`${pair.regionAName}-${pair.regionBName}`] = (pt[pair.key] as number) ?? 0;
        }
        return item;
      })
    : [];

  const trendLines = coordinationTrend
    ? coordinationTrend.pairs.map((p, i) => ({
        dataKey: `${p.regionAName}-${p.regionBName}`,
        color: PAIR_COLORS[i % PAIR_COLORS.length],
      }))
    : [];

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>🧩</span>
        <span>脑区协同分析</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>区域间联动强弱与变化趋势</span>
      </h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>协同强度矩阵</div>
          <HeatmapCanvas data={brainRegionCoordination} />
        </div>

        <div style={{ flex: '1 1 240px', minWidth: '240px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>最强联动脑区对</div>
          {topPairs.map((pair, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                marginBottom: '8px',
                borderRadius: '8px',
                background: getHeatBg(pair.overall),
                border: `1px solid ${getHeatColor(pair.overall)}40`,
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: getHeatColor(pair.overall),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '14px', fontWeight: 700,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>
                  {pair.regionAName} ↔ {pair.regionBName}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                  协同强度: <span style={{ color: getHeatColor(pair.overall), fontWeight: 700 }}>{getStrengthLabel(pair.overall)}</span>
                  {' '}({(pair.overall * 100).toFixed(1)}%)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#888' }}>Alpha</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1565c0' }}>{(pair.alpha * 100).toFixed(1)}%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#888' }}>Beta</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e65100' }}>{(pair.beta * 100).toFixed(1)}%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#888' }}>Theta</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#6a1b9a' }}>{(pair.theta * 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px', lineHeight: 1.6 }}>
            {regions.map((r) => (
              <span key={r.key} style={{ marginRight: '8px' }}>
                {r.name}({r.channels.join('/')})
              </span>
            ))}
          </div>
        </div>
      </div>

      {coordinationTrend && trendChartData.length > 1 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>协同变化趋势</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendChartData}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}%`, name]}
                contentStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {trendLines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
