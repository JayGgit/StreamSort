// CHANGE WHEN NECESSARY
const demo = false // If you're running this locally, set this to false.



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

let currentTranscriptingChannel = null

app.use(express.static("public"))

app.get("/", (req, res) => {
    res.send(fs.readFileSync("public/index.html", "utf8"))
})

app.get("/sort", (req, res) => {
    res.send(fs.readFileSync("public/sort.html", "utf8"))
})

app.get("/api/demo", (req, res) => {
    if (demo) {
        return res.status(200).json({
            "demo": true,
            "channelName": currentDemoChannel,
            "displayName": currentDemoChannelDisplayName,
            "profilePicture": currentDemoChannelProfilePicture
        })
    } else {
        return false
    }
})

app.get("/api/liveStatus", async (req, res) => {
    if (demo) {
        return res.status(200).json({ error: "Demo mode is enabled. Custom transcriptions not enabled." })
    }

    const channelName = req.query.channelName

    if (!channelName) {
        return res.status(400).json({ error: "Channel name is required" })
    }

    const isLive = await getLiveStatus(channelName)
    res.json({"liveStatus": isLive})
})

app.get("/api/channelInfo", async (req, res) => {
    if (demo) {
        return res.status(200).json({ error: "Demo mode is enabled. Custom transcriptions not enabled." })
    }

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
    channelName = null
    if (demo) {
        console.log(currentDemoChannel)
        channelName = currentDemoChannel
    }
    else {
        channelName = req.query.channelName
    }

    if (channelName === currentTranscriptingChannel) {
        return res.status(200).json({ error: "Transcription is already in progress for this channel. Tune into current websocket" })
    }
    console.log("Received channel name:", channelName)
    currentTranscriptingChannel = channelName
    transcribeStream(channelName)

    res.json({ message: "Transcription started" })
})

app.get("/api/stopTranscription", (req, res) => {
    if (demo) {
        return res.status(200).json({ error: "Demo mode is enabled. Custom transcriptions not enabled." })
    }

    stopTranscribing()
    res.status(200).json({ message: "Transcription stopped" })
})

const server = app.listen(port, () => {
    console.log("Server running on localhost:" + port)
    open('http://localhost:' + port)
})

const wss = new WebSocket.Server({ server }) // WebSocket shares the same HTTP server/port

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

async function waitThenRefreshToken(timeout) {
    setTimeout(async () => {
        console.log("Refreshing Twitch client authentication token...")
        clientAuthToken = await getClientAuthToken()
        if (clientAuthToken) {
            console.log("Twitch client authentication token refreshed successfully.")
        } else {
            console.error("Failed to refresh Twitch client authentication token.")
        }
    }, timeout)
}

async function getClientAuthToken() { // Getting a Twitch client authentication token and returning it
    response = await axios.post("https://id.twitch.tv/oauth2/token", null, {
        params: {
            client_id: process.env.id,
            client_secret: process.env.secret,
            grant_type: "client_credentials"
        }
    })

    if (response.data.access_token) {
        waitThenRefreshToken(3600 * 1000) // Refresh token before it expires, in milliseconds (set to 1 hour)
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

async function getTopStream() { // Get the top stream on Twitch, used for demo mode
    response = await axios.get(`https://api.twitch.tv/helix/streams?first=1`, {
        headers: {
            "Client-ID": process.env.id,
            "Authorization": `Bearer ${clientAuthToken}`
        }
    })

    if (response.data.data[0]) {
        return response.data.data[0]
    }
}

let streamlink = null
let ffmpeg = null

async function transcribeStream(channelName) {
    const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en')

    streamlink = spawn("streamlink", [
        `https://www.twitch.tv/${channelName}`,
        "audio_only",
        "--stdout"
    ]);

    // Use FFmpeg to decode the HLS stream to PCM
    ffmpeg = spawn("ffmpeg", [
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

async function stopTranscribing() {
    if (currentTranscriptingChannel) {
        console.log(`Stopping transcription for channel: ${currentTranscriptingChannel}`)
        currentTranscriptingChannel = null
        // Stop ffmpeg and streamlink processes if they exist
        if (typeof ffmpeg !== 'undefined' && ffmpeg && !ffmpeg.killed) {
            ffmpeg.kill('SIGKILL')
        }
        if (typeof streamlink !== 'undefined' && streamlink && !streamlink.killed) {
            streamlink.kill('SIGKILL')
        }
        sendWebsocketMessage("Transcription stopped.")
    } else {
        console.log("No transcription in progress")
    }
}

async function getTwitchToken() {
    clientAuthToken = await getClientAuthToken()
}

getTwitchToken()

// Demo mode functionality

let currentDemoChannel = null
let currentDemoChannelDisplayName = null
let currentDemoChannelProfilePicture = null

async function refreshDemoChannel() {
    setInterval(demoModeChannelRefresh, 60 * 60 * 1000) // Refresh every hour
}

async function demoModeChannelRefresh() {
    refreshDemoChannel()
    while (!clientAuthToken) {
        await new Promise(resolve => setTimeout(resolve, 100)) // Wait for clientAuthToken to be set
    }
    const topStream = await getTopStream()
    if (topStream) {
        channelName = topStream.user_name
        console.log(`Demo mode active. Using channel: ${channelName}`)
        currentDemoChannel = channelName
        getChannelInfo(channelName).then(info => {
            currentDemoChannelProfilePicture = info.profile_image_url
            currentDemoChannelDisplayName = info.display_name
        })
    }
}

if (demo) {
    console.log("DEMO MODE ENABLED. IF YOU DO NOT KNOW WHAT THIS IS, DISABLE IT IN index.js")
    demoModeChannelRefresh()
}