function resetInputs() {
    document.getElementById("channelImage").src = ""
    document.getElementById("channelImage").style.display = "none"
    document.getElementById("channelName").style.width = "75vw"
    document.getElementById("channelAndNotesWrapper").style.height = "100vh"
    showSelectChannelButton(false)
}
function showOfflineWarning(value) {
    if (value == true) {
        document.getElementById("offlineWarning").style.color = "#333333"
        return
    }
    document.getElementById("offlineWarning").style.color = "transparent"
    return
}
function showSelectChannelButton(value) {
    if (value == true) {
        document.getElementById("selectChannel").style.display = "block"
        return
    }
    document.getElementById("selectChannel").style.display = "none"
    return
}

async function checkChannel() {
    const channelName = document.getElementById("channelName").value;

    if (!channelName || channelName === "") {
        resetInputs()
        showOfflineWarning(false)
        return
    }
    fetch(`/api/liveStatus?channelName=${encodeURIComponent(channelName)}`)
        .then(async response => {
            if (!response.ok) {
                throw new Error("Network response error: " + response.statusText)
            }
            const data = await response.json()
            if (data.liveStatus) {
                console.log("Channel is live")
                showOfflineWarning(false)
                await setChannelInfo(channelName)
                showSelectChannelButton(true)
                const input = document.getElementById("channelName")
                input.style.width = (input.value.length + 1) + "ch"
                document.getElementById("channelAndNotesWrapper").style.height = "50vh"
            }
            else {
                console.log("Channel is not live")
                showOfflineWarning(true)
                resetInputs()
            }
        })
        .catch(error => {
            console.error("Error fetching live status:", error)
        });
}

async function setChannelInfo(channelName) {
    if (!channelName) {
        return
    }
    fetch(`/api/channelInfo?channelName=${encodeURIComponent(channelName)}`)
        .then(async response => {
            if (!response.ok) {
                throw new Error("Network response error: " + response.statusText)
            }
            const data = await response.json()
            console.log("Channel Info:", data)
            // Set only image first
            document.getElementById("channelImage").src = data.profile_image_url
            // Wait for image to load before continuing
            await new Promise(resolve => {
                const img = document.getElementById("channelImage")
                if (img.complete) resolve()
                else img.onload = img.onerror = resolve
            })
            // Set other fields after image is done loading
            document.getElementById("channelName").value = data.display_name
            document.getElementById("channelImage").style.display = "block"
            return
        })
        .catch(error => {
            console.error("Error fetching channel info:", error)
        })

}

function selectChannel() {
    // Redirect to /sort with the channel name as a query
    const channelName = document.getElementById("channelName").value
    window.location.href = `/sort?channelName=${encodeURIComponent(channelName)}`
}
document.getElementById("channelName").addEventListener("input", checkChannel)
document.getElementById("selectChannel").addEventListener("click", selectChannel)
document.getElementById("channelName").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        // Check if select button is visible
        if (document.getElementById("selectChannel").style.display === "block") {
            selectChannel()
        }
    }
});

function checkDemoMode() {
    fetch('/api/demo')
        .then(async response => {
            if (!response.ok) {
                throw new Error("Network response error: " + response.statusText)
            }
            const data = await response.json()
            if (data.demo) {
                console.log("Demo mode active")
                document.getElementById("channelName").value = data.displayName
                document.getElementById("channelName").disabled = true
                document.getElementById("channelImage").src = data.profilePicture
                document.getElementById("channelImage").style.display = "block"
                document.getElementById("offlineWarning").innerHTML = "DEMO MODE ACTIVE. PREDETERMINED CHANNELS ONLY. RUN YOUR OWN SERVER FOR FULL FUNCTIONALITY."
                document.getElementById("channelAndNotesWrapper").style.height = "50vh"
                showOfflineWarning(true)
                showSelectChannelButton(true)
            } else {
                console.log("Demo mode not active")
            }
        })
        .catch(error => {
            console.error("Error checking demo mode:", error)
        });
}
checkDemoMode()