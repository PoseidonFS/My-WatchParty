// Constants
const usersKey = 'connectedUsers';
const CHECK_CONNECTIONS_INTERVAL = 1000; // 1 second

// Variables
let currentUserId;
let player;

// Keep track of current size mode (initially "default")
let currentSize = 'default';

// Initialize currentUserId based on URL parameters
(function initializeUser() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedVideoId = urlParams.get("videoId");
    const sharedUserId = urlParams.get("user");

    console.log("sharedUserId:", sharedUserId);

    currentUserId = sharedUserId ? generateUUID() : "admin";
    console.log("currentUserId:", currentUserId);

    addUser(currentUserId, 'connected');
    manageControlsVisibility(currentUserId);

    if (sharedVideoId) {
        createYouTubeWatchParty(sharedVideoId, currentUserId === "admin");
    }

    setInterval(checkConnections, CHECK_CONNECTIONS_INTERVAL);
})();

document.addEventListener('DOMContentLoaded', () => {
    const setVideoUrlBtn = document.getElementById("setVideoUrlBtn");
    if (setVideoUrlBtn) {
        setVideoUrlBtn.onclick = handleSetVideoUrl;
    }

    if (currentUserId === "admin") {
        initializeAdminControls();
    }

    // Create vertical container for video size controls
    const resizeContainer = document.createElement('div');
    resizeContainer.id = 'videoResizeControls';
    // Removed Fullscreen button, refined size labels
    resizeContainer.innerHTML = `
        <button id="miniPlayerBtn">Mini</button>
        <button id="defaultPlayerBtn">Default</button>
        <button id="theaterPlayerBtn">Theater</button>
    `;
    
    // Hide controls by default until a video is set
    resizeContainer.style.display = 'none';

    const playerElement = document.getElementById('player');
    if (playerElement && playerElement.parentNode) {
        playerElement.parentNode.insertBefore(resizeContainer, playerElement.nextSibling);
    }

    document.getElementById('miniPlayerBtn').addEventListener('click', () => setVideoSize('mini'));
    document.getElementById('defaultPlayerBtn').addEventListener('click', () => setVideoSize('default'));
    document.getElementById('theaterPlayerBtn').addEventListener('click', () => setVideoSize('theater'));
});

// Reveal buttons once video is set
function handleSetVideoUrl() {
    const urlInput = document.getElementById("videoUrlInput").value.trim();
    const videoIdMatch = urlInput.match(/(?:youtu\.be\/|v=)([^&]+)/);
    if (!videoIdMatch) return;

    const videoId = videoIdMatch[1];
    const shareLink = `${window.location.origin}${window.location.pathname}?videoId=${videoId}&user=friend`;
    document.getElementById("inviteLink").value = shareLink;

    // Show the resize buttons after video is set
    const resizeControls = document.getElementById('videoResizeControls');
    if (resizeControls) {
        resizeControls.style.display = 'flex';
    }

    if (currentUserId === "admin") {
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(videoId);
        } else {
            createYouTubeWatchParty(videoId, true);
        }
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getAllUsers() {
    return JSON.parse(localStorage.getItem(usersKey)) || {};
}

function setAllUsers(users) {
    localStorage.setItem(usersKey, JSON.stringify(users));
}

function addUser(userId, status) {
    const users = getAllUsers();
    users[userId] = { status: 'active', lastActive: Date.now() };
    console.log(`Adding user: ${userId}, status: ${status}, lastActive: ${users[userId].lastActive}`);
    setAllUsers(users);
    updateUserStatusUI(users);
}

function removeUser(userId) {
    const users = getAllUsers();
    if (users[userId]) {
        delete users[userId];
        setAllUsers(users);
        updateUserStatusUI(users);
    }
}

function updateUserStatus(userId, status) {
    const users = getAllUsers();
    if (users[userId]) {
        users[userId].status = status;
        users[userId].lastActive = Date.now();
        console.log(`Updating user: ${userId}, status: ${status}, lastActive: ${users[userId].lastActive}`);
        setAllUsers(users);
        updateUserStatusUI(users);
    }
}

function updateUserStatusUI(users) {
    const container = document.getElementById('userStatusContainer');
    container.innerHTML = '<h3>Connected Users</h3>';
    Object.keys(users).forEach(id => {
        const userDiv = document.createElement('div');
        userDiv.dataset.userId = id;
        userDiv.textContent = `${id === "admin" ? "Admin" : "User"}: ${truncateUUID(id)}`;
        userDiv.classList.add(id === "admin" ? 'admin' : 'friend', 'active');
        container.appendChild(userDiv);
    });

    container.querySelectorAll('div').forEach(el => {
        el.addEventListener('click', () => {
            const fullId = el.dataset.userId;
            el.textContent = el.textContent.includes('...') ? `${el.textContent.split(':')[0]}: ${fullId}` : `${el.textContent.split(':')[0]}: ${truncateUUID(fullId)}`;
        });
    });
}

function truncateUUID(uuid) {
    return uuid.length > 8 ? `${uuid.substring(0, 8)}...` : uuid;
}

window.addEventListener('beforeunload', () => {
    removeUser(currentUserId);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        updateUserStatus(currentUserId, 'inactive');
    } else {
        updateUserStatus(currentUserId, 'active');
    }
});

window.addEventListener('storage', (event) => {
    if (event.key === usersKey) {
        const users = JSON.parse(event.newValue) || {};
        updateUserStatusUI(users);
    }
});

function manageControlsVisibility(userId) {
    const adminControls = document.getElementById('adminControls');
    const friendControls = document.getElementById('friendControls');

    if (userId === "admin") {
        adminControls.style.display = "block";
        friendControls.style.display = "none";
    } else {
        adminControls.style.display = "none";
        friendControls.style.display = "flex";
    }
}

function createYouTubeWatchParty(videoId, isAdmin) {
    if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.id = 'youtube-iframe-api';
        document.body.appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player("player", {
            height: '390',
            width: '640',
            videoId,
            playerVars: {
                'controls': isAdmin ? 1 : 0,
                'disablekb': isAdmin ? 0 : 1,
                'modestbranding': 1,
                'rel': 0
            },
            events: {
                onReady: () => {
                    console.log("YouTube Player is ready.");
                    if (isAdmin) {
                        initializeAdminControls();
                    } else {
                        initFriendControls();
                        listenForBroadcast();
                    }
                },
                onStateChange: (e) => {
                    if (isAdmin) {
                        const currentTime = player.getCurrentTime();
                        const payload = {
                            state: e.data,
                            time: currentTime,
                            stamp: Date.now(),
                        };
                        localStorage.setItem("ytWatchPartySync", JSON.stringify(payload));
                    }
                },
            },
        });

        if (!player) {
            console.error("YouTube Player failed to initialize.");
        }
    };
}

function initializeAdminControls() {
    const playPauseBtn = document.getElementById("playPauseBtn");
    const muteBtn = document.getElementById("muteBtn");
    const skipForwardBtn = document.getElementById("skipForwardBtn");
    const skipBackwardBtn = document.getElementById("skipBackwardBtn");

    let isPlaying = false;

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (isPlaying) {
                player.pauseVideo();
                updateUserStatus(currentUserId, 'paused');
                broadcastAction('pause');
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            } else {
                player.playVideo();
                updateUserStatus(currentUserId, 'playing');
                broadcastAction('play');
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            }
            isPlaying = !isPlaying;
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (player.isMuted()) {
                player.unMute();
                updateUserStatus(currentUserId, 'unmuted');
                broadcastAction('unmute');
            } else {
                player.mute();
                updateUserStatus(currentUserId, 'muted');
                broadcastAction('mute');
            }
        });
    }

    if (skipForwardBtn) {
        skipForwardBtn.addEventListener('click', () => {
            const currentTime = player.getCurrentTime();
            player.seekTo(currentTime + 30, true);
            updateUserStatus(currentUserId, 'skip_forward');
            broadcastAction('skip_forward');
        });
    }

    if (skipBackwardBtn) {
        skipBackwardBtn.addEventListener('click', () => {
            const currentTime = player.getCurrentTime();
            player.seekTo(currentTime - 30, true);
            updateUserStatus(currentUserId, 'skip_backward');
        });
    }
}

function broadcastAction(action) {
    const payload = `${action}_${Date.now()}`;
    localStorage.setItem("ytWatchPartyAction", payload);
}

function initFriendControls() {
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeBar = document.getElementById("volumeBar");

    if (volumeSlider && volumeBar) {
        console.log('Friend controls initialized.');

        const initialVolume = player.getVolume();
        console.log('Initial player volume:', initialVolume);
        volumeSlider.value = initialVolume;
        volumeBar.style.width = `${initialVolume}%`;

        volumeSlider.addEventListener('input', function () {
            const volume = parseInt(this.value, 10);
            console.log('Volume slider changed:', volume);
            player.setVolume(volume);
            console.log('Player volume set to:', volume);
            volumeBar.style.width = `${volume}%`;
            updateUserStatus(currentUserId, 'volume: ' + volume);
        });
    } else {
        console.error('Volume slider or volume bar element not found.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (player && typeof player.getVolume === 'function' && typeof player.setVolume === 'function') {
        initFriendControls();
    } else {
        console.error('Player is not initialized or missing required methods.');
    }
});

function listenForBroadcast() {
    window.addEventListener("storage", (e) => {
        if (e.key === "ytWatchPartyAction" && e.newValue) {
            const [action] = e.newValue.split("_");
            switch (action) {
                case "play":
                    player.playVideo();
                    break;
                case "pause":
                    player.pauseVideo();
                    break;
                case "mute":
                    player.mute();
                    break;
                case "unmute":
                    player.unMute();
                    break;
                case "skip_forward":
                    player.seekTo(player.getCurrentTime() + 30, true);
                    break;
                case "skip_backward":
                    player.seekTo(player.getCurrentTime() - 30, true);
                    break;
            }
        }
        if (e.key === "ytWatchPartySync" && e.newValue) {
            const { state, time } = JSON.parse(e.newValue);
            player.seekTo(time, true);
            if (state === YT.PlayerState.PLAYING) player.playVideo();
            if (state === YT.PlayerState.PAUSED) player.pauseVideo();
        }
    });
}

function checkConnections() {
    const users = getAllUsers();
    const currentTime = Date.now();
    const timeout = CHECK_CONNECTIONS_INTERVAL;

    console.log("Users before check:", users);

    let updated = false;

    for (const id in users) {
        if (currentTime - users[id].lastActive > timeout) {
            console.log(`Removing user: ${id}, lastActive: ${users[id].lastActive}`);
            delete users[id];
            updated = true;
        }
    }

    if (updated) {
        setAllUsers(users);
        updateUserStatusUI(users);
    }

    console.log("Users after check:", users);
}

function setVideoSize(mode) {
    const playerContainer = document.getElementById('player');
    if (!playerContainer) return;

    // If clicking the same mode, revert to default
    if (mode === currentSize) {
        mode = 'default';
    }

    // Remove all known size classes
    playerContainer.classList.remove('video-size-mini', 'video-size-default', 'video-size-theater');

    // Apply the new size mode, if not default
    if (mode !== 'default') {
        playerContainer.classList.add(`video-size-${mode}`);
    }

    currentSize = mode;
}

localStorage.removeItem(usersKey);
