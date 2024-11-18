let barsVisible = true;
let animationInterval;
let model, webcam, labelContainer, maxPredictions;
let mediaRecorder, audioChunks = [];

const synth = window.speechSynthesis;

async function init() {
    const modelURL = "../static/our_model/model.json"; // Update with your model URL
    const metadataURL = "../static/our_model/metadata.json"; // Update with your metadata URL

    // Load the model and metadata
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    // Setup the webcam
    const flip = true; // whether to flip the webcam
    webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
    await webcam.setup(); // request access to the webcam
    await webcam.play();
    window.requestAnimationFrame(loop);

    // Append elements to the DOM
    labelContainer = document.getElementById("label-container");
    for (let i = 0; i < maxPredictions; i++) { // and class labels
        labelContainer.appendChild(document.createElement("div"));
    }
}

async function loop() {
    webcam.update(); // update the webcam frame
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    // Predict can take in an image, video or canvas html element
    const prediction = await model.predict(webcam.canvas);
    for (let i = 0; i < maxPredictions; i++) {

        // Log "hello" if the probability of class 2 is higher than 0.7
        if (prediction[i].className === "Class 2" && prediction[i].probability > 1) {
            // console.log("hello");
            document.getElementById('audio').play();
        }
    }
}

function triggerVQA() {
    toggleBars();
    if (barsVisible) {
        startRecording();
    } else {
        stopRecording();
    }
}

function toggleBars() {
    const barsContainer = document.getElementById('bars-container');
    barsVisible = !barsVisible;
    if (barsVisible) {
        startAnimation();
    } else {
        stopAnimation();
    }
}

function startAnimation() {
    const bars = document.querySelectorAll('.bar');
    animationInterval = setInterval(() => {
        bars.forEach(bar => {
            const height = 10 + Math.random() * 60; // Random height between 10px and 50px
            bar.style.height = `${height}px`;
        });
    }, 200); // Change every 300ms
}

function stopAnimation() {
    clearInterval(animationInterval);
    const bars = document.querySelectorAll('.bar');
    bars.forEach(bar => {
        bar.style.height = '10px'; // Reset height when animation stops
    });
}

function capturePhoto() {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = webcam.canvas.width;
        canvas.height = webcam.canvas.height;
        const context = canvas.getContext('2d');
        context.drawImage(webcam.canvas, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
            resolve(blob);
        }, 'image/png');
    });
}

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let options = { mimeType: 'audio/webm; codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Fallback to a supported MIME type
        options = { mimeType: 'audio/ogg; codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: '' }; // Browser default
        }
    }
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };
    mediaRecorder.start();
    console.log('Recording started with MIME type:', mediaRecorder.mimeType);

    setTimeout(() => {
        stopRecording();
    }, 5000); // Stop recording after 5 seconds
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
            const photoBlob = await capturePhoto();
            sendDataToBackend(photoBlob, audioBlob);
            audioChunks = [];
            console.log('Recording stopped');
        };
    } else {
        console.error('mediaRecorder is not defined');
    }
}

function sendDataToBackend(photoBlob, audioBlob) {
    const formData = new FormData();
    formData.append('image', photoBlob, 'photo.png');
    const extension = getExtensionFromMimeType(audioBlob.type);
    formData.append('audio', audioBlob, `recording.${extension}`);

    console.log('Sending data to backend...');
    console.log('Photo Blob:', photoBlob);
    console.log('Audio Blob:', audioBlob);
    console.log('Audio MIME Type:', audioBlob.type);

    // Log the FormData entries
    for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
        if (value instanceof Blob) {
            console.log(`${key} is a Blob of size:`, value.size);
        }
    }

    fetch('/save_data', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text) });
        }
        return response.json();
    }).then(data => {
        console.log('VQA response:', data);
        const utterance = new SpeechSynthesisUtterance(data.answer);
        synth.speak(utterance);
        // Convert the audio binary back to a Blob and play it
        // const audioBinary = data.audio_binary;
        // const audioBuffer = new Uint8Array(audioBinary.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        // const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
        // const audioUrl = URL.createObjectURL(audioBlob);
        // const audio = new Audio(audioUrl);
        // audio.play();
    }).catch(error => {
        console.error('Error sending data to backend:', error);
    });
}

function getExtensionFromMimeType(mimeType) {
    const mimeExtensions = {
        'audio/webm; codecs=opus': 'webm',
        'audio/ogg; codecs=opus': 'ogg',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        // Add more mappings if necessary
    };
    return mimeExtensions[mimeType] || 'dat';
}

// Automatically request permissions and initialize the model
requestPermissions();

async function requestPermissions() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        init();
    } catch (err) {
        alert("Webcam access is required to use this application.");
    }
}