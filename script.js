// ======= GLOBAL CORS PROXY =====
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// --- Your API Keys (PASTE YOUR ACTUAL KEYS HERE after getting the code) ---
const cloudConvertApiKey = 'AUYwVhnL8dU74stWcMhg5RcUGMFdwZ30';
const ttsApiKey = '2287ae7a98da100f650b9ada0614bdcc'; // Note: This API might need to be replaced with a real one.

// =========================================================================
// ======= FILE CONVERSION (CloudConvert) =====
// =========================================================================

// CloudConvert API V2 supports a vast range. This is a simplified mapping
// In a real advanced app, you'd fetch supported formats from CloudConvert's API
const CATEGORY_FORMAT_MAP = {
    'document': {
        name: 'Document',
        formats: ['pdf', 'docx', 'txt', 'rtf', 'odt', 'html']
    },
    'image': {
        name: 'Image',
        formats: ['jpg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg']
    },
    'audio': {
        name: 'Audio',
        formats: ['mp3', 'wav', 'ogg', 'aac', 'flac']
    },
    'video': {
        name: 'Video',
        formats: ['mp4', 'avi', 'mov', 'wmv', 'webm', 'gif'] // gif can be video output too
    },
    'archive': {
        name: 'Archive',
        formats: ['zip', 'rar', '7z', 'tar']
    },
    'spreadsheet': {
        name: 'Spreadsheet',
        formats: ['xlsx', 'xls', 'csv', 'ods']
    },
    // Add more categories and formats as needed
};

const fileInput = document.getElementById('fileInput');
const sourceCategorySelect = document.getElementById('sourceCategory');
const convertFormatSelect = document.getElementById('convertFormat');
const convertBtn = document.getElementById('convertBtn');
const convertStatus = document.getElementById('convertStatus');
const downloadLink = document.getElementById('downloadLink');

// Function to populate Source Category dropdown
function populateSourceCategory() {
    for (const key in CATEGORY_FORMAT_MAP) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = CATEGORY_FORMAT_MAP[key].name;
        sourceCategorySelect.appendChild(option);
    }
}

// Function to populate Convert Format dropdown based on selected category
function populateConvertFormats(categoryKey) {
    convertFormatSelect.innerHTML = '<option value="">Select Format</option>'; // Reset options
    convertFormatSelect.disabled = true;

    if (categoryKey && CATEGORY_FORMAT_MAP[categoryKey]) {
        CATEGORY_FORMAT_MAP[categoryKey].formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format.toUpperCase();
            convertFormatSelect.appendChild(option);
        });
        convertFormatSelect.disabled = false;
    }
}

// Event listener for Source Category change
sourceCategorySelect.addEventListener('change', () => {
    populateConvertFormats(sourceCategorySelect.value);
});

// Initial population of source category dropdown
populateSourceCategory();


convertBtn.addEventListener('click', async () => {
    if (!fileInput.files.length) {
        convertStatus.textContent = 'Error: Please select a file!';
        return;
    }
    if (!sourceCategorySelect.value) {
        convertStatus.textContent = 'Error: Please select a source category!';
        return;
    }
    if (!convertFormatSelect.value) {
        convertStatus.textContent = 'Error: Please select a target format!';
        return;
    }

    convertStatus.textContent = 'Uploading and converting...';
    downloadLink.style.display = 'none';
    downloadLink.href = '#'; // Clear previous download link

    const file = fileInput.files[0];
    const targetFormat = convertFormatSelect.value;

    const formData = new FormData();
    formData.append('file', file);

    try {
        // --- Step 1: Request an upload URL from CloudConvert ---
        const requestUploadRes = await fetch(`${CORS_PROXY}https://api.cloudconvert.com/v2/jobs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cloudConvertApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "tasks": {
                    "upload-file": {
                        "operation": "import/upload"
                    },
                    "convert-file": {
                        "operation": "convert",
                        "input": "upload-file", // Reference the upload task
                        "output_format": targetFormat
                    },
                    "export-file": {
                        "operation": "export/url",
                        "input": "convert-file" // Reference the convert task
                    }
                }
            })
        });

        if (!requestUploadRes.ok) {
            const errorBody = await requestUploadRes.json();
            throw new Error(`CloudConvert Job Creation failed: ${errorBody.message || requestUploadRes.statusText}`);
        }
        const requestUploadData = await requestUploadRes.json();
        const uploadUrl = requestUploadData.data?.tasks[0]?.result?.form?.url; // The actual URL to upload the file to
        const jobId = requestUploadData.data?.id;

        if (!uploadUrl || !jobId) throw new Error('Failed to get CloudConvert upload URL or Job ID.');
        
        convertStatus.textContent = 'Uploading file...';

        // --- Step 2: Upload the actual file to the obtained URL ---
        const uploadFileRes = await fetch(uploadUrl, {
            method: 'POST',
            body: formData // Send the FormData directly to the upload URL
        });

        if (!uploadFileRes.ok) {
            // CloudConvert's upload endpoint doesn't always return JSON on error, sometimes just text
            const errorText = await uploadFileRes.text(); 
            throw new Error(`File upload to CloudConvert failed: ${uploadFileRes.status} - ${errorText}`);
        }

        convertStatus.textContent = 'File uploaded, now converting...';

        // --- Step 3: Poll the job status until conversion is complete ---
        let jobStatusData;
        do {
            await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds
            const jobStatusRes = await fetch(`${CORS_PROXY}https://api.cloudconvert.com/v2/jobs/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${cloudConvertApiKey}`
                }
            });
            if (!jobStatusRes.ok) {
                const errorBody = await jobStatusRes.json();
                throw new Error(`Failed to get job status: ${errorBody.message || jobStatusRes.statusText}`);
            }
            jobStatusData = await jobStatusRes.json();
            convertStatus.textContent = `Conversion status: ${jobStatusData.data?.status}...`;

        } while (jobStatusData.data?.status !== 'finished' && jobStatusData.data?.status !== 'error');

        if (jobStatusData.data?.status === 'error') {
            const errorMessage = jobStatusData.data?.tasks.find(t => t.status === 'error')?.message || 'Unknown conversion error.';
            throw new Error(`CloudConvert: ${errorMessage}`);
        }

        const exportTask = jobStatusData.data?.tasks.find(t => t.operation === 'export/url' && t.status === 'finished');
        const fileUrl = exportTask?.result?.files[0]?.url;

        if (!fileUrl) throw new Error('Converted file URL not found.');

        downloadLink.href = fileUrl;
        downloadLink.style.display = 'block';
        downloadLink.textContent = `Download ${file.name.split('.').slice(0, -1).join('.')}.${targetFormat}`;
        convertStatus.textContent = 'Conversion successful!';
    } catch (err) {
        console.error('File Conversion Error:', err);
        convertStatus.textContent = 'Error: ' + err.message;
    }
});


// =========================================================================
// ======= TEXT TRANSLATION =====
// =========================================================================

const sourceText = document.getElementById('sourceText');
const targetLangSelect = document.getElementById('targetLangSelect'); // Use the new select element
const translateBtn = document.getElementById('translateBtn');
const translatedText = document.getElementById('translatedText');

translateBtn.addEventListener('click', async () => {
    const text = sourceText.value;
    const lang = targetLangSelect.value; // Get value from select
    translatedText.textContent = ''; // Clear previous text

    if (!text || !lang) {
        translatedText.textContent = 'Error: Enter text and select a target language!';
        return;
    }
    
    translatedText.textContent = 'Translating...';

    try {
        const res = await fetch(`${CORS_PROXY}https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
        if (!res.ok) { // Check if response was successful
            throw new Error(`Translation API responded with status: ${res.status}`);
        }
        const data = await res.json();
        if (data.responseStatus !== 200) { // MyMemory's internal status check
            throw new Error(`Translation API internal error: ${data.responseDetails || 'Unknown error'}`);
        }
        translatedText.textContent = data.responseData.translatedText;
    } catch (err) {
        console.error('Text Translation Error:', err);
        translatedText.textContent = 'Error: Translation failed. ' + err.message;
    }
});


// =========================================================================
// ======= TEXT-TO-SPEECH =====
// =========================================================================

const speechText = document.getElementById('speechText');
const speakBtn = document.getElementById('speakBtn');
const audioPlayer = document.getElementById('audioPlayer');
const speechStatus = document.getElementById('speechStatus');

speakBtn.addEventListener('click', async () => {
    const text = speechText.value;
    speechStatus.textContent = ''; // Clear previous status
    audioPlayer.src = ''; // Clear previous audio

    if (!text) {
        speechStatus.textContent = 'Error: Enter text for speech!';
        return;
    }

    // --- IMPORTANT: The api.faketts.com endpoint is likely a placeholder ---
    // You will need to replace this with a real Text-to-Speech API like:
    // Google Cloud Text-to-Speech, Amazon Polly, IBM Watson Text to Speech, etc.
    // Each will have its own API key, endpoint, and request/response structure.

    speechStatus.textContent = 'Generating speech...';

    try {
        // This fetch call needs to be adapted for your chosen real TTS API
        const res = await fetch(`${CORS_PROXY}https://api.faketts.com/speak`, { 
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ttsApiKey}`, // If your chosen TTS API uses Bearer tokens
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text }) // Adjust payload as per real TTS API
        });

        if (!res.ok) {
            const errorBody = await res.text(); // TTS APIs might return plain text error or JSON
            throw new Error(`Text-to-Speech API responded with status: ${res.status} - ${errorBody}`);
        }

        const blob = await res.blob();
        audioPlayer.src = URL.createObjectURL(blob);
        audioPlayer.play();
        speechStatus.textContent = 'Playing speech!';
    } catch (err) {
        console.error('Text-to-Speech Error:', err);
        speechStatus.textContent = 'Error: Text-to-speech failed. ' + err.message;
    }
});

