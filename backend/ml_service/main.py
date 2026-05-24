import os
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import tensorflow as tf
from scipy.signal import butter, lfilter

app = FastAPI(title="RiftSense ML Service")

# Model configuration
MODEL_PATH = os.getenv("MODEL_PATH", "seismic_model.h5")
model = None

# Preprocessing parameters
FS = 10.0  # Sampling frequency (10Hz matched to firmware)
LOW_CUT = 0.1 # High-pass filter cut-off

def butter_highpass(cutoff, fs, order=5):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    return b, a

def highpass_filter(data, cutoff, fs, order=5):
    b, a = butter_highpass(cutoff, fs, order=order)
    y = lfilter(b, a, data)
    return y

@app.on_event("startup")
def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = tf.keras.models.load_model(MODEL_PATH)
            print(f"Model loaded from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading model: {e}")
    else:
        print(f"Model file not found at {MODEL_PATH}. Prediction will use dummy logic.")

class PredictionRequest(BaseModel):
    x: List[float]
    y: List[float]
    z: List[float]

@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict")
async def predict(request: PredictionRequest):
    # 1. Convert to numpy array
    try:
        # Calculate magnitude
        x = np.array(request.x)
        y = np.array(request.y)
        z = np.array(request.z)
        
        # Calculate vector magnitude
        magnitudes = np.sqrt(x**2 + y**2 + z**2)
        
        # 2. Preprocess: High-pass filter to remove gravity/DC offset
        filtered = highpass_filter(magnitudes, LOW_CUT, FS)
        
        # 3. Prepare for model (pad/crop to expected sequence length)
        # Assuming model expects 600 samples
        target_length = 600
        if len(filtered) < target_length:
            input_data = np.pad(filtered, (0, target_length - len(filtered)))
        else:
            input_data = filtered[:target_length]
            
        input_data = input_data.reshape(1, target_length, 1)

        # 4. Inference
        if model:
            prediction = model.predict(input_data)
            score = float(prediction[0][0])
            label = "earthquake" if score > 0.5 else "noise"
        else:
            # Dummy logic if model doesn't exist yet
            pga = np.max(np.abs(filtered))
            label = "earthquake" if pga > 0.05 else "noise"
            score = min(pga * 10, 0.99)

        return {
            "prediction": label,
            "confidence": score,
            "details": {
                "pga": float(np.max(np.abs(filtered))),
                "samples_processed": len(filtered)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
