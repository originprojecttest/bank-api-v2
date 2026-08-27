import "dotenv/config";
import express from "express";
import cors from "cors";

// ==========================================
// 1. CORE FUNCTIONAL MODULE IMPORTS
// ==========================================
import checkHandler from "./api/bank/check.js";
import dataHandler from "./api/bank/data.js";
import forgotPasswordHandler from "./api/bank/forgot-password.js";
import loginUserHandler from "./api/bank/login-user.js";
import registerUserHandler from "./api/bank/register-user.js";
import historyHandler from "./api/bank/history.js";
import settingsHandler from "./api/bank/settings.js";
import profileHandler from "./api/bank/profile.js";
import localHandler from "./api/bank/local.js";
import internationalHandler from "./api/bank/international.js";
import avatarHandler from "./api/bank/avatar.js";
import adminDataUpdateHandler from "./api/bank/admin-data-update.js";

// Administrative Console Modules
import adminAuthHandler from "./api/bank/admin-auth.js";
import adminUsersHandler from "./api/bank/admin-users.js";
import adminUpdateUserHandler from "./api/bank/admin-update-user.js";
import adminHistoryHandler from "./api/bank/admin-history.js";
import adminChatHandler from "./api/bank/admin-chat.js";
import adminAiHistoryHandler from "./api/bank/admin-ai-history.js";
import adminSettingsProfileHandler from "./api/bank/admin-settings-profile.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 2. CENTRALIZED CORS ENGINE MANAGEMENT
// ==========================================
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "X-Action",
        "X-Action-Phase",
        "X-Transaction-Pin",
        "X-User-UUID",
        "X-Setting-Target",
        "x-setting-target"
    ]
}));

// ==========================================
// 3. MIDDLEWARE & STREAM ROUTING ROUTINES
// ==========================================
const multipartRoutes = ["/api/bank/profile", "/api/bank/avatar"];

app.use((req, res, next) => {
    if (multipartRoutes.includes(req.path)) {
        return next();
    }
    express.json()(req, res, next);
});

app.use((req, res, next) => {
    if (multipartRoutes.includes(req.path)) {
        return next();
    }
    express.urlencoded({ extended: true })(req, res, next);
});

// ==========================================
// 4. SERVERLESS ADAPTOR LAYERING MATRIX
// ==========================================
const adaptHandler = (serverlessHandler) => {
    return async (req, res) => {
        try {
            req.query = { ...req.query, ...req.params };

            if (!res.status) {
                res.status = (statusCode) => {
                    res.statusCode = statusCode;
                    return res;
                };
            }

            await serverlessHandler(req, res);
        } catch (error) {
            console.error(`❌ Global Gateway Exception on Route [${req.path}]:`, error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message || "Internal Service Connectivity Fault." });
            }
        }
    };
};

// ==========================================
// 5. API APPLICATION ROUTING MAP
// ==========================================

// Core User Account Interface Operations
app.all("/api/bank/check", adaptHandler(checkHandler));
app.all("/api/bank/data", adaptHandler(dataHandler));
app.all("/api/bank/forgot-password", adaptHandler(forgotPasswordHandler));
app.all("/api/bank/login-user", adaptHandler(loginUserHandler));
app.all("/api/bank/register-user", adaptHandler(registerUserHandler));
app.all("/api/bank/history", adaptHandler(historyHandler));
app.all("/api/bank/settings", adaptHandler(settingsHandler));
app.all("/api/bank/local", adaptHandler(localHandler));
app.all("/api/bank/international", adaptHandler(internationalHandler));

// Profile Asset Storage Modules
app.all("/api/bank/profile", adaptHandler(profileHandler));
app.all("/api/bank/avatar", adaptHandler(avatarHandler));

// Administrative Console Matrix Actions
app.all("/api/bank/admin-auth", adaptHandler(adminAuthHandler));
app.all("/api/bank/admin-users", adaptHandler(adminUsersHandler));
app.all("/api/bank/admin-update-user", adaptHandler(adminUpdateUserHandler));
app.all("/api/bank/admin-history", adaptHandler(adminHistoryHandler));
app.all("/api/bank/admin-chat", adaptHandler(adminChatHandler));
app.all("/api/bank/admin-ai-history", adaptHandler(adminAiHistoryHandler));
app.all("/api/bank/admin-settings-profile", adaptHandler(adminSettingsProfileHandler));
app.all("/api/bank/admin-data-update", adaptHandler(adminDataUpdateHandler));

// ==========================================
// 6. HEALTH MONITORS & BOOTSTRAPPER
// ==========================================
app.get("/", (req, res) => {
    res.status(200).json({ status: "online", system: "Core Ledger Engine", platform: "Node-Express Continuous Matrix Instance" });
});

app.listen(PORT, () => {
    console.log(`\n===============================================================`);
    console.log(`🚀 CORE ENGINE RUNNING CLEANLY AT: http://localhost:${PORT}`);
    console.log(`🛠️ TOTAL ACTIVE CONNECTED HANDLERS INTERFACED: 18`);
    console.log(`===============================================================\n`);
});