// FireWoodFlow - Login Logic

const { createApp } = Vue;
const { createClient } = supabase;

// ============================================
// SUPABASE KONFIGURATION
// Diese Werte musst du nach dem Supabase-Setup eintragen!
// ============================================
const SUPABASE_URL = 'https://qnwxbityxokrjoxsrnym.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__beIdCQrh5dV6puh6nDNpA_bfsMONDC';

// Supabase Client initialisieren
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

createApp({
    data() {
        return {
            // Login Formular
            email: '',
            password: '',
            rememberMe: false,
            loading: false,
            error: '',

            // Registrierung
            showRegister: false,
            regEmail: '',
            regPassword: '',
            regConfirm: '',
            registerLoading: false,
            registerError: '',
            registerSuccess: false,

            // Firmen-Daten (könnten später aus DB geladen werden)
            companyName: 'FireWoodFlow',
            companyLogo: null
        };
    },

    mounted() {
        // Prüfen ob User bereits eingeloggt ist
        this.checkSession();
        
        // Firmen-Daten aus LocalStorage laden (falls vorhanden)
        const savedCompany = localStorage.getItem('firewoodflow_company');
        if (savedCompany) {
            const data = JSON.parse(savedCompany);
            this.companyName = data.name || 'FireWoodFlow';
            this.companyLogo = data.logo || null;
        }
    },

    methods: {
        async checkSession() {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                // User ist bereits eingeloggt → zum Dashboard weiterleiten
                window.location.href = 'dashboard.html';
            }
        },

        async handleLogin() {
            this.loading = true;
            this.error = '';

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: this.email,
                    password: this.password,
                });

                if (error) throw error;

                // Session speichern wenn "Angemeldet bleiben" gewählt
                if (!this.rememberMe) {
                    // Session wird automatisch beim Browser-Schließen gelöscht
                    // (standard behavior von Supabase)
                }

                // Weiterleitung zum Dashboard
                window.location.href = 'dashboard.html';

            } catch (err) {
                console.error('Login Fehler:', err);
                this.error = err.message || 'Anmeldung fehlgeschlagen. Bitte überprüfe deine Daten.';
            } finally {
                this.loading = false;
            }
        },

        async handleRegister() {
            this.registerError = '';
            
            // Validierung
            if (this.regPassword !== this.regConfirm) {
                this.registerError = 'Die Passwörter stimmen nicht überein.';
                return;
            }

            if (this.regPassword.length < 6) {
                this.registerError = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
                return;
            }

            this.registerLoading = true;

            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: this.regEmail,
                    password: this.regPassword,
                });

                if (error) throw error;

                // Erfolg! User muss Email bestätigen
                this.registerSuccess = true;
                
                // Formular zurücksetzen
                this.regEmail = '';
                this.regPassword = '';
                this.regConfirm = '';

                // Modal nach 3 Sekunden schließen
                setTimeout(() => {
                    this.showRegister = false;
                    this.registerSuccess = false;
                }, 5000);

            } catch (err) {
                console.error('Registrierung Fehler:', err);
                this.registerError = err.message || 'Registrierung fehlgeschlagen. Bitte versuche es erneut.';
            } finally {
                this.registerLoading = false;
            }
        },

        async handleLogout() {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        }
    }
}).mount('#app');
