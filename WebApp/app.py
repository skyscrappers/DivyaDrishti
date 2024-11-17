from flask import Flask, render_template, request, jsonify
import os
import requests
from pydub import AudioSegment

app = Flask(__name__)

UPLOAD_FOLDER_IMAGES = 'uploads/images'
UPLOAD_FOLDER_AUDIO = 'uploads/audio'
os.makedirs(UPLOAD_FOLDER_IMAGES, exist_ok=True)
os.makedirs(UPLOAD_FOLDER_AUDIO, exist_ok=True)

@app.route('/')
def index():
    return render_template('combined.html')

@app.route('/save_data', methods=['POST'])
def save_data():
    try:
        if 'image' not in request.files or 'audio' not in request.files:
            print('Missing image or audio file in request')
            return jsonify({'error': 'Missing image or audio file in request'}), 400

        image_file = request.files['image']
        audio_file = request.files['audio']

        image_path = os.path.join(UPLOAD_FOLDER_IMAGES, 'photo.png')
        audio_filename = audio_file.filename
        audio_path = os.path.join(UPLOAD_FOLDER_AUDIO, audio_filename)

        image_file.save(image_path)
        audio_file.save(audio_path)

        # Convert the audio file to WAV format
        wav_audio_path = os.path.join(UPLOAD_FOLDER_AUDIO, 'recording.wav')
        audio = AudioSegment.from_file(audio_path)
        audio.export(wav_audio_path, format='wav')

        # Update the audio_path to point to the WAV file
        audio_path = wav_audio_path

        response = make_api_call(image_path, audio_path)
        return jsonify(response)
    except Exception as e:
        print(f"Error processing request: {e}")
        return jsonify({'error': str(e)}), 400

def make_api_call(image_path, audio_path):
    with open(image_path, 'rb') as image_file, open(audio_path, 'rb') as audio_file:
        files = {
            'image': image_file,
            'audio': audio_file
        }
        response = requests.post('https://10.212.133.13:8000/run_conversation', files=files, verify=False)
        return response.json()

if __name__ == '__main__':
    app.run(debug=True)
