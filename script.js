let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let visualizerCanvas;
let visualizerCanvasCtx;

const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyButton = document.getElementById('saveApiKey');
const startRecordingButton = document.getElementById('startRecording');
const stopRecordingButton = document.getElementById('stopRecording');
const sendToApiButton = document.getElementById('sendToApi');
const statusDiv = document.getElementById('status');
const transcriptionDiv = document.getElementById('transcription');
const saveToFileButton = document.getElementById('saveToFile');
const copyToClipboardButton = document.getElementById('copyToClipboard');
const downloadAudioButton = document.getElementById('downloadAudio'); // 追加

let trimmedAudioBlob = null; // トリミング後の音声データを保存する変数

// APIキーの保存
saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    if (apiKey) {
        localStorage.setItem('whisperApiKey', apiKey);
        statusDiv.textContent = 'APIキーが保存されました';
        apiKeyInput.value = '';
    } else {
        statusDiv.textContent = 'APIキーを入力してください';
    }
});

// 保存されたAPIキーの読み込み
const savedApiKey = localStorage.getItem('whisperApiKey');
if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
}

startRecordingButton.addEventListener('click', startRecording);
stopRecordingButton.addEventListener('click', stopRecording);
sendToApiButton.addEventListener('click', sendToApi);
saveToFileButton.addEventListener('click', saveToFile);
copyToClipboardButton.addEventListener('click', copyToClipboard);
downloadAudioButton.addEventListener('click', downloadAudio); // 追加

// 音声ビジュアライザーの設定
visualizerCanvas = document.getElementById('audioVisualizer');
visualizerCanvasCtx = visualizerCanvas.getContext('2d');

function resizeCanvas() {
    visualizerCanvas.width = visualizerCanvas.offsetWidth;
    visualizerCanvas.height = visualizerCanvas.offsetHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    visualizerCanvasCtx.fillStyle = 'rgb(200, 200, 200)';
    visualizerCanvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    visualizerCanvasCtx.lineWidth = 2;
    visualizerCanvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    visualizerCanvasCtx.beginPath();

    const sliceWidth = visualizerCanvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * visualizerCanvas.height / 2;

        if (i === 0) {
            visualizerCanvasCtx.moveTo(x, y);
        } else {
            visualizerCanvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    visualizerCanvasCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
    visualizerCanvasCtx.stroke();
}

async function startRecording() {
    audioChunks = [];
    try {
        console.log("録音開始処理を開始します...");
        statusDiv.textContent = "録音の準備中...";

        console.log("デスクトップ音声のキャプチャを開始します...");
        const desktopStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        console.log("デスクトップ音声のキャプチャに成功しました。");

        console.log("マイク音声のキャプチャを開始します...");
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
        console.log("マイク音声のキャプチャに成功しました。");

        console.log("オーディオコンテキストを設定中...");
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        const desktopSource = audioContext.createMediaStreamSource(desktopStream);
        const micSource = audioContext.createMediaStreamSource(micStream);
        const destination = audioContext.createMediaStreamDestination();

        desktopSource.connect(analyser);
        micSource.connect(analyser);
        analyser.connect(destination);

        console.log("ビジュアライザーの描画を開始します...");
        drawVisualizer();

        console.log("MediaRecorderを設定中...");
        mediaRecorder = new MediaRecorder(destination.stream);

        mediaRecorder.ondataavailable = event => {
            console.log("データが利用可能です:", event.data);
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            console.log("録音が停止しました");
            desktopStream.getTracks().forEach(track => track.stop());
            micStream.getTracks().forEach(track => track.stop());
        };

        console.log("録音を開始します...");
        mediaRecorder.start(1000); // 1秒ごとにデータを取得
        startRecordingButton.disabled = true;
        stopRecordingButton.disabled = false;
        sendToApiButton.disabled = true;
        statusDiv.textContent = '録音中...';
        console.log("録音が正常に開始されました。");
    } catch (error) {
        console.error('録音の開始に失敗しました:', error);
        statusDiv.textContent = `録音の開始に失敗しました: ${error.message}`;
        startRecordingButton.disabled = false;
        stopRecordingButton.disabled = true;
        sendToApiButton.disabled = true;
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        startRecordingButton.disabled = false;
        stopRecordingButton.disabled = true;
        sendToApiButton.disabled = false;
        statusDiv.textContent = '録音が完了しました。「文字起こし開始」ボタンを押して文字起こしを開始できます。';
    }
}

async function sendToApi() {
    try {
        sendToApiButton.disabled = true;
        statusDiv.textContent = '文字起こしを開始します... 文字起こし中はタブを閉じないでください。';
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log("録音されたオーディオデータのサイズ:", audioBlob.size);
        if (audioBlob.size === 0) {
            throw new Error('録音されたオーディオがありません');
        }
        await processAudio(audioBlob);
    } catch (error) {
        console.error('文字起こしに失敗しました:', error);
        statusDiv.textContent = '文字起こしに失敗しました: ' + error.message;
    } finally {
        sendToApiButton.disabled = false;
    }
}

async function processAudio(audioBlob) {
    try {
        trimmedAudioBlob = await trimSilence(audioBlob); // トリミング後の音声データを保存
        downloadAudioButton.disabled = false; // トリミング後の音声が利用可能になったので、ダウンロードボタンを有効にする
        const chunks = await splitAudioIntoChunks(trimmedAudioBlob);
        let fullTranscription = '';

        for (let i = 0; i < chunks.length; i++) {
            statusDiv.textContent = `文字起こし中... (${i + 1}/${chunks.length}) 文字起こし中はタブを閉じないでください。`;
            const transcription = await transcribeAudio(chunks[i]);
            fullTranscription += transcription + '\n';
            transcriptionDiv.textContent = fullTranscription;
        }

        statusDiv.textContent = '文字起こしが完了しました';
        saveToFileButton.disabled = false;
        copyToClipboardButton.disabled = false;
    } catch (error) {
        console.error('文字起こしに失敗しました:', error);
        statusDiv.textContent = '文字起こしに失敗しました: ' + error.message;
    } finally {
        sendToApiButton.disabled = false;
    }
}

async function trimSilence(audioBlob, threshold = 0.01, minSilenceDuration = 0.5) {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0); // モノラルを仮定
    const sampleRate = audioBuffer.sampleRate;
    const minSilenceSamples = sampleRate * minSilenceDuration;

    let segments = [];
    let isSilent = true;
    let segmentStart = 0;

    for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) >= threshold) {
            if (isSilent) {
                isSilent = false;
                segmentStart = i;
            }
        } else {
            if (!isSilent) {
                let silenceEnd = i;
                while (silenceEnd < channelData.length && Math.abs(channelData[silenceEnd]) < threshold) {
                    silenceEnd++;
                }
                if (silenceEnd - i >= minSilenceSamples) {
                    isSilent = true;
                    segments.push({ start: segmentStart, end: i });
                }
                i = silenceEnd - 1;
            }
        }
    }

    if (!isSilent) {
        segments.push({ start: segmentStart, end: channelData.length });
    }

    const newLength = segments.reduce((total, segment) => total + (segment.end - segment.start), 0);
    const trimmedBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, newLength, sampleRate);

    let offset = 0;
    for (let segment of segments) {
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            trimmedBuffer.copyToChannel(audioBuffer.getChannelData(channel).slice(segment.start, segment.end), channel, offset);
        }
        offset += segment.end - segment.start;
    }

    const trimmedBlob = await audioBufferToWav(trimmedBuffer);
    return new Blob([trimmedBlob], { type: 'audio/wav' });
}

async function splitAudioIntoChunks(audioBlob, maxSizeInBytes = 10 * 1024 * 1024) { // 10MBに設定
    const chunks = [];
    let start = 0;
    const duration = await getAudioDuration(audioBlob);
    const bytesPerSecond = audioBlob.size / duration;

    while (start < duration) {
        const chunkDuration = maxSizeInBytes / bytesPerSecond;
        const end = Math.min(start + chunkDuration, duration);
        const chunk = await sliceAudio(audioBlob, start, end);
        chunks.push(chunk);
        start = end;
    }

    return chunks;
}

async function getAudioDuration(audioBlob) {
    return new Promise((resolve, reject) => {
        const audio = new Audio(URL.createObjectURL(audioBlob));
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
            reject(new Error('オーディオの長さを取得できませんでした'));
        });
    });
}

async function sliceAudio(audioBlob, start, end) {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);

    const newAudioBuffer = audioContext.createBuffer(numberOfChannels, endSample - startSample, sampleRate);
    for (let channel = 0; channel < numberOfChannels; channel++) {
        newAudioBuffer.copyToChannel(audioBuffer.getChannelData(channel).slice(startSample, endSample), channel);
    }

    const newAudioBlob = await audioBufferToWav(newAudioBuffer);
    return new Blob([newAudioBlob], { type: 'audio/wav' });
}

async function audioBufferToWav(audioBuffer) {
    const wavEncoder = new WavEncoder(audioBuffer.sampleRate, audioBuffer.numberOfChannels);
    const channelData = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i));
    }
    wavEncoder.encode(channelData);
    return wavEncoder.finish();
}

class WavEncoder {
    constructor(sampleRate, numChannels) {
        this.sampleRate = sampleRate;
        this.numChannels = numChannels;
        this.numSamples = 0;
        this.dataViews = [];
    }

    encode(channelData) {
        const len = channelData[0].length;
        const buf = new ArrayBuffer(len * this.numChannels * 2);
        const view = new DataView(buf);
        let offset = 0;
        for (let i = 0; i < len; i++) {
            for (let c = 0; c < this.numChannels; c++) {
                const sample = channelData[c][i];
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        this.dataViews.push(view);
        this.numSamples += len;
    }

    finish() {
        const dataLength = this.numChannels * this.numSamples * 2;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);

        // Write WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, this.numChannels, true);
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, this.sampleRate * this.numChannels * 2, true);
        view.setUint16(32, this.numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write audio data
        let offset = 44;
        for (let i = 0; i < this.dataViews.length; i++) {
            const dataView = this.dataViews[i];
            for (let j = 0; j < dataView.byteLength; j++) {
                view.setUint8(offset, dataView.getUint8(j));
                offset++;
            }
        }

        return buffer;
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

async function transcribeAudio(audioBlob) {
    const apiKey = localStorage.getItem('whisperApiKey');
    if (!apiKey) {
        throw new Error('APIキーが設定されていません');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`APIリクエストに失敗しました: ${response.statusText}`);
    }

    const result = await response.json();
    return result.text;
}

function saveToFile() {
    const text = transcriptionDiv.textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function copyToClipboard() {
    const text = transcriptionDiv.textContent;
    navigator.clipboard.writeText(text).then(() => {
        statusDiv.textContent = '文字起こしがクリップボードにコピーされました';
    }).catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
        statusDiv.textContent = 'クリップボードへのコピーに失敗しました';
    });
}

function downloadAudio() { // 追加
    if (trimmedAudioBlob) {
        const url = URL.createObjectURL(trimmedAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trimmed_audio.wav';
        a.click();
        URL.revokeObjectURL(url);
    }
}
