import numpy as np
from scipy import signal

CHANNELS = ['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2']
SAMPLE_RATE = 256
BANDS = {'delta': (0.5,4), 'theta': (4,8), 'alpha': (8,13), 'beta': (13,30), 'gamma': (30,100)}

def generate_mock_eeg(duration_sec: float = 5.0) -> dict:
    t = np.linspace(0, duration_sec, int(SAMPLE_RATE * duration_sec))
    data = {}
    for ch in CHANNELS:
        sig = 0.5*np.sin(2*np.pi*10*t) + 0.3*np.sin(2*np.pi*20*t) + 0.2*np.random.randn(len(t))
        data[ch] = sig.tolist()
    return {'channels': CHANNELS, 'sample_rate': SAMPLE_RATE, 'data': data, 'time': t.tolist(), 'duration': duration_sec}

def compute_band_power(channel_data: list, sample_rate: int) -> dict:
    freqs, psd = signal.welch(channel_data, fs=sample_rate, nperseg=256)
    result = {}
    for name, (low, high) in BANDS.items():
        mask = (freqs >= low) & (freqs <= high)
        result[name] = float(np.trapz(psd[mask], freqs[mask])) if mask.any() else 0.0
    return result

def compute_spectrogram(channel_data: list, sample_rate: int) -> dict:
    f, t, Sxx = signal.spectrogram(channel_data, fs=sample_rate, nperseg=128, noverlap=64)
    return {'frequencies': f.tolist(), 'time': t.tolist(), 'power': (10*np.log10(Sxx+1e-10)).tolist()}

def compute_brain_state(channel_data: list, sample_rate: int) -> dict:
    import time
    bands = compute_band_power(channel_data, sample_rate)
    total = sum(bands.values()) + 1e-10
    beta_rel = bands['beta'] / total
    alpha_rel = bands['alpha'] / total
    theta_rel = bands['theta'] / total
    focus = min(100.0, max(0.0, (beta_rel * 300) + np.random.uniform(-5, 5)))
    relaxation = min(100.0, max(0.0, (alpha_rel * 300) + np.random.uniform(-5, 5)))
    fatigue = min(100.0, max(0.0, (theta_rel * 300) + np.random.uniform(-5, 5)))
    scores = {'focused': focus, 'relaxed': relaxation, 'fatigued': fatigue}
    max_score = max(scores.values())
    if max_score < 50:
        status = 'neutral'
        status_label = '平稳'
        status_color = '#757575'
    else:
        status = max(scores, key=scores.get)
        if status == 'focused':
            status_label = '专注'
            status_color = '#1976d2'
        elif status == 'relaxed':
            status_label = '放松'
            status_color = '#388e3c'
        else:
            status_label = '疲劳'
            status_color = '#d32f2f'
    return {
        'focus': round(focus, 1),
        'relaxation': round(relaxation, 1),
        'fatigue': round(fatigue, 1),
        'status': status,
        'statusLabel': status_label,
        'statusColor': status_color,
        'timestamp': int(time.time() * 1000)
    }

BRAIN_REGIONS = {
    'frontal_pole': {'name': '前额', 'channels': ['Fp1', 'Fp2']},
    'frontal': {'name': '额叶', 'channels': ['F3', 'F4']},
    'central': {'name': '中央', 'channels': ['C3', 'C4']},
    'parietal': {'name': '顶叶', 'channels': ['P3', 'P4']},
    'occipital': {'name': '枕叶', 'channels': ['O1', 'O2']},
}

def compute_brain_region_coordination(all_data: dict, sample_rate: int) -> dict:
    region_keys = list(BRAIN_REGIONS.keys())
    region_signals = {}
    for rk, info in BRAIN_REGIONS.items():
        chs = [ch for ch in info['channels'] if ch in all_data]
        if chs:
            region_signals[rk] = np.mean([np.array(all_data[ch]) for ch in chs], axis=0)
    matrix = []
    pairs = []
    for i, rk_a in enumerate(region_keys):
        row = []
        for j, rk_b in enumerate(region_keys):
            if rk_a not in region_signals or rk_b not in region_signals:
                row.append(0.0)
                continue
            sig_a = region_signals[rk_a]
            sig_b = region_signals[rk_b]
            if rk_a == rk_b:
                row.append(1.0)
                continue
            f, coh = signal.coherence(sig_a, sig_b, fs=sample_rate, nperseg=128)
            alpha_mask = (f >= 8) & (f <= 13)
            beta_mask = (f >= 13) & (f <= 30)
            theta_mask = (f >= 4) & (f <= 8)
            alpha_coh = float(np.mean(coh[alpha_mask])) if alpha_mask.any() else 0.0
            beta_coh = float(np.mean(coh[beta_mask])) if beta_mask.any() else 0.0
            theta_coh = float(np.mean(coh[theta_mask])) if theta_mask.any() else 0.0
            overall_coh = float(np.mean(coh)) * 2.5
            overall_coh = min(1.0, max(0.0, overall_coh))
            row.append(round(overall_coh, 4))
            if i < j:
                corr = float(np.corrcoef(sig_a, sig_b)[0, 1])
                pairs.append({
                    'regionA': rk_a,
                    'regionAName': BRAIN_REGIONS[rk_a]['name'],
                    'regionB': rk_b,
                    'regionBName': BRAIN_REGIONS[rk_b]['name'],
                    'overall': round(overall_coh, 4),
                    'alpha': round(alpha_coh, 4),
                    'beta': round(beta_coh, 4),
                    'theta': round(theta_coh, 4),
                    'correlation': round(corr, 4),
                })
        matrix.append(row)
    return {
        'regions': [{'key': rk, 'name': info['name'], 'channels': info['channels']} for rk, info in BRAIN_REGIONS.items()],
        'matrix': matrix,
        'pairs': pairs,
        'timestamp': int(np.datetime64('now', 'ms').astype(int)),
    }

def compute_coordination_trend(all_data: dict, sample_rate: int, window_sec: float = 1.0) -> dict:
    region_keys = list(BRAIN_REGIONS.keys())
    n_samples = len(next(iter(all_data.values())))
    window_size = int(sample_rate * window_sec)
    n_windows = max(1, n_samples // window_size)
    trend_points = []
    for w in range(n_windows):
        start = w * window_size
        end = min(start + window_size, n_samples)
        region_signals = {}
        for rk, info in BRAIN_REGIONS.items():
            chs = [ch for ch in info['channels'] if ch in all_data]
            if chs:
                region_signals[rk] = np.mean([np.array(all_data[ch][start:end]) for ch in chs], axis=0)
        point = {'time': round(w * window_sec, 1)}
        for i, rk_a in enumerate(region_keys):
            for j, rk_b in enumerate(region_keys):
                if i >= j:
                    continue
                if rk_a not in region_signals or rk_b not in region_signals:
                    point[f'{rk_a}_{rk_b}'] = 0.0
                    continue
                sig_a = region_signals[rk_a]
                sig_b = region_signals[rk_b]
                if len(sig_a) < 32 or len(sig_b) < 32:
                    point[f'{rk_a}_{rk_b}'] = 0.0
                    continue
                f, coh = signal.coherence(sig_a, sig_b, fs=sample_rate, nperseg=min(64, len(sig_a)))
                overall_coh = float(np.mean(coh)) * 2.5
                point[f'{rk_a}_{rk_b}'] = round(min(1.0, max(0.0, overall_coh)), 4)
        trend_points.append(point)
    pairs_info = []
    for i, rk_a in enumerate(region_keys):
        for j, rk_b in enumerate(region_keys):
            if i < j:
                pairs_info.append({
                    'key': f'{rk_a}_{rk_b}',
                    'regionA': rk_a,
                    'regionAName': BRAIN_REGIONS[rk_a]['name'],
                    'regionB': rk_b,
                    'regionBName': BRAIN_REGIONS[rk_b]['name'],
                })
    return {'trend': trend_points, 'pairs': pairs_info}

def compute_correlation(target_channel: str, all_data: dict, sample_rate: int) -> dict:
    target_data = np.array(all_data[target_channel])
    correlations = []
    for ch in CHANNELS:
        if ch == target_channel:
            correlations.append({
                'channel': ch,
                'targetChannel': target_channel,
                'correlation': 1.0,
                'coherence': 1.0
            })
            continue
        ch_data = np.array(all_data[ch])
        corr = float(np.corrcoef(target_data, ch_data)[0, 1])
        f, coh = signal.coherence(target_data, ch_data, fs=sample_rate, nperseg=128)
        alpha_mask = (f >= 8) & (f <= 13)
        mean_coh = float(np.mean(coh[alpha_mask])) if alpha_mask.any() else 0.0
        correlations.append({
            'channel': ch,
            'targetChannel': target_channel,
            'correlation': round(corr, 4),
            'coherence': round(mean_coh, 4)
        })
    return {'targetChannel': target_channel, 'correlations': correlations}
