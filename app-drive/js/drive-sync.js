// ============================================================
// FireWoodFlow Drive Sync — Google Drive als Datenspeicher
// ============================================================
// Architektur: Local-first
// - Alle Daten liegen primär im localStorage (gleiche Keys wie die App nutzt)
// - Bei Änderungen wird (verzögert) ein Snapshot nach Google Drive geschrieben
// - Beim Start wird geprüft: Lokal vs. Drive — der neuere Stand gewinnt
// - Vor dem Überschreiben wird immer ein lokales Backup der alten Daten angelegt
//
// Konfiguration: CLIENT_ID siehe docs/DRIVE_SETUP.md
// (kann auch direkt in der App unter Einstellungen → Google Drive Sync
//  eingegeben werden, wird dann im localStorage gespeichert)
// ============================================================

const DRIVE_SYNC_CONFIG = {
    // OAuth Client-ID aus der Google Cloud Console (Typ: Webanwendung)
    // Alternativ: In der App unter Einstellungen eingeben (dann localStorage).
    CLIENT_ID: '',
    FOLDER_NAME: 'FireWoodFlow',
    FILE_NAME: 'firewoodflow-data.json',
    // drive.file = App darf NUR die von ihr selbst erstellten Dateien sehen
    SCOPES: 'https://www.googleapis.com/auth/drive.file'
};

// localStorage Keys, die synchronisiert werden
const DRIVE_SYNC_KEYS = [
    'firewoodflow_products',
    'firewoodflow_customers',
    'firewoodflow_orders',
    'firewoodflow_expenses',
    'firewoodflow_company',
    'firewoodflow_company_settings',
    'firewoodflow_inventory_settings'
];

const DRIVE_SYNC_META_KEY = 'firewoodflow_last_changed';
const DRIVE_SYNC_CONN_KEY = 'firewoodflow_drive';
const DRIVE_SYNC_BACKUP_PREFIX = 'firewoodflow_backup_';

const DriveSync = {
    token: null,
    tokenExpiry: 0,
    tokenClient: null,
    folderId: null,
    fileId: null,

    // ---------- Konfiguration ----------

    clientId() {
        const stored = localStorage.getItem('firewoodflow_drive_client_id');
        if (stored && stored.includes('.apps.googleusercontent.com')) return stored;
        if (DRIVE_SYNC_CONFIG.CLIENT_ID &&
            !DRIVE_SYNC_CONFIG.CLIENT_ID.includes('HIER_DEINE')) {
            return DRIVE_SYNC_CONFIG.CLIENT_ID;
        }
        return null;
    },

    setClientId(id) {
        localStorage.setItem('firewoodflow_drive_client_id', id.trim());
    },

    isConfigured() {
        return !!this.clientId();
    },

    isConnected() {
        // "Verbunden" = User hat Verbindung eingerichtet (persistiert)
        // Token selbst gilt nur pro Browser-Session (~1 Stunde)
        try {
            return !!JSON.parse(localStorage.getItem(DRIVE_SYNC_CONN_KEY) || 'null');
        } catch {
            return false;
        }
    },

    connectedEmail() {
        try {
            const conn = JSON.parse(localStorage.getItem(DRIVE_SYNC_CONN_KEY) || 'null');
            return conn ? conn.email : null;
        } catch {
            return null;
        }
    },

    lastChangedLocal() {
        return localStorage.getItem(DRIVE_SYNC_META_KEY) || null;
    },

    // ---------- Token-Handling (Google Identity Services) ----------

    ensureTokenClient() {
        if (!this.tokenClient) {
            if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
                throw new Error('Google Identity Services nicht geladen');
            }
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId(),
                scope: DRIVE_SYNC_CONFIG.SCOPES,
                callback: () => {} // wird pro Aufruf überschrieben
            });
        }
        return this.tokenClient;
    },

    // Gibt ein gültiges Access-Token zurück oder null.
    // silent=true: ohne Popup (geht nur, wenn Google-Session noch aktiv)
    async getToken(silent = false) {
        if (this.token && Date.now() < this.tokenExpiry - 60000) {
            return this.token;
        }
        if (!this.isConfigured()) return null;

        return new Promise((resolve) => {
            try {
                const client = this.ensureTokenClient();
                const timeout = setTimeout(() => resolve(null), silent ? 8000 : 120000);
                client.callback = (resp) => {
                    clearTimeout(timeout);
                    if (resp && resp.access_token) {
                        this.token = resp.access_token;
                        // GIS liefert expires_in (Sekunden); fallback 3600
                        const expiresIn = resp.expires_in || 3600;
                        this.tokenExpiry = Date.now() + expiresIn * 1000;
                        resolve(this.token);
                    } else {
                        resolve(null);
                    }
                };
                client.requestAccessToken({ prompt: silent ? '' : 'consent' });
            } catch (e) {
                console.warn('Token-Request fehlgeschlagen:', e);
                resolve(null);
            }
        });
    },

    async revokeToken() {
        if (this.token && typeof google !== 'undefined' && google.accounts) {
            try {
                google.accounts.oauth2.revoke(this.token, () => {});
            } catch (e) { /* egal */ }
        }
        this.token = null;
        this.tokenExpiry = 0;
    },

    // ---------- Drive-Datei: finden, lesen, schreiben ----------

    async apiFetch(url, options = {}) {
        const token = this.token || await this.getToken(true);
        if (!token) throw new Error('Kein gültiges Google-Token');
        const resp = await fetch(url, {
            ...options,
            headers: {
                'Authorization': 'Bearer ' + token,
                ...(options.headers || {})
            }
        });
        if (resp.status === 401) {
            // Token abgelaufen → einmalig neu holen und wiederholen
            this.token = null;
            const fresh = await this.getToken(true);
            if (!fresh) throw new Error('AUTH_EXPIRED');
            return this.apiFetch(url, options);
        }
        return resp;
    },

    async findFolder() {
        const q = encodeURIComponent(
            `name='${DRIVE_SYNC_CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
        const resp = await this.apiFetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)&orderBy=modifiedTime`);
        const data = await resp.json();
        this.folderId = (data.files && data.files.length > 0) ? data.files[0].id : null;
        return this.folderId;
    },

    async createFolder() {
        const resp = await this.apiFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: DRIVE_SYNC_CONFIG.FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });
        const data = await resp.json();
        this.folderId = data.id;
        return this.folderId;
    },

    async findFile() {
        if (!this.folderId) await this.findFolder();
        if (!this.folderId) return null;
        const q = encodeURIComponent(
            `name='${DRIVE_SYNC_CONFIG.FILE_NAME}' and '${this.folderId}' in parents and trashed=false`);
        const resp = await this.apiFetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`);
        const data = await resp.json();
        this.fileId = (data.files && data.files.length > 0) ? data.files[0].id : null;
        return this.fileId;
    },

    // Snapshot = { lastChanged, data: { localStorageKey: JSON-String, ... } }
    buildSnapshot() {
        const data = {};
        for (const key of DRIVE_SYNC_KEYS) {
            const val = localStorage.getItem(key);
            if (val !== null) data[key] = val;
        }
        return {
            app: 'FireWoodFlow',
            version: 2,
            lastChanged: this.lastChangedLocal() || new Date().toISOString(),
            data
        };
    },

    async pull() {
        const fileId = await this.findFile();
        if (!fileId) return null;
        const resp = await this.apiFetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
        if (!resp.ok) return null;
        const text = await resp.text();
        try {
            return JSON.parse(text);
        } catch {
            console.warn('Drive-Datei enthält kein gültiges JSON');
            return null;
        }
    },

    async push() {
        if (!this.folderId) {
            await this.findFolder();
            if (!this.folderId) await this.createFolder();
        }
        const fileId = await this.findFile();
        const snapshot = this.buildSnapshot();
        const json = JSON.stringify(snapshot);

        const boundary = 'fwfboundary' + Date.now();
        const metadata = { name: DRIVE_SYNC_CONFIG.FILE_NAME, mimeType: 'application/json' };
        if (!fileId) metadata.parents = [this.folderId];

        const body =
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
            JSON.stringify(metadata) +
            `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
            json +
            `\r\n--${boundary}--`;

        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
        const method = fileId ? 'PATCH' : 'POST';

        const resp = await this.apiFetch(url, {
            method,
            headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
            body
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error('Drive-Upload fehlgeschlagen: ' + resp.status + ' ' + errText);
        }
        const data = await resp.json();
        this.fileId = data.id;
        return true;
    },

    async deleteFile() {
        const fileId = await this.findFile();
        if (!fileId) return false;
        const resp = await this.apiFetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' });
        this.fileId = null;
        return resp.ok || resp.status === 204;
    },

    async getUserEmail() {
        try {
            const resp = await this.apiFetch('https://www.googleapis.com/drive/v3/about?fields=user');
            const data = await resp.json();
            return (data.user && data.user.emailAddress) || null;
        } catch {
            return null;
        }
    },

    // ---------- Anwenden eines Remote-Snapshots ----------

    backupLocalData() {
        // Rollierende Sicherung (max. 3) bevor Remote-Daten lokal überschreiben
        const stamps = Object.keys(localStorage)
            .filter(k => k.startsWith(DRIVE_SYNC_BACKUP_PREFIX))
            .sort();
        while (stamps.length >= 3) {
            localStorage.removeItem(stamps.shift());
        }
        const backup = {};
        for (const key of DRIVE_SYNC_KEYS) {
            const val = localStorage.getItem(key);
            if (val !== null) backup[key] = val;
        }
        localStorage.setItem(
            DRIVE_SYNC_BACKUP_PREFIX + Date.now(),
            JSON.stringify(backup));
    },

    applySnapshot(snapshot) {
        if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') {
            throw new Error('Ungültiger Snapshot');
        }
        this.backupLocalData();
        // Erst Keys entfernen, die im Snapshot nicht existieren (z.B. frisches Gerät)
        for (const key of DRIVE_SYNC_KEYS) {
            if (snapshot.data[key] !== undefined) {
                localStorage.setItem(key, snapshot.data[key]);
            } else {
                localStorage.removeItem(key);
            }
        }
        // Meta-Timestamp des Remote-Stands übernehmen → kein Ping-Pong
        localStorage.setItem(DRIVE_SYNC_META_KEY, snapshot.lastChanged || new Date().toISOString());
    },

    // ---------- Zentrale Sync-Logik ----------

    // Wird beim App-Start aufgerufen. Gibt Status-String zurück.
    async syncOnStartup() {
        if (!this.isConfigured() || !this.isConnected()) return 'not_connected';
        const token = await this.getToken(true);
        if (!token) return 'auth_needed';

        try {
            const remote = await this.pull();
            const localChanged = this.lastChangedLocal();

            if (!remote) {
                // Erster Sync: lokale Daten hochladen
                await this.push();
                return 'pushed_initial';
            }

            const remoteChanged = remote.lastChanged || null;
            if (!remoteChanged || !localChanged || remoteChanged > localChanged) {
                this.applySnapshot(remote);
                return 'applied_remote';
            }
            if (remoteChanged < localChanged) {
                await this.push();
                return 'pushed_local';
            }
            return 'in_sync';
        } catch (e) {
            console.warn('Sync beim Start fehlgeschlagen:', e);
            return 'error: ' + e.message;
        }
    },

    // Nach lokalen Änderungen (verzögert aufrufen)
    async pushIfConnected() {
        if (!this.isConfigured() || !this.isConnected()) return false;
        const token = await this.getToken(true);
        if (!token) return false;
        try {
            await this.push();
            return true;
        } catch (e) {
            console.warn('Push nach Änderung fehlgeschlagen:', e);
            return false;
        }
    },

    // Vollständiger Sync mit Konflikt-Entscheidung (neuester Stand gewinnt)
    async syncNow() {
        if (!this.isConfigured()) throw new Error('Keine Client-ID konfiguriert');
        if (!this.isConnected()) throw new Error('Nicht mit Google Drive verbunden');
        const token = await this.getToken(true) || await this.getToken(false);
        if (!token) throw new Error('Google-Anmeldung erforderlich — bitte erneut verbinden');

        const remote = await this.pull();
        const localChanged = this.lastChangedLocal();

        if (!remote) {
            await this.push();
            return 'Keine Cloud-Daten gefunden — lokale Daten wurden hochgeladen.';
        }

        const remoteChanged = remote.lastChanged || null;
        if (remoteChanged && localChanged && remoteChanged > localChanged) {
            this.applySnapshot(remote);
            return 'Cloud-Stand ist neuer — lokale Daten wurden durch die Cloud-Daten ersetzt. (Ein Backup der alten lokalen Daten wurde angelegt.) Die Seite wird neu geladen.';
        }
        if (remoteChanged && localChanged && remoteChanged < localChanged) {
            await this.push();
            return 'Lokale Daten sind neuer — wurden zu Google Drive hochgeladen.';
        }
        if (remoteChanged && !localChanged) {
            this.applySnapshot(remote);
            return 'Cloud-Daten wurden geladen. Die Seite wird neu geladen.';
        }
        await this.push();
        return 'Alles synchron.';
    },

    // Verbindung herstellen (User-Geste erforderlich)
    async connect() {
        if (!this.isConfigured()) throw new Error('CLIENT_ID fehlt');
        const token = await this.getToken(false);
        if (!token) throw new Error('Google-Anmeldung fehlgeschlagen oder abgebrochen');
        const email = await this.getUserEmail();
        localStorage.setItem(DRIVE_SYNC_CONN_KEY, JSON.stringify({
            email: email || 'unbekannt',
            connectedAt: new Date().toISOString()
        }));
        return email;
    },

    disconnect() {
        this.revokeToken();
        localStorage.removeItem(DRIVE_SYNC_CONN_KEY);
    }
};

// Verbindungsstatus beim Laden wiederherstellen (Token muss pro Session neu geholt werden)
if (DriveSync.isConnected() && DriveSync.isConfigured()) {
    // Token wird lazy beim ersten Sync geholt — nichts zu tun
}

// Export für dashboard.js (window scope)
window.DriveSync = DriveSync;
