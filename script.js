// --- Import API Keys ---
// Keys are imported from the api-keys.js file.
// Make sure that file exists and has your keys.
import { GEMINI_API_KEY, OPENAI_API_KEY } from './api-keys.js';
import { buildPrompt } from './prompt-builder.js';

// --- DOM Elements ---
const selectApiGemini = document.getElementById('api-select-gemini');
const selectApiOpenAI = document.getElementById('api-select-openai');
const rocnikGroup = document.getElementById('rocnik-checkbox-group');
const skupinaGroup = document.getElementById('skupina-checkbox-group');
const vystupGroup = document.getElementById('vystup-checkbox-group');
const fileInput = document.getElementById('file-input');
const fileUploadText = document.getElementById('file-upload-text');
const fileUploadSubtext = document.getElementById('file-upload-subtext');
const fileUploadPlaceholder = document.getElementById('file-upload-placeholder');
const fileThumbnail = document.getElementById('file-thumbnail');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const generateBtn = document.getElementById('generate-btn');
const resultsContainer = document.getElementById('results-container');
const loadingIndicator = document.getElementById('loading-indicator');
const loadingText = document.getElementById('loading-text');
const promptToggleBtn = document.getElementById('prompt-toggle-btn');
const promptChevron = document.getElementById('prompt-chevron');
const promptDisplay = document.getElementById('prompt-display');
const textOutput = document.getElementById('text-output');
const audioContainer = document.getElementById('audio-container');
const audioPlayer = document.getElementById('audio-player');
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');

// --- App State ---
let fileDataUrl = null;
let fileMimeType = null;
let fileTextContent = null; // For text files
let currentAudioUrl = null; // To manage audio blob URLs

// --- Prompt Definitions ---
const prompts = {
    // Boilerplate prompt for the new task structure
    generate_material: {
        system: "You are an educational assistant creating materials for students based on provided text.",
        user: "Generate the specified output for the student group from the provided content."
    }
};

// --- Event Listeners ---
fileInput.addEventListener('change', handleFileInput);
rocnikGroup.addEventListener('change', checkFormValidity);
skupinaGroup.addEventListener('change', checkFormValidity);
vystupGroup.addEventListener('change', checkFormValidity);
selectApiGemini.addEventListener('change', checkFormValidity);
selectApiOpenAI.addEventListener('change', checkFormValidity);
generateBtn.addEventListener('click', runAiTask);
promptToggleBtn.addEventListener('click', () => {
    promptDisplay.classList.toggle('hidden');
    promptChevron.classList.toggle('rotate-180');
    promptToggleBtn.classList.toggle('rounded-b-none');
});

// --- Form Logic ---
function checkFormValidity() {
    const rocnikSelected = document.querySelectorAll('input[name="rocnik"]:checked').length > 0;
    const skupinaSelected = document.querySelectorAll('input[name="skupina"]:checked').length > 0;
    const vystupSelected = document.querySelectorAll('input[name="vystup"]:checked').length > 0;
    const fileSelected = !!fileDataUrl;
    
    // Re-enable button. No longer checking for API key input.
    const allSelectionsMade = rocnikSelected && skupinaSelected && vystupSelected;
    generateBtn.disabled = !(allSelectionsMade && fileSelected);
}

function handleFileInput(event) {
    const file = event.target.files[0];
    if (!file) {
        fileDataUrl = null;
        fileMimeType = null;
        fileTextContent = null;
        fileUploadText.textContent = "Click to upload a file";
        fileUploadSubtext.textContent = "Images, TXT, PDF, etc.";
        fileThumbnail.classList.add('hidden');
        fileUploadPlaceholder.classList.remove('hidden');
        progressContainer.classList.add('hidden');
        checkFormValidity();
        return;
    }

    fileMimeType = file.type;
    fileUploadText.textContent = file.name;
    fileUploadSubtext.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;

    const reader = new FileReader();
    
    // Show progress bar
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';

    reader.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentLoaded = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = `${percentLoaded}%`;
            progressPercent.textContent = `${percentLoaded}%`;
        }
    };

    reader.onload = (e) => {
        fileDataUrl = e.target.result;
        // If it's a text file, also read its text content for TTS
        if (fileMimeType.startsWith('text/')) {
            // Handle different text encodings, defaulting to utf-8
            try {
                const base64Data = fileDataUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                // Use TextDecoder for robust string conversion
                const decoder = new TextDecoder('utf-8'); // You could also try 'latin1' etc.
                fileTextContent = decoder.decode(bytes);
            } catch (e) {
                console.error("Error decoding base64 text: ", e);
                // Fallback for simple text
                fileTextContent = atob(fileDataUrl.split(',')[1]);
            }
        } else {
            fileTextContent = null;
        }

        // Show thumbnail if it's an image
        if (fileMimeType.startsWith('image/')) {
            fileThumbnail.src = fileDataUrl;
            fileThumbnail.classList.remove('hidden');
            fileUploadPlaceholder.classList.add('hidden');
        } else {
            // Ensure thumbnail is hidden for non-image files
            fileThumbnail.classList.add('hidden');
            fileUploadPlaceholder.classList.remove('hidden');
        }

        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        checkFormValidity();
    };

    reader.onerror = () => {
        showError("Error reading file.");
        fileDataUrl = null;
        progressContainer.classList.add('hidden');
        fileThumbnail.classList.add('hidden');
        fileUploadPlaceholder.classList.remove('hidden');
        checkFormValidity();
    };
    
    // Read as Data URL (base64)
    reader.readAsDataURL(file);
}

// --- Main Task Orchestrator ---
async function runAiTask() {
    const selectedApi = document.querySelector('input[name="api-provider"]:checked').value;
    const selectedTask = 'generate_material'; // Hardcoded as we now have a single, configurable task

    // Helper function to get checked values from a group
    const getCheckedValues = (name) => 
        Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

    const rocnik = getCheckedValues('rocnik');
    const skupina = getCheckedValues('skupina');
    const vystup = getCheckedValues('vystup');

    // Get the correct key from the imported constants
    const apiKey = (selectedApi === 'gemini') ? GEMINI_API_KEY : OPENAI_API_KEY;

    // Check if the keys are still placeholders
    if (!apiKey || apiKey.includes("YOUR_")) {
        showError("API Key is not set. Please edit api-keys.js and add your API keys.");
        textOutput.textContent = "API Key is not set. Please edit api-keys.js and add your API keys.";
        resultsContainer.classList.remove('hidden');
        return;
    }

    // Updated check
    if (!selectedApi || rocnik.length === 0 || skupina.length === 0 || vystup.length === 0 || !fileDataUrl) {
        showError("Please select an API, a task, and upload a file.");
        return;
    }

    // Reset UI
    setLoading(true);
    textOutput.textContent = "";
    promptDisplay.textContent = "";
    audioContainer.classList.add('hidden');
    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl); // Clean up old audio blob
        currentAudioUrl = null;
    }

    // Create a dynamic user prompt based on selections
    const systemPrompt = buildPrompt(rocnik, skupina, vystup);
    const promptData = { system: systemPrompt, user: "Please process the attached file according to the system instructions." };
    
    // Display the generated prompt for debugging
    promptDisplay.textContent = systemPrompt;

    const base64Data = fileDataUrl.split(',')[1];

    try {
        // All tasks now use the vision model
        loadingText.textContent = "Analyzing file...";
        
        // We will rely on the API to handle common types like PNG, JPEG, WEBP, PDF.
        // For other types, the API might fail, which is handled by the catch block.
        if (!fileMimeType.startsWith('image/') && !fileMimeType.startsWith('text/') && fileMimeType !== 'application/pdf') {
             console.warn(`Unsupported MIME type for vision: ${fileMimeType}. Proceeding, but API may fail.`);
        }

        const resultText = await fetchVision(selectedApi, apiKey, promptData, base64Data, fileMimeType);
        textOutput.textContent = resultText;

    } catch (error) {
        console.error("Task failed:", error);
        showError(error.message);
        textOutput.textContent = `Error: ${error.message}`;
    } finally {
        setLoading(false);
    }
}

// --- API Call Functions ---

/**
 * Fetches a multimodal (vision) response from the selected API.
 */
async function fetchVision(api, key, promptData, base64Data, mimeType) {
    let url, payload, headers;
    headers = { "Content-Type": "application/json" };

    if (api === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`;
        payload = {
            systemInstruction: { parts: [{ text: promptData.system }] },
            contents: [{
                parts: [
                    { text: promptData.user },
                    { inlineData: { mimeType: mimeType, data: base64Data } }
                ]
            }]
        };
    } else { // openai
        url = "https://api.openai.com/v1/chat/completions";
        headers["Authorization"] = `Bearer ${key}`;
        
        // OpenAI (gpt-4o) expects image_url for images. 
        // For other file types like PDF, it's more complex and often requires a different endpoint or process.
        // This simplified demo will assume images for OpenAI vision.
        if (!mimeType.startsWith('image/')) {
            throw new Error(`OpenAI (gpt-4o) in this demo only supports images for vision. You uploaded: ${mimeType}`);
        }
        
        payload = {
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptData.system },
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptData.user },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                    ]
                }
            ],
            max_tokens: 2000
        };
    }

    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error Data:", errorData);
        throw new Error(`API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();

    if (api === 'gemini') {
        // More robust check for Gemini's response structure
        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
            return result.candidates[0].content.parts[0].text;
        }
        // Handle cases where the response is blocked or empty
        return "No content returned from API. This might be due to safety settings or an empty response.";
    } else { // openai
        return result.choices[0]?.message?.content || "No content returned.";
    }
}

/**
 * Fetches a text-to-speech (TTS) response from the selected API.
 * Returns an audio blob.
 */
async function fetchTTS(api, key, text) {
    let url, payload, headers;

    if (api === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`;
        headers = { "Content-Type": "application/json" };
        payload = {
            contents: [{
                parts: [{ text: `Read this: ${text}` }]
            }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    speechContexts: [],
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
                }
            },
            model: "gemini-2.5-flash-preview-tts"
        };

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini TTS Error Data:", errorData);
            throw new Error(`Gemini TTS API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
        const result = await response.json();
        const audioPart = result.candidates[0]?.content?.parts[0];
        if (!audioPart || !audioPart.inlineData) throw new Error("No audio data returned from Gemini.");
        
        // Convert base64 PCM to a WAV blob
        const pcmData = base64ToArrayBuffer(audioPart.inlineData.data);
        const pcm16 = new Int16Array(pcmData);
        const sampleRateMatch = audioPart.inlineData.mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000; // Default 24kHz
        return pcmToWav(pcm16, sampleRate);

    } else { // openai
        url = "https://api.openai.com/v1/audio/speech";
        headers = {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        };
        payload = {
            model: "tts-1",
            input: text,
            voice: "alloy"
        };
        
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json(); // OpenAI might not send JSON on error, but good to try
            console.error("OpenAI TTS Error Data:", errorData);
            throw new Error(`OpenAI TTS API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
        return await response.blob(); // OpenAI returns an MP3 blob directly
    }
}

/**
 * A wrapper for fetch that includes exponential backoff and retry logic.
 */
async function fetchWithRetry(url, options, retries = 5, backoff = 1000) {
    try {
        const response = await fetch(url, options);
        // Retry on rate limit (429) or server errors (5xx)
        if (!response.ok && (response.status === 429 || response.status >= 500) && retries > 0) {
            console.warn(`Retrying request: ${response.status}. Retries left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        return response;
    } catch (error) {
        // Retry on network errors
        if (retries > 0) {
            console.warn(`Retrying request after network error: ${error.message}. Retries left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw new Error(`Network error or max retries exceeded: ${error.message}`);
    }
}

// --- UI Helpers ---

function setLoading(isLoading) {
    if (isLoading) {
        resultsContainer.classList.remove('hidden');
        loadingIndicator.classList.remove('hidden');
        loadingIndicator.classList.add('flex');
        generateBtn.disabled = true;
        generateBtn.textContent = "Spracúvam...";
    } else {
        loadingIndicator.classList.add('hidden');
        loadingIndicator.classList.remove('flex');
        generateBtn.disabled = false;
        generateBtn.textContent = "Odošli";
        checkFormValidity(); // Re-check validity (e.g., file might still be selected)
    }
}

function showError(message) {
    messageText.textContent = message;
    messageBox.classList.remove('opacity-0', '-translate-y-10');
    messageBox.classList.add('opacity-100', 'translate-y-0');
    
    // Auto-hide the message
    setTimeout(() => {
        messageBox.classList.remove('opacity-100', 'translate-y-0');
        messageBox.classList.add('opacity-0', '-translate-y-10');
    }, 5000); // Hide after 5 seconds
}

// --- Audio Utilities ---

/**
 * Decodes base64 string to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Converts raw PCM audio data (Int16Array) to a WAV file Blob.
 * This is necessary for playing the raw audio data from Gemini TTS in a browser.
 */
function pcmToWav(pcmData, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true); // file size - 8
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(44 + i * 2, pcmData[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

/**
 * Helper to write a string to a DataView.
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// --- Initial Check ---
checkFormValidity();