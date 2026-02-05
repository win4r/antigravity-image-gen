#!/usr/bin/env node

/**
 * Antigravity Image Generator (Native)
 * Uses the google-antigravity OAuth token to generate images via the Cloud Code sandbox API.
 * Supports automatic token refresh when expired.
 * 
 * Usage:
 *   node generate.js --prompt "..." --output "..." [--aspect-ratio "16:9"]
 */

const fs = require('node:fs');
const https = require('node:https');
const { Buffer } = require('node:buffer');
const path = require('node:path');

// --- Config ---
const ENDPOINT = "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse";
const PROFILE_PATH = "/home/ubuntu/.clawdbot/agents/main/agent/auth-profiles.json";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// OAuth credentials (same as OpenClaw uses)
const CLIENT_ID = Buffer.from("==", 'base64').toString();
const CLIENT_SECRET = Buffer.from("=", 'base64').toString();

// Project ID found in auth profile or fallback
const FALLBACK_PROJECT_ID = "junoai-465910"; 

// --- Args Parsing ---
const args = process.argv.slice(2);
let prompt = "";
let outputFile = "";
let aspectRatio = "1:1";

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i+1]) {
        prompt = args[i+1];
        i++;
    } else if (args[i] === '--output' && args[i+1]) {
        outputFile = args[i+1];
        i++;
    } else if (args[i] === '--aspect-ratio' && args[i+1]) {
        aspectRatio = args[i+1];
        i++;
    }
}

if (!prompt) {
    console.error("Error: --prompt is required");
    process.exit(1);
}

if (!outputFile) {
    const dir = path.join(process.env.HOME || '/home/ubuntu', 'clawd/generated-images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    outputFile = path.join(dir, `antigravity_${Date.now()}.png`);
}

// --- Token Refresh ---
async function refreshToken(refreshToken, projectId) {
    console.log("   🔄 Token expired, refreshing...");
    
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });
    
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
    }
    
    const data = await response.json();
    return {
        access: data.access_token,
        refresh: data.refresh_token || refreshToken,
        expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
        projectId,
    };
}

// --- Update Profile File ---
function updateProfile(profileKey, newTokenData, profiles) {
    profiles.profiles[profileKey] = {
        ...profiles.profiles[profileKey],
        access: newTokenData.access,
        refresh: newTokenData.refresh,
        expires: newTokenData.expires,
    };
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profiles, null, 2));
    console.log("   ✅ Token refreshed and saved");
}

// --- Main ---
async function main() {
    console.log("🔐 Loading Antigravity credentials...");
    if (!fs.existsSync(PROFILE_PATH)) {
        console.error(`Error: Auth profile not found at ${PROFILE_PATH}`);
        process.exit(1);
    }

    let token = "";
    let projectId = FALLBACK_PROJECT_ID;
    let profiles;

    try {
        profiles = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
        
        // Priority 1: Use lastGood if available
        const lastGoodKey = profiles.lastGood?.["google-antigravity"];
        
        const now = Date.now();
        const antigravityKeys = Object.keys(profiles.profiles).filter(k => k.startsWith("google-antigravity"));
        
        let profileKey = null;
        let auth = null;
        
        // Try lastGood first
        if (lastGoodKey && profiles.profiles[lastGoodKey]) {
            profileKey = lastGoodKey;
            auth = profiles.profiles[lastGoodKey];
            console.log(`   Using lastGood profile: ${lastGoodKey}`);
        }
        
        // Fallback: find any profile with refresh token
        if (!auth) {
            for (const key of antigravityKeys) {
                const candidate = profiles.profiles[key];
                if (candidate.access && candidate.refresh) {
                    profileKey = key;
                    auth = candidate;
                    console.log(`   Using profile: ${key}`);
                    break;
                }
            }
        }

        if (!auth || !auth.access) {
            console.error("Error: No google-antigravity profile found.");
            console.error("Run: openclaw models auth login --provider google-antigravity");
            process.exit(1);
        }
        
        // Check if token is expired
        if (auth.expires && auth.expires <= now) {
            if (!auth.refresh) {
                console.error("Error: Token expired and no refresh token available.");
                console.error("Run: openclaw models auth login --provider google-antigravity");
                process.exit(1);
            }
            
            // Refresh the token
            const newTokenData = await refreshToken(auth.refresh, auth.projectId || FALLBACK_PROJECT_ID);
            updateProfile(profileKey, newTokenData, profiles);
            token = newTokenData.access;
            projectId = newTokenData.projectId;
        } else {
            token = auth.access;
            if (auth.projectId) projectId = auth.projectId;
            console.log("   ✅ Token is valid");
        }
        
    } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
    }

    // --- Request ---
    const payload = {
        project: projectId,
        model: "gemini-3-pro-image",
        request: {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],
            systemInstruction: {
                parts: [{ text: "You are an AI image generator. Generate images based on user descriptions." }]
            },
            generationConfig: {
                imageConfig: { aspectRatio: aspectRatio },
                candidateCount: 1
            }
        },
        requestType: "agent",
        requestId: `agent-${Date.now()}`,
        userAgent: "antigravity"
    };

    console.log(`🎨 Generating image...`);
    console.log(`   Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    console.log(`   Ratio:  ${aspectRatio}`);

    return new Promise((resolve, reject) => {
        const req = https.request(ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'User-Agent': 'antigravity/2.0.0 darwin/arm64',
                'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
                'Client-Metadata': JSON.stringify({
                    ideType: "IDE_UNSPECIFIED",
                    platform: "PLATFORM_UNSPECIFIED",
                    pluginType: "GEMINI",
                })
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                console.error(`API Error: ${res.statusCode} ${res.statusMessage}`);
            }

            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk.toString();
            });

            res.on('end', () => {
                const lines = data.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try {
                            const json = JSON.parse(line.substring(5));
                            
                            const parts = json.response?.candidates?.[0]?.content?.parts;
                            if (parts) {
                                for (const part of parts) {
                                    if (part.inlineData && part.inlineData.data) {
                                        fs.writeFileSync(outputFile, Buffer.from(part.inlineData.data, 'base64'));
                                        console.log(`✅ Image saved to: ${outputFile}`);
                                        console.log(`MEDIA: ${outputFile}`);
                                        resolve();
                                        return;
                                    } else if (part.text) {
                                        console.log(`Model message: ${part.text}`);
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore parse errors for keep-alives
                        }
                    }
                }
                console.error("❌ No image data found in response.");
                console.error("Raw start:", data.substring(0, 200));
                reject(new Error("No image data"));
            });
        });

        req.on('error', (e) => {
            console.error(`Request error: ${e.message}`);
            reject(e);
        });

        req.write(JSON.stringify(payload));
        req.end();
    });
}

main().catch(e => {
    console.error(`Fatal: ${e.message}`);
    process.exit(1);
});
