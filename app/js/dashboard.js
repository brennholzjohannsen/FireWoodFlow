// FireWoodFlow - Dashboard Logic

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
            currentView: 'dashboard',
            action: null,
            
            // User Daten
            userEmail: '',
            
            // Firmen-Daten
            companyName: 'FireWoodFlow',
            companyLogo: null,
            
            // Inventar Daten
            inventoryCount: 0,
            totalValue: 0,
            products: [],
            searchQuery: '',
            showAddProduct: false,
            newProduct: {
                name: '',
                quantity: 0,
                unit: 'RM',
                woodType: '',
                logLength: 25,
                dryness: 'lufttrocken',
                price: 0,
                notes: ''
            },
            
            // Kunden Daten
            customerCount: 0,
            customers: [],
            showAddCustomer: false,
            newCustomer: {
                name: '',
                address: '',
                phone: '',
                email: '',
                notes: ''
            },
            
            // Stats
            todayOrders: 0
        };
    },

    computed: {
        filteredProducts() {
            if (!this.searchQuery) return this.products;
            const query = this.searchQuery.toLowerCase();
            return this.products.filter(p => 
                p.name.toLowerCase().includes(query) ||
                p.woodType.toLowerCase().includes(query)
            );
        },

        filteredCustomers() {
            if (!this.searchQuery) return this.customers;
            const query = this.searchQuery.toLowerCase();
            return this.customers.filter(c => 
                c.name.toLowerCase().includes(query) ||
                (c.email && c.email.toLowerCase().includes(query))
            );
        }
    },

    async mounted() {
        // Session prüfen
        await this.checkAuth();
        
        // Firmen-Daten laden
        this.loadCompanySettings();
        
        // Daten laden
        await this.loadData();
    },

    methods: {
        async checkAuth() {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                window.location.href = 'index.html';
                return;
            }
            this.userEmail = session.user.email;
        },

        loadCompanySettings() {
            const saved = localStorage.getItem('firewoodflow_company');
            if (saved) {
                const data = JSON.parse(saved);
                this.companyName = data.name || 'FireWoodFlow';
                this.companyLogo = data.logo || null;
            }
        },

        saveCompanySettings() {
            const data = {
                name: this.companyName,
                logo: this.companyLogo
            };
            localStorage.setItem('firewoodflow_company', JSON.stringify(data));
        },

        async handleLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Dateityp prüfen
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Bitte nur JPG, PNG, GIF oder WebP Bilder verwenden.');
                return;
            }

            // Dateigröße prüfen (max 2MB)
            const maxSize = 2 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('Das Bild darf maximal 2MB groß sein.');
                return;
            }

            // Bild einlesen und als Base64 speichern
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target.result;
                
                // Komprimieren wenn nötig (für große Bilder)
                if (file.size > 500 * 1024) {
                    this.compressImage(base64String, (compressed) => {
                        this.companyLogo = compressed;
                        this.saveCompanySettings();
                        alert('Logo erfolgreich hochgeladen!');
                    });
                } else {
                    this.companyLogo = base64String;
                    this.saveCompanySettings();
                    alert('Logo erfolgreich hochgeladen!');
                }
            };
            reader.onerror = () => {
                alert('Fehler beim Lesen des Bildes.');
            };
            reader.readAsDataURL(file);

            // Input zurücksetzen damit gleiches Bild nochmal gewählt werden kann
            this.$refs.logoInput.value = '';
        },

        compressImage(base64, callback) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Maximal 300px Breite/Höhe für Speicherplatz
                const maxDim = 300;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * maxDim / width);
                        width = maxDim;
                    } else {
                        width = Math.round(width * maxDim / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Als JPEG mit 80% Qualität komprimieren
                const compressed = canvas.toDataURL('image/jpeg', 0.8);
                callback(compressed);
            };
            img.src = base64;
        },

        removeLogo() {
            if (confirm('Möchtest du das Logo wirklich entfernen?')) {
                this.companyLogo = null;
                this.saveCompanySettings();
            }
        },

        async loadData() {
            // TODO: Echte Daten aus Supabase laden
            // Für jetzt Mock-Daten für Demo-Zwecke
            
            // Produkte laden (Mock)
            this.products = [];
            this.inventoryCount = this.products.length;
            this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
            
            // Kunden laden (Mock)
            this.customers = [];
            this.customerCount = this.customers.length;
            
            // Heute Bestellungen (Mock)
            this.todayOrders = 0;
        },

        formatCurrency(value) {
            return new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR'
            }).format(value);
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        },

        // Produkt Methoden
        async addProduct() {
            try {
                // TODO: In Supabase speichern
                const product = {
                    id: Date.now().toString(),
                    ...this.newProduct,
                    createdAt: new Date().toISOString()
                };
                
                this.products.push(product);
                this.inventoryCount = this.products.length;
                this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                
                // Formular zurücksetzen
                this.showAddProduct = false;
                this.newProduct = {
                    name: '',
                    quantity: 0,
                    unit: 'RM',
                    woodType: '',
                    logLength: 25,
                    dryness: 'lufttrocken',
                    price: 0,
                    notes: ''
                };
                
                alert('Produkt erfolgreich gespeichert!');
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('Fehler beim Speichern des Produkts.');
            }
        },

        editProduct(product) {
            // TODO: Edit-Modal öffnen
            alert('Bearbeiten: ' + product.name);
        },

        deleteProduct(product) {
            if (confirm('Möchtest du "' + product.name + '" wirklich löschen?')) {
                this.products = this.products.filter(p => p.id !== product.id);
                this.inventoryCount = this.products.length;
            }
        },

        // Kunden Methoden
        async addCustomer() {
            try {
                // TODO: In Supabase speichern
                const customer = {
                    id: Date.now().toString(),
                    ...this.newCustomer,
                    createdAt: new Date().toISOString()
                };
                
                this.customers.push(customer);
                this.customerCount = this.customers.length;
                
                // Formular zurücksetzen
                this.showAddCustomer = false;
                this.newCustomer = {
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    notes: ''
                };
                
                alert('Kunde erfolgreich gespeichert!');
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('Fehler beim Speichern des Kunden.');
            }
        },

        editCustomer(customer) {
            // TODO: Edit-Modal öffnen
            alert('Bearbeiten: ' + customer.name);
        },

        deleteCustomer(customer) {
            if (confirm('Möchtest du "' + customer.name + '" wirklich löschen?')) {
                this.customers = this.customers.filter(c => c.id !== customer.id);
                this.customerCount = this.customers.length;
            }
        },

        // Settings Methoden
        handleChangePassword() {
            alert('Passwort ändern wird noch implementiert.');
        },

        handleDeleteAccount() {
            if (confirm('Bist du sicher? Dies kann nicht rückgängig gemacht werden.')) {
                alert('Konto löschen wird noch implementiert.');
            }
        },

        async handleLogout() {
            if (confirm('Möchtest du dich wirklich abmelden?')) {
                await supabaseClient.auth.signOut();
                window.location.href = 'index.html';
            }
        }
    }
}).mount('#app');
