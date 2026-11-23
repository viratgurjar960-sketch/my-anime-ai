import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// --- 1. IndexedDB स्टोरेज (कस्टम .VRM मॉडल हमेशा सेव रखने के लिए) ---
const DB_NAME = "AnimeAI_3D_Storage";
const STORE_NAME = "vrm_models";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e);
    });
}

async function saveModelToPhone(charId, fileBlob) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(fileBlob, charId);
        tx.oncomplete = () => resolve();
    });
}

async function getModelFromPhone(charId) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(charId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

async function clearAllSavedModels() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
}

// --- 2. आपकी नई 3D इमेज (characters.png) के सभी 8 कैरेक्टर्स ---
const geminiCharacters = [
    // ऊपर की लाइन: 4 लड़कियां (Row 1)
    {
        id: "Aoede",
        name: "Aoede (लड़की 1)",
        gender: "female",
        style: "Bold & Rocker",
        imgSheet: "url('characters.png')",
        cropPos: "0% 0%",
        pitch: 1.25,
        rate: 1.08,
        bgTheme: "radial-gradient(circle at center, #4a1525, #120914)",
        persona: "तुम Aoede हो, एक निडर, कूल और स्टाइलिश रॉकस्टार एनिमे लड़की।"
    },
    {
        id: "Kore",
        name: "Kore (लड़की 2)",
        gender: "female",
        style: "Calm & Elegant",
        imgSheet: "url('characters.png')",
        cropPos: "33.33% 0%",
        pitch: 1.18,
        rate: 0.98,
        bgTheme: "radial-gradient(circle at center, #2c3545, #10141d)",
        persona: "तुम Kore हो, एक शांत, सौम्य और बुद्धिमान एनिमे लड़की।"
    },
    {
        id: "Leda",
        name: "Leda (लड़की 3)",
        gender: "female",
        style: "Playful & Cute",
        imgSheet: "url('characters.png')",
        cropPos: "66.66% 0%",
        pitch: 1.42,
        rate: 1.12,
        bgTheme: "radial-gradient(circle at center, #3d2442, #140c18)",
        persona: "तुम Leda हो, एक बेहद चुलबुली, हंसमुख और मज़ाकिया एनिमे लड़की।"
    },
    {
        id: "Zephyr",
        name: "Zephyr (लड़की 4)",
        gender: "female",
        style: "Sweet & Friendly",
        imgSheet: "url('characters.png')",
        cropPos: "100% 0%",
        pitch: 1.32,
        rate: 1.05,
        bgTheme: "radial-gradient(circle at center, #1e3a5f, #0d1726)",
        persona: "तुम Zephyr हो, एक प्यारी, मिलनसार और हमेशा खुश रहने वाली एनिमे दोस्त।"
    },

    // नीचे की लाइन: 4 लड़के (Row 2)
    {
        id: "Puck",
        name: "Puck (लड़का 1)",
        gender: "male",
        style: "Cool & Casual",
        imgSheet: "url('characters.png')",
        cropPos: "0% 100%",
        pitch: 0.92,
        rate: 1.05,
        bgTheme: "radial-gradient(circle at center, #262936, #101117)",
        persona: "तुम Puck हो, एक स्मार्ट, कूल और दोस्ताना एनिमे लड़का।"
    },
    {
        id: "Charon",
        name: "Charon (लड़का 2)",
        gender: "male",
        style: "Dreamy & Artistic",
        imgSheet: "url('characters.png')",
        cropPos: "33.33% 100%",
        pitch: 0.78,
        rate: 0.96,
        bgTheme: "radial-gradient(circle at center, #4a2538, #170c14)",
        persona: "तुम Charon हो, बड़े सपने देखने वाला एक गहरा और समझदार एनिमे लड़का।"
    },
    {
        id: "Fenrir",
        name: "Fenrir (लड़का 3)",
        gender: "male",
        style: "Sharp & Bold",
        imgSheet: "url('characters.png')",
        cropPos: "66.66% 100%",
        pitch: 0.85,
        rate: 1.08,
        bgTheme: "radial-gradient(circle at center, #18344a, #0b1620)",
        persona: "तुम Fenrir हो, नीली आँखों वाला एक निडर, जोशीला और भरोसेमंद एनिमे हीरो।"
    },
    {
        id: "Orus",
        name: "Orus (लड़का 4)",
        gender: "male",
        style: "Chill & Music Lover",
        imgSheet: "url('characters.png')",
        cropPos: "100% 100%",
        pitch: 0.80,
        rate: 0.95,
        bgTheme: "radial-gradient(circle at center, #2d2a3d, #12111a)",
        persona: "तुम Orus हो, संगीत सुनने वाला एक बेहद शांत और सुकून भरा एनिमे साथी।"
    }
];

let currentIndex = parseInt(localStorage.getItem("savedCharIndex") || "0", 10);
const apiKeyInput = document.getElementById('gemini-key');
apiKeyInput.value = localStorage.getItem("savedGeminiKey") || "";
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem("savedGeminiKey", apiKeyInput.value.trim());
});

// --- 3. 3D टच-टिल्ट (Touch & Mouse Tilt Interaction) ---
const tiltWrapper = document.getElementById('tilt-wrapper');
const stage = document.getElementById('live-2d-stage');

function handleTilt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    const rotateY = x * 32; // बाएं-दाएं झुकाव
    const rotateX = -y * 24; // ऊपर-नीचे झुकाव
    tiltWrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
}

function resetTilt() {
    tiltWrapper.style.transform = `rotateX(0deg) rotateY(0deg)`;
}

stage.addEventListener('touchmove', (e) => {
    if (e.touches) {
        handleTilt(e.touches.clientX, e.touches.clientY);
    }
}, { passive: true });
stage.addEventListener('touchend', resetTilt);

stage.addEventListener('mousemove', (e) => handleTilt(e.clientX, e.clientY));
stage.addEventListener('mouseleave', resetTilt);

// --- 4. वैकल्पिक .VRM 3D इंजन ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.set(0, 1.28, 1.85);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.DirectionalLight(0xffffff, 1.5));
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
let currentVrm = null;

// --- 5. कैरेक्टर स्विच और सेव करना ---
async function applyCharacter(index, announce = true) {
    currentIndex = index;
    localStorage.setItem("savedCharIndex", index.toString());
    const char = geminiCharacters[index];

    const miniAvatar = document.getElementById('current-char-img');
    miniAvatar.style.backgroundImage = char.imgSheet;
    miniAvatar.style.backgroundPosition = char.cropPos;

    const live2dAvatar = document.getElementById('live-2d-avatar');
    live2dAvatar.style.backgroundImage = char.imgSheet;
    live2dAvatar.style.backgroundPosition = char.cropPos;

    document.getElementById('current-char-name').textContent = char.name;
    document.getElementById('current-char-tag').textContent = `${char.style} • टैप कर बदलें`;
    document.getElementById('chat-title-text').textContent = `💬 ${char.id} से चैट करें (बड़ा करने के लिए टैप करें)`;
    document.getElementById('upload-btn-text').textContent = `${char.id} के लिए कस्टम .VRM मॉडल जोड़ें`;
    document.body.style.background = char.bgTheme;

    const savedVrm = await getModelFromPhone(char.id);
    if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
        currentVrm = null;
    }

    if (savedVrm) {
        stage.style.opacity = "0";
        const url = URL.createObjectURL(savedVrm);
        loader.load(url, (gltf) => {
            const vrm = gltf.userData.vrm;
            scene.add(vrm.scene);
            currentVrm = vrm;
            vrm.scene.rotation.y = Math.PI;
        });
    } else {
        stage.style.opacity = "1";
    }

    await renderCharacterGrid();

    if (announce) {
        const msg = `हाय! मैं ${char.id} हूँ। अब तुम मुझसे बात कर सकते हो!`;
        addMessage(msg, false);
        speakText(msg);
    }
}

applyCharacter(currentIndex, false);

document.getElementById('quick-switch-pill').addEventListener('click', () => {
    applyCharacter((currentIndex + 1) % geminiCharacters.length, true);
});

document.getElementById('vrm-file-input').addEventListener('change', async (e) => {
    const file = e.target.files;
    if (file) {
        await saveModelToPhone(geminiCharacters[currentIndex].id, file);
        await applyCharacter(currentIndex, true);
        document.getElementById('settings-modal').classList.add('hidden');
    }
});

document.getElementById('reset-models-btn').addEventListener('click', async () => {
    await clearAllSavedModels();
    await applyCharacter(currentIndex, true);
    document.getElementById('settings-modal').classList.add('hidden');
});

// --- 6. सेटिंग्स गैलरी ---
const settingsModal = document.getElementById('settings-modal');
document.getElementById('open-settings-btn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('close-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));

async function renderCharacterGrid() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';

    for (let idx = 0; idx < geminiCharacters.length; idx++) {
        const char = geminiCharacters[idx];
        const has3D = await getModelFromPhone(char.id);
