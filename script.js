// =========================================================================
// ======= CONFIGURATION =====
// =========================================================================

// Free API Configuration
const CONFIG = {
    // ConvertAPI - 50 free conversions per day
    convertApiSecret: 'AUYwVhnL8dU74stWcMhg5RcUGMFdwZ30', // You'll need to sign up at convertapi.com
    
    // LibreTranslate - Free translation API
    translateApiUrl: 'https://libretranslate.com/translate',
    
    // Rate limiting
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxTextLength: 500
};

// =========================================================================
// ======= FILE CONVERSION (ConvertAPI) =====
// =========================================================================

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const convertFormatSelect = document.getElementById('convertFormat');
const convertBtn = document.getElementById('convertBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const convertStatus = document.getElementById('convertStatus');
const downloadLink = document.getElementById('downloadLink');

// File input handler
fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        const file = this.files[0];
        
        // Check file size
        if (file.size > CONFIG.maxFileSize) {
            showStatus(convertStatus, `File too large. Maximum size is ${CONFIG.maxFileSize / 1024 / 1024}MB.`, 'error');
            this.value = '';
            fileName.textContent = '';
            return;
        }
        
        fileName.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
        fileName.style.color = 'var(--accent-color)';
        
        // Auto-select format based on file type
        const extension = file.name.split('.').pop().toLowerCase();
        autoSelectFormat(extension);
    } else {
        fileName.textContent = '';
    }
});

function autoSelectFormat(extension) {
    const formatMap = {
        'jpg': 'pdf', 'jpeg': 'pdf', 'png': 'pdf', 'gif': 'pdf',
        'pdf': 'jpg', 'doc': 'pdf', 'docx': 'pdf', 'txt': 'pdf'
    };
    
    if (formatMap[extension]) {
        convertFormatSelect.value = formatMap[extension];
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Convert button handler
convertBtn.addEventListener('click', async () => {
    if (!fileInput.files.length) {
        showStatus(convertStatus, 'Please select a file!', 'error');
        return;
    }
    
    if (!convertFormatSelect.value) {
        showStatus(convertStatus, 'Please select a target format!', 'error');
        return;
    }

    const file = fileInput.files[0];
    const targetFormat = convertFormatSelect.value;
    
    // Check if ConvertAPI secret is configured
    if (CONFIG.convertApiSecret === 'your_convertapi_secret_here') {
        showStatus(convertStatus, 'Please configure ConvertAPI in script.js. Get free API key at convertapi.com', 'error');
        return;
    }

    showStatus(convertStatus, 'Starting conversion...', 'info');
    progressBar.style.display = 'block';
    progressFill.style.width = '10%';
    downloadLink.style.display = 'none';
    convertBtn.disabled = true;

    try {
        progressFill.style.width = '30%';
        
        // Create FormData for ConvertAPI
        const formData = new FormData();
        formData.append('file', file);
        formData.append('secret', CONFIG.convertApiSecret);
        formData.append('format', targetFormat);

        showStatus(convertStatus, 'Uploading file to ConvertAPI...', 'info');
        progressFill.style.width = '50%';

        // Convert using ConvertAPI
        const response = await fetch(`https://v2.convertapi.com/convert/${getConversionTask(file, targetFormat)}/to/${targetFormat}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Conversion failed: ${response.status} ${response.statusText}`);
        }

        progressFill.style.width = '80%';
        showStatus(convertStatus, 'Processing conversion...', 'info');

        const result = await response.json();
        
        if (result.Files && result.Files[0]) {
            progressFill.style.width = '100%';
            
            // Download the converted file
            const convertedFileUrl = result.Files[0].Url;
            downloadLink.href = convertedFileUrl;
            downloadLink.style.display = 'inline-flex';
            downloadLink.textContent = `Download ${file.name.split('.')[0]}.${targetFormat}`;
            
            showStatus(convertStatus, 'Conversion successful!', 'success');
        } else {
            throw new Error('No converted file received from API');
        }
        
    } catch (err) {
        console.error('File Conversion Error:', err);
        
        if (err.message.includes('quota')) {
            showStatus(convertStatus, 'Daily conversion limit reached. Try again tomorrow or upgrade your plan.', 'error');
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
            showStatus(convertStatus, 'Network error. Please check your connection and try again.', 'error');
        } else {
            showStatus(convertStatus, 'Conversion failed: ' + err.message, 'error');
        }
    } finally {
        convertBtn.disabled = false;
        setTimeout(() => {
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);
    }
});

function getConversionTask(file, targetFormat) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    // Map file types to ConvertAPI tasks
    const taskMap = {
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
        'document': ['pdf', 'doc', 'docx', 'txt', 'rtf'],
        'spreadsheet': ['xls', 'xlsx', 'csv']
    };
    
    for (const [task, formats] of Object.entries(taskMap)) {
        if (formats.includes(extension)) {
            return task;
        }
    }
    
    return 'any'; // Fallback
}

// =========================================================================
// ======= TEXT TRANSLATION (LibreTranslate) =====
// =========================================================================

const sourceText = document.getElementById('sourceText');
const charCount = document.getElementById('charCount');
const sourceLang = document.getElementById('sourceLang');
const targetLangSelect = document.getElementById('targetLangSelect');
const translateBtn = document.getElementById('translateBtn');
const translatedText = document.getElementById('translatedText');

// Character counter
sourceText.addEventListener('input', () => {
    const count = sourceText.value.length;
    charCount.textContent = count;
    
    if (count > CONFIG.maxTextLength) {
        charCount.style.color = '#ef4444';
    } else {
        charCount.style.color = 'var(--text-light)';
    }
});

translateBtn.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    const source = sourceLang.value;
    const target = targetLangSelect.value;
    
    if (!text) {
        translatedText.textContent = 'Please enter some text to translate.';
        translatedText.style.color = 'var(--text-light)';
        return;
    }
    
    if (text.length > CONFIG.maxTextLength) {
        translatedText.textContent = `Text too long. Maximum ${CONFIG.maxTextLength} characters.`;
        translatedText.style.color = 'var(--text-light)';
        return;
    }
    
    if (!target) {
        translatedText.textContent = 'Please select a target language.';
        translatedText.style.color = 'var(--text-light)';
        return;
    }

    translateBtn.disabled = true;
    translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
    translatedText.textContent = '';
    
    try {
        // Use LibreTranslate API
        const response = await fetch(CONFIG.translateApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                source: source === 'auto' ? '' : source,
                target: target,
                format: 'text'
            })
        });

        if (!response.ok) {
            // If LibreTranslate is down, fall back to basic translation
            if (response.status === 429) {
                throw new Error('Translation service is busy. Please try again later.');
            } else if (response.status === 500) {
                return fallbackTranslation(text, target);
            }
            throw new Error(`Translation failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.translatedText) {
            translatedText.textContent = data.translatedText;
            translatedText.style.color = 'var(--text-dark)';
        } else {
            throw new Error('No translation received');
        }
        
    } catch (err) {
        console.error('Translation Error:', err);
        
        // Fallback to basic translation
        fallbackTranslation(text, target);
        
    } finally {
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Translate Text';
    }
});

// Basic fallback translation for common phrases
function fallbackTranslation(text, targetLang) {
    const basicTranslations = {
        'hello': {
            'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'it': 'ciao',
            'pt': 'olá', 'ru': 'привет', 'zh': '你好', 'ja': 'こんにちは',
            'ko': '안녕하세요', 'ar': 'مرحبا', 'hi': 'नमस्ते', 'ur': 'ہیلو',
            'fa': 'سلام', 'tr': 'merhaba'
        },
        'thank you': {
            'es': 'gracias', 'fr': 'merci', 'de': 'danke', 'it': 'grazie',
            'pt': 'obrigado', 'ru': 'спасибо', 'zh': '谢谢', 'ja': 'ありがとう',
            'ko': '감사합니다', 'ar': 'شكرا', 'hi': 'धन्यवाद', 'ur': 'شکریہ',
            'fa': 'متشکرم', 'tr': 'teşekkür ederim'
        },
        'how are you': {
            'es': 'cómo estás', 'fr': 'comment allez-vous', 'de': 'wie geht es dir',
            'it': 'come stai', 'pt': 'como você está', 'ru': 'как дела',
            'zh': '你好吗', 'ja': 'お元気ですか', 'ko': '어떻게 지내세요',
            'ar': 'كيف حالك', 'hi': 'आप कैसे हैं', 'ur': 'آپ کیسے ہیں',
            'fa': 'حالتان چطور است', 'tr': 'nasılsın'
        }
    };
    
    const lowerText = text.toLowerCase();
    
    for (const [phrase, translations] of Object.entries(basicTranslations)) {
        if (lowerText.includes(phrase) && translations[targetLang]) {
            translatedText.textContent = translations[targetLang];
            translatedText.style.color = 'var(--text-dark)';
            translatedText.innerHTML += '<br><small style="color: var(--text-light);">Basic translation - for better results, use shorter phrases when service is busy.</small>';
            return;
        }
    }
    
    translatedText.textContent = 'Translation service unavailable. Please try common phrases like "hello", "thank you", or try again later.';
    translatedText.style.color = 'var(--text-light)';
}

// =========================================================================
// ======= TEXT-TO-SPEECH (Web Speech API + ResponsiveVoice) =====
// =========================================================================

const speechText = document.getElementById('speechText');
const voiceSelect = document.getElementById('voiceSelect');
const speakBtn = document.getElementById('speakBtn');
const stopBtn = document.getElementById('stopBtn');
const speedSlider = document.getElementById('speedSlider');
const pitchSlider = document.getElementById('pitchSlider');
const speedValue = document.getElementById('speedValue');
const pitchValue = document.getElementById('pitchValue');
const speechStatus = document.getElementById('speechStatus');

let speechSynth = window.speechSynthesis;
let currentUtterance = null;

// Load available voices
function loadVoices() {
    const voices = speechSynth.getVoices();
    voiceSelect.innerHTML = '<option value="">Default Voice</option>';
    
    voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
    });
}

// Load voices when they become available
speechSynth.addEventListener('voiceschanged', loadVoices);
loadVoices(); // Initial load

// Update slider values
speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value;
});

pitchSlider.addEventListener('input', () => {
    pitchValue.textContent = pitchSlider.value;
});

// Speak function
speakBtn.addEventListener('click', () => {
    const text = speechText.value.trim();
    
    if (!text) {
        showStatus(speechStatus, 'Please enter some text to speak.', 'error');
        return;
    }

    // Stop any current speech
    if (speechSynth.speaking) {
        speechSynth.cancel();
    }

    // Try Web Speech API first
    if (speechSynth.speak) {
        useWebSpeechAPI(text);
    } else {
        // Fallback to ResponsiveVoice
        useResponsiveVoice(text);
    }
});

function useWebSpeechAPI(text) {
    currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Set voice if selected
    const selectedVoice = voiceSelect.value;
    if (selectedVoice) {
        const voices = speechSynth.getVoices();
        currentUtterance.voice = voices[selectedVoice];
    }
    
    // Set rate and pitch
    currentUtterance.rate = parseFloat(speedSlider.value);
    currentUtterance.pitch = parseFloat(pitchSlider.value);
    
    // Event handlers
    currentUtterance.onstart = () => {
        showStatus(speechStatus, 'Speaking...', 'info');
        speakBtn.disabled = true;
        stopBtn.disabled = false;
    };
    
    currentUtterance.onend = () => {
        showStatus(speechStatus, 'Speech completed.', 'success');
        speakBtn.disabled = false;
        stopBtn.disabled = true;
    };
    
    currentUtterance.onerror = (event) => {
        showStatus(speechStatus, 'Speech error, trying fallback...', 'error');
        speakBtn.disabled = false;
        stopBtn.disabled = true;
        
        // Fallback to ResponsiveVoice
        setTimeout(() => useResponsiveVoice(text), 500);
    };
    
    speechSynth.speak(currentUtterance);
}

function useResponsiveVoice(text) {
    try {
        responsiveVoice.speak(text, 
            voiceSelect.value ? voiceSelect.options[voiceSelect.value].text : null,
            {
                rate: speedSlider.value,
                pitch: pitchSlider.value,
                onstart: () => {
                    showStatus(speechStatus, 'Speaking (fallback mode)...', 'info');
                    speakBtn.disabled = true;
                    stopBtn.disabled = false;
                },
                onend: () => {
                    showStatus(speechStatus, 'Speech completed.', 'success');
                    speakBtn.disabled = false;
                    stopBtn.disabled = true;
                }
            }
        );
    } catch (err) {
        showStatus(speechStatus, 'Text-to-speech not available in this browser.', 'error');
        speakBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// Stop button
stopBtn.addEventListener('click', () => {
    if (speechSynth.speaking) {
        speechSynth.cancel();
    }
    if (typeof responsiveVoice !== 'undefined') {
        responsiveVoice.cancel();
    }
    showStatus(speechStatus, 'Speech stopped.', 'info');
    speakBtn.disabled = false;
    stopBtn.disabled = true;
});

// =========================================================================
// ======= UTILITY FUNCTIONS =====
// =========================================================================

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = 'status-message';
    
    switch (type) {
        case 'error':
            element.style.backgroundColor = '#fee2e2';
            element.style.color = '#dc2626';
            element.style.border = '1px solid #fecaca';
            break;
        case 'success':
            element.style.backgroundColor = '#d1fae5';
            element.style.color = '#065f46';
            element.style.border = '1px solid #a7f3d0';
            break;
        case 'info':
            element.style.backgroundColor = '#dbeafe';
            element.style.color = '#1e40af';
            element.style.border = '1px solid #bfdbfe';
            break;
        default:
            element.style.backgroundColor = '#f3f4f6';
            element.style.color = '#374151';
            element.style.border = '1px solid #e5e7eb';
    }
}

// Footer link functions
function showApiInfo() {
    alert(`Free API Information:

📁 File Conversion: ConvertAPI
• 50 free conversions per day
• Sign up at convertapi.com for free API key
• Various file formats supported

🌐 Translation: LibreTranslate
• Completely free translation API
• No API key required
• Supports 20+ languages

🔊 Text-to-Speech: Web Speech API + ResponsiveVoice
• Built into modern browsers
• ResponsiveVoice fallback
• No API keys needed

Note: These are free services with usage limits. For heavy usage, consider upgrading.`);
}

function showUsageTips() {
    alert(`Usage Tips:

📁 File Conversion:
• Maximum file size: 10MB
• Supported: Images → PDF, PDF → Images, Documents
• 50 free conversions per day

🌐 Translation:
• Keep text under 500 characters
• Use common phrases for best results
• Auto-detect source language available

🔊 Text-to-Speech:
• Works best in Chrome/Edge
• Adjust speed and pitch as needed
• Multiple voice options available

💡 For best results:
• Use supported file types
• Keep translations concise
• Check browser compatibility`);
}

// =========================================================================
// ======= INITIALIZATION =====
// =========================================================================

document.addEventListener('DOMContentLoaded', function() {
    showStatus(convertStatus, 'Ready for file conversion. Configure ConvertAPI key for full functionality.', 'info');
    showStatus(speechStatus, 'Text-to-speech ready. Enter text and click Speak.', 'info');
    
    // Initialize stop button as disabled
    stopBtn.disabled = true;
    
    console.log('Unicon App Initialized');
    console.log('To enable file conversion:');
    console.log('1. Go to convertapi.com');
    console.log('2. Sign up for free account');
    console.log('3. Replace "your_convertapi_secret_here" in script.js with your actual secret key');
});

