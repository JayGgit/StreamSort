// Transcription functions

function getChannelName() {
    const params = new URLSearchParams(window.location.search)
    return params.get('channelName')
}

function setTwitchEmbed() {
    document.getElementById("twitchEmbed").src = `https://player.twitch.tv/?channel=${getChannelName()}&parent=localhost&autoplay=true`
}

function startBackendTranscription() {
    fetch(`/api/startTranscription?channelName=${encodeURIComponent(getChannelName())}`, {
        method: 'GET'
    })
}

function startWebsocket() {
    const serverUrl = 'ws://localhost:8001'
    const connection = new WebSocket(serverUrl)

    connection.onopen = () => {
        console.log("WebSocket connected")
    }

    connection.onmessage = (event) => {
        data = JSON.parse(event.data)
        console.log(data)
        // Appends a new p tag with the transcription text to the start of the div
        document.getElementById("transcriptionWrapper").innerHTML = `<p>${data.transcription}</p>` + document.getElementById("transcriptionWrapper").innerHTML
        if (data.type === "transcription") {
            queueWords(data.transcription)
        }
    }
}

// Startup these functions
setTwitchEmbed()
startBackendTranscription()
startWebsocket()

// Sorting array functions

let toBeSorted = []
let selectedIndex = 0
let queuedWords = []
let sortType = "bogo"

let isSorting = false

function addSortNumber(value) {
    toBeSorted.push(value)
}

function updateHTMLSortTable() {
    const table = document.getElementById("sortTable")
    table.innerHTML = "" // Clear the table

    toBeSorted.forEach((value, index) => {
        bar = document.createElement("div")
        valueTag = document.createElement("p")
        valueTag.innerText = value
        valueTag.className = "sortValue"
        bar.id = index
        bar.className = "sortBar"
        if (index === selectedIndex) {
            bar.classList.add("selectedBar")
        }
        bar.style.height = `${value * 10}%`
        table.appendChild(bar)
        bar.appendChild(valueTag)
    })
}

function checkSorted() {
    for (let i = 0; i < toBeSorted.length - 1; i++) {
        if (toBeSorted[i] > toBeSorted[i + 1]) {
            return false
        }
    }
    document.getElementById("currentWord").innerText = "Sorting completed!"
    document.getElementById("toggleSort").innerText = "Start Sorting"
    document.querySelectorAll(".sortBar").forEach(bar => {
        bar.classList.add("completedBar")
        bar.classList.remove("selectedBar")
    })
    isSorting = false
    return true
}

function queueWords(words) {
    words.split(" ").forEach((word) => {
        word = word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        if (word.length === 0) return // Remove empty words
        if (queuedWords.includes(word)) return // Remove duplicate words (Transcription may not be 100% accurate)
        queuedWords.push(word)
    })
}

// For bogo sort
let BogoMap = {} // Map of words that goes into an action

function checkWordBogo(word) {
    if (!BogoMap[word]) {
    /*
        1 - Move selected left
        2 - Move selected right
        3 - Select left
        4 - Select right
    */
        BogoMap[word] = Math.floor(Math.random() * 4) + 1
    }
    return BogoMap[word]
}

setInterval(() => {
    // Check queued words and if we're sorting
    if (queuedWords.length > 0 && isSorting && !checkSorted()) {
        currentActionMessage = document.getElementById("currentWord")
        const word = queuedWords.shift()

        if (sortType === "bogo") {
            action = checkWordBogo(word)
            currentActionMessage.innerText = "[" + word + "] - "
            const selectedValue = toBeSorted[selectedIndex]

            if (action == 1) {
                // Move selected left

                // First check if moving left would sort the array
                if (selectedIndex > 0 && toBeSorted[selectedIndex - 1] < selectedValue) {
                    currentActionMessage.innerText += " Move to the left (Canceled since it is already sorted)"
                    currentActionMessage.innerHTML = "<i class='ci-Arrow_Left_LG'></i> " + currentActionMessage.innerText
                    return
                }
                if (selectedIndex > 0) {
                    currentActionMessage.innerText += " Move to the left"
                    currentActionMessage.innerHTML = "<i class='ci-Arrow_Left_LG'></i> " + currentActionMessage.innerText
                    const temp = toBeSorted[selectedIndex - 1]
                    toBeSorted[selectedIndex - 1] = selectedValue
                    toBeSorted[selectedIndex] = temp
                    selectedIndex--
                }
                else {
                    currentActionMessage.innerText += " Cannot move left, already at the start"
                    currentActionMessage.innerHTML = "<i class='ci-Stop_Sign'></i> " + currentActionMessage.innerText
                }
            }
            if (action == 2) {
                // Move selected right

                // First check if moving right would sort the array
                if (selectedIndex < toBeSorted.length - 1 && toBeSorted[selectedIndex + 1] > selectedValue) {
                    currentActionMessage.innerText += " Move to the right (Canceled since it is already sorted)"
                    currentActionMessage.innerHTML = "<i class='ci-Arrow_Right_LG'></i> " + currentActionMessage.innerText
                    return
                }
                if (selectedIndex < toBeSorted.length - 1) {
                    currentActionMessage.innerText += " Move to the right"
                    currentActionMessage.innerHTML = "<i class='ci-Arrow_Right_LG'></i> " + currentActionMessage.innerText
                    const temp = toBeSorted[selectedIndex + 1]
                    toBeSorted[selectedIndex + 1] = selectedValue
                    toBeSorted[selectedIndex] = temp
                    selectedIndex++
                }
                else {
                    currentActionMessage.innerText += " Cannot move right, already at the end"
                    currentActionMessage.innerHTML = "<i class='ci-Stop_Sign'></i> " + currentActionMessage.innerText
                }
            }
            if (action == 3) {
                // Select left
                if (selectedIndex > 0) {
                    currentActionMessage.innerText += " Select to the left"
                    currentActionMessage.innerHTML = "<i class='ci-Arrow_Undo_Up_Left'></i> " + currentActionMessage.innerText
                    selectedIndex--
                }
                else {
                    currentActionMessage.innerText += " Cannot select left, already at the start"
                    currentActionMessage.innerHTML = "<i class='ci-Stop_Sign'></i> " + currentActionMessage.innerText
                }
            }
            if (action == 4) {
                if (selectedIndex < toBeSorted.length - 1) {
                    currentActionMessage.innerText += " Select to the right"
                    currentActionMessage.innerHTML = "<i class='ci-Arrow_Undo_Up_Right'></i> " + currentActionMessage.innerText
                    selectedIndex++
                }
                else {
                    currentActionMessage.innerText += " Cannot select right, already at the end"
                    currentActionMessage.innerHTML = "<i class='ci-Stop_Sign'></i> " + currentActionMessage.innerText
                }
            }
        }
        updateHTMLSortTable()
    }
}, 500)

document.getElementById("generate").addEventListener("click", (event) => {
    toBeSorted = []
    for (let i = 0; i < 10; i++) {
        addSortNumber(Math.floor(Math.random() * 10) + 1)
    }
    updateHTMLSortTable()
})

document.getElementById("toggleSort").addEventListener("click", (event) => {
    isSorting = !isSorting
    if (isSorting) {
        event.target.innerText = "Stop Sorting"
        document.getElementById("currentWord").innerText = "Sorting started..."
    } else {
        event.target.innerText = "Start Sorting"
        document.getElementById("currentWord").innerText = "Sorting stopped."
    }
})