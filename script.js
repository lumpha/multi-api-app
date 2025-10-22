// ======= GLOBAL CORS PROXY =====
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// ======= FILE CONVERSION (CloudConvert) =====
const cloudConvertApiKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...'; // Your key
document.getElementById('convertBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const format = document.getElementById('convertFormat').value;
    const status = document.getElementById('convertStatus');
    const downloadLink = document.getElementById('downloadLink');

    if (!fileInput.files.length) return alert('Select a file!');

    status.textContent = 'Uploading and converting...';
    downloadLink.style.display = 'none';

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        // Import file (CloudConvert API)
        const importRes = await fetch(`${CORS_PROXY}https://api.cloudconvert.com/v2/import/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cloudConvertApiKey}`
            },
            body: formData
        });
        const importData = await importRes.json();
        const uploadUrl = importData.data?.url;

        if (!uploadUrl) throw new Error('Upload failed');

        // Convert task
        const convertRes = await fetch(`${CORS_PROXY}https://api.cloudconvert.com/v2/convert`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cloudConvertApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: uploadUrl,
                input_format: file.name.split('.').pop(),
                output_format: format
            })
        });
        const convertData = await convertRes.json();
        const fileUrl = convertData.data?.output?.url;

        if (!fileUrl) throw new Error('Conversion failed');

        downloadLink.href = fileUrl;
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download Converted File';
        status.textContent = 'Conversion done!';
    } catch (err) {
        console.error(err);
        status.textContent = 'Error: ' + err.message;
    }
});

// ======= TEXT TRANSLATION =====
document.getElementById('translateBtn').addEventListener('click', async () => {
    const text = document.getElementById('sourceText').value;
    const lang = document.getElementById('targetLang').value;
    const output = document.getElementById('translatedText');
    if (!text || !lang) return alert('Enter text and target language!');

    try {
        const res = await fetch(`${CORS_PROXY}https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
        const data = await res.json();
        output.textContent = data.responseData.translatedText;
    } catch (err) {
        console.error(err);
        output.textContent = 'Translation failed';
    }
});

// ======= TEXT-TO-SPEECH =====
const ttsApiKey = '2287ae7a98da100f650b9ada0614bdcc'; // Your TTS API key
document.getElementById('speakBtn').addEventListener('click', async () => {
    const text = document.getElementById('speechText').value;
    const audio = document.getElementById('audioPlayer');
    if (!text) return alert('Enter text for speech');

    try {
        const res = await fetch(`${CORS_PROXY}https://api.faketts.com/speak`, { // Replace with actual TTS endpoint
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ttsApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        const blob = await res.blob();
        audio.src = URL.createObjectURL(blob);
        audio.play();
    } catch (err) {
        console.error(err);
        alert('Text-to-speech failed');
    }
});
