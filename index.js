const axios = require("axios")
const env = require("dotenv").config()
const { spawn } = require("child_process")
const fs = require("fs")
const { pipeline } = require('@xenova/transformers')
const express = require("express")
const app = express()
const WebSocket = require('ws')
const { send } = require("process")
const open = require('open').default

const port = 8000

const wss = new WebSocket.Server({ port: 8001 }) // Websocket for real time transcriptions

let currentTranscriptingChannel = null

app.use(express.static("public"))

app.get("/", (req, res) => {
    res.send(fs.readFileSync("public/index.html", "utf8"))
})

app.get("/sort", (req, res) => {
    res.send(fs.readFileSync("public/sort.html", "utf8"))
})

app.get("/api/liveStatus", async (req, res) => {
    const channelName = req.query.channelName

    if (!channelName) {
        return res.status(400).json({ error: "Channel name is required" })
    }

    const isLive = await getLiveStatus(channelName)
    res.json({"liveStatus": isLive})
})

app.get("/api/channelInfo", async (req, res) => {
    const channelName = req.query.channelName
    if (!channelName) {
        return res.status(400).json({ error: "Channel name is required" })
    }
    const channelInfo = await getChannelInfo(channelName)
    if (!channelInfo) {
        return res.status(404).json({ error: "Channel not found" })
    }
    res.json(channelInfo)
})

app.get("/api/startTranscription", (req, res) => {
    const channelName = req.query.channelName

    if (channelName === currentTranscriptingChannel) {
        return res.status(200).json({ error: "Transcription is already in progress for this channel. Tune into current websocket" })
    }
    console.log("Received channel name:", channelName)
    currentTranscriptingChannel = channelName
    transcribeStream(channelName)

    res.json({ message: "Transcription started" })
})

app.listen(port, () => {
    console.log("Server running on localhost:" + port)
    open('http://localhost:' + port)
})

// Transcription and Twitch integrations
if (env.error) {
    throw env.error
}

function sendWebsocketMessage(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                "transcription": "<i class='ci-info'></i> " + message,
                "type": "message"
            }))
        }
    })
}

clientAuthToken = null

async function getClientAuthToken() { // Getting a Twitch client authentication token and returning it
    response = await axios.post("https://id.twitch.tv/oauth2/token", null, {
        params: {
            client_id: process.env.id,
            client_secret: process.env.secret,
            grant_type: "client_credentials"
        }
    })

    if (response.data.access_token) {
        return response.data.access_token
    }
    return null
}

async function getLiveStatus(channelName) { // Checking if a Twitch channel is live
    response = await axios.get(`https://www.twitch.tv/${channelName}`)

    if (response.data.includes("isLiveBroadcast")) {
        return true
    }
    return false
}

async function getChannelInfo(channelName) { // Getting information about a Twitch channel
    response = await axios.get(`https://api.twitch.tv/helix/users?login=${channelName}`, {
        headers: {
            "Client-ID": process.env.id,
            "Authorization": `Bearer ${clientAuthToken}`
        }
    })

    if (response.data.data[0]) {
        return response.data.data[0]
    }
}

async function transcribeStream(channelName) {
    const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en')

    const streamlink = spawn("streamlink", [
        `https://www.twitch.tv/${channelName}`,
        "audio_only",
        "--stdout"
    ]);

    // Use FFmpeg to decode the HLS stream to PCM
    const ffmpeg = spawn("ffmpeg", [
        "-i", "pipe:0",        // Input from streamlink (HLS segments)
        "-vn",                 // No video
        "-acodec", "pcm_s16le", // Convert to PCM 16-bit little endian
        "-ar", "16000",        // 16kHz sample rate (required by wav2vec2)
        "-ac", "1",            // Mono audio
        "-f", "wav",           // Output as WAV format
        "pipe:1"               // Output to stdout
    ]);

    // Pipe streamlink HLS output to ffmpeg
    streamlink.stdout.pipe(ffmpeg.stdin)

    let audioBuffer = Buffer.alloc(0)
    let wavHeaderSkipped = false
    const chunkSize = 16000 * 5 // Multiplied number is ~1 second of audio

    console.log("Starting transcription")
    sendWebsocketMessage(`Starting transcription for channel: ${channelName}.`)
    sendWebsocketMessage("Transcriptions may have a delay depending on the host computer's performance.")

    ffmpeg.stdout.on("data", (data) => {
        // console.log("Received decoded PCM audio data...")
        
        // Skip WAV header on first chunk
        if (!wavHeaderSkipped && data.length > 44) {
            if (data.slice(0, 4).toString() === 'RIFF') {
                data = data.slice(44)
                wavHeaderSkipped = true
            }
        }
        
        audioBuffer = Buffer.concat([audioBuffer, data])
        
        if (audioBuffer.length >= chunkSize) {
            // console.log(`Processing audio chunk of size: ${audioBuffer.length}`);
            const chunk = audioBuffer.slice(0, chunkSize)
            audioBuffer = audioBuffer.slice(chunkSize)
            
            processAudioChunk(chunk)
        }
    });

    async function processAudioChunk(chunk) {
        // console.log("Starting transcription for audio chunk...");
        try {
            // Convert PCM data to Float32Array for transformers.js
            const audioArray = new Float32Array(chunk.length / 2);
            for (let i = 0; i < audioArray.length; i++) {
                audioArray[i] = chunk.readInt16LE(i * 2) / 32768.0;
            }
            
            // Transcribe with explicit sampling rate
            const result = await transcriber(audioArray, { 
                sampling_rate: 16000,
                chunk_length_s: 30,
                stride_length_s: 5
            });
            
            if (result.text && result.text.trim()) {
                console.log(`Transcription: ${result.text}`);
                // Send transcription to WebSocket clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            "transcription": result.text,
                            "channelName": channelName,
                            "type": "transcription"
                        }))
                    }
                })
            } else {
                console.log("No speech detected in this chunk")
            }
        } catch (error) {
            console.error('Transcription error:', error)
            console.error('Error details:', error.message)
            sendWebsocketMessage(`Transcription error: ${error.message}`)
        }
    }

    ffmpeg.stderr.on("data", (data) => {
        const errorMsg = data.toString();
        // Only log actual errors, not info messages
        if (errorMsg.includes('Error') || errorMsg.includes('Failed')) {
            console.error(`FFmpeg error: ${errorMsg}`);
        }
    });

    streamlink.stderr.on("data", (data) => {
        console.error(`streamlink error: ${data}`)
        if (data.includes("[stream.hls][warning] Encountered a stream discontinuity. This is unsupported and will result in incoherent output data.")) {
            sendWebsocketMessage("Either the stream is buffering, or an ad is playing. Transcription may be inaccurate during this time.")
        }
    })

    streamlink.on("close", (code) => {
        console.log(`streamlink process exited with code ${code}`)
        ffmpeg.stdin.end();
    })

    ffmpeg.on("close", (code) => {
        console.log(`ffmpeg process exited with code ${code}`)
    })
}

async function getTwitchToken() {
    clientAuthToken = await getClientAuthToken()
}

getTwitchToken()