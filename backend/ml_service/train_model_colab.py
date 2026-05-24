"""
RiftSense Robust Seismic ML Training Script
-------------------------------------------
This version fixes the IRIS/EarthScope connection issues and 
uses more reliable seismic stations.
"""

# 1. INSTALL LIBRARIES
!pip install obspy --quiet

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from sklearn.model_selection import train_test_split
from obspy import UTCDateTime
from obspy.clients.fdsn import Client
import matplotlib.pyplot as plt

# 2. UPDATED DATA ACQUISITION
def fetch_robust_seismic_data(n_events=50, sequence_length=600):
    # Updated to 'EARTHSCOPE' (formerly IRIS)
    client = Client("EARTHSCOPE")
    X, y = [], []

    print("Searching for real earthquake events...")
    try:
        # Search for recent earthquakes globally (magnitude 5.0+)
        # This is more reliable than searching a specific small region
        starttime = UTCDateTime.now() - (365 * 24 * 3600) # Last year
        endtime = UTCDateTime.now()
        
        cat = client.get_events(starttime=starttime, endtime=endtime, 
                                minmagnitude=5.0, limit=n_events)
        
        events_found = 0
        stations = ["PASC", "ANMO", "BBR", "SBC"] # Try multiple stations
        
        for event in cat:
            if events_found >= n_events: break
            otime = event.origins[0].time
            
            # Attempt to fetch from different stations until one works
            for sta in stations:
                try:
                    # Search for any broadband vertical channel (HHZ, BHZ, EHZ)
                    st = client.get_waveforms("*", sta, "*", "*HZ", otime, otime + 60)
                    if len(st) > 0:
                        tr = st[0]
                        tr.filter('highpass', freq=1.0)
                        data = tr.data
                        
                        if len(data) >= sequence_length:
                            # Normalize
                            segment = data[:sequence_length].astype(np.float32)
                            segment = (segment - np.mean(segment)) / (np.max(np.abs(segment)) + 1e-6)
                            X.append(segment)
                            y.append(1)
                            events_found += 1
                            print(f"[{events_found}] Fetched event from station {sta} at {otime}")
                            break # Found data for this event, move to next event
                except:
                    continue
                    
    except Exception as e:
        print(f"Error during event search: {e}")

    # Fetch Real Background Noise
    print("\nFetching real background noise...")
    try:
        noise_time = UTCDateTime("2024-01-01T00:00:00")
        for sta in stations:
            try:
                st_n = client.get_waveforms("*", sta, "*", "*HZ", noise_time, noise_time + 1200)
                if len(st_n) > 0:
                    noise_data = st_n[0].data
                    for i in range(events_found):
                        start = i * sequence_length
                        if start + sequence_length <= len(noise_data):
                            segment = noise_data[start:start+sequence_length].astype(np.float32)
                            segment = (segment - np.mean(segment)) / (np.max(np.abs(segment)) + 1e-6)
                            X.append(segment)
                            y.append(0)
                    print(f"Successfully fetched background noise from {sta}")
                    break
            except:
                continue
    except:
        pass

    return np.array(X).reshape(-1, sequence_length, 1), np.array(y)

# 3. HIGH-QUALITY SYNTHETIC GENERATOR (Advanced Fallback)
# This mimics the P-wave and S-wave patterns of a real quake
def generate_advanced_seismic_synthetic(n=500):
    X, y = [], []
    t = np.linspace(0, 60, 600)
    for _ in range(n):
        is_quake = np.random.choice([0, 1])
        if is_quake:
            # P-wave (Small, fast)
            p_arrival = np.random.randint(50, 150)
            # S-wave (Large, slow)
            s_arrival = p_arrival + np.random.randint(50, 150)
            
            signal = np.zeros(600)
            # P-wave component
            signal[p_arrival:] += 0.2 * np.sin(2*np.pi*8*t[p_arrival:]) * np.exp(-0.3*(t[p_arrival:]-t[p_arrival]))
            # S-wave component
            signal[s_arrival:] += 1.0 * np.sin(2*np.pi*3*t[s_arrival:]) * np.exp(-0.1*(t[s_arrival:]-t[s_arrival]))
            
            signal += np.random.normal(0, 0.05, 600)
            y.append(1)
        else:
            # Cultural noise (Lower frequency spikes)
            signal = np.random.normal(0, 0.08, 600)
            if np.random.random() > 0.7:
                spike = np.random.randint(0, 500)
                signal[spike:spike+20] += np.random.normal(0, 0.3, 20)
            y.append(0)
        X.append(signal)
    return np.array(X).reshape(-1, 600, 1), np.array(y)

# START
print("--- RiftSense Data Loader ---")
X, y = fetch_robust_seismic_data(n_events=100)

if len(X) < 10:
    print("\n[!] Connection to EarthScope timed out or no data found.")
    print("[!] Using Advanced Seismic Waveform Generator (mimics P/S wave patterns).")
    X, y = generate_advanced_seismic_synthetic(1000)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# 4. MODEL & TRAINING
model = models.Sequential([
    layers.Input(shape=(600, 1)),
    layers.Conv1D(32, 10, activation='relu'),
    layers.MaxPooling1D(2),
    layers.Conv1D(64, 5, activation='relu'),
    layers.GlobalAveragePooling1D(),
    layers.Dense(32, activation='relu'),
    layers.Dense(1, activation='sigmoid')
])

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
print("\nTraining Model...")
model.fit(X_train, y_train, epochs=15, batch_size=32, validation_split=0.2)
model.save('seismic_model.h5')
print("\nFINISHED: 'seismic_model.h5' is ready.")
