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
            companyAddress: '',
            storageLocation: '',
            costPerKm: 0,
            roundingMode: 'exact',
            
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
            showEditCustomer: false,
            editingCustomer: null,
            showDeliveryModal: false,
            selectedCustomer: null,
            loadingDistance: false,
            distanceError: '',
            distanceResult: null,
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
        },

        deliveryFromAddress() {
            // Wenn Holzlagerplatz eingetragen ist, verwende diesen, sonst Firmenadresse
            return this.storageLocation.trim() || this.companyAddress;
        },

        deliveryCost() {
            if (!this.distanceResult) return 0;
            const rawCost = this.distanceResult.distance * this.costPerKm;
            return this.roundDeliveryCost(rawCost);
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
                this.companyAddress = data.address || '';
                this.storageLocation = data.storageLocation || '';
                this.costPerKm = parseFloat(data.costPerKm) || 0;
                this.roundingMode = data.roundingMode || 'exact';
            }
        },

        saveCompanySettings() {
            const data = {
                name: this.companyName,
                logo: this.companyLogo,
                address: this.companyAddress,
                storageLocation: this.storageLocation,
                costPerKm: this.costPerKm,
                roundingMode: this.roundingMode
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

        formatDuration(seconds) {
            if (!seconds) return '-';
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            if (hours > 0) {
                return `${hours}h ${mins}min`;
            }
            return `${mins} min`;
        },

        roundDeliveryCost(amount) {
            // Rundet den Betrag entsprechend der Einstellung
            switch (this.roundingMode) {
                case '10cent':
                    // Auf nächste 10 Cent aufrunden
                    return Math.ceil(amount * 10) / 10;
                case '50cent':
                    // Auf nächste 50 Cent aufrunden
                    return Math.ceil(amount * 2) / 2;
                case '1euro':
                    // Auf ganzen Euro aufrunden
                    return Math.ceil(amount);
                case 'exact':
                default:
                    // Exakter Betrag
                    return amount;
            }
        },

        async showDeliveryCost(customer) {
            this.selectedCustomer = customer;
            this.showDeliveryModal = true;
            this.loadingDistance = true;
            this.distanceError = '';
            this.distanceResult = null;

            // Prüfen ob beide Adressen vorhanden sind
            const fromAddress = this.deliveryFromAddress;
            if (!fromAddress || !customer.address) {
                this.distanceError = 'Bitte tragen Sie sowohl Startadresse (Firma oder Lager) als auch Kundenadresse ein.';
                this.loadingDistance = false;
                return;
            }

            try {
                // Geocoding: Startadresse zu Koordinaten
                const fromCoords = await this.geocodeAddress(fromAddress);
                if (!fromCoords) {
                    this.distanceError = 'Startadresse konnte nicht gefunden werden. Bitte Adresse überprüfen.';
                    this.loadingDistance = false;
                    return;
                }

                // Geocoding: Kundenadresse zu Koordinaten
                const customerCoords = await this.geocodeAddress(customer.address);
                if (!customerCoords) {
                    this.distanceError = 'Kundenadresse konnte nicht gefunden werden. Bitte Adresse überprüfen.';
                    this.loadingDistance = false;
                    return;
                }

                // Route berechnen mit OSRM
                const route = await this.calculateRoute(fromCoords, customerCoords);
                
                this.distanceResult = {
                    distance: route.distance, // in km
                    duration: route.duration, // in Sekunden
                    mapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromAddress)}&destination=${encodeURIComponent(customer.address)}&travelmode=driving`
                };

            } catch (error) {
                console.error('Fehler bei Entfernungsberechnung:', error);
                this.distanceError = 'Entfernung konnte nicht berechnet werden. Bitte versuchen Sie es später erneut.';
            } finally {
                this.loadingDistance = false;
            }
        },

        async geocodeAddress(address) {
            // Prüfen ob es Koordinaten sind (mit oder ohne Grad-Symbol)
            const coordMatch = address.match(/(-?\d+\.?\d*)°?\s*,\s*(-?\d+\.?\d*)°?/);
            
            if (coordMatch) {
                // Bereits Koordinaten - direkt verwenden
                console.log('Koordinaten erkannt:', coordMatch[1], coordMatch[2]);
                return {
                    lat: parseFloat(coordMatch[1]),
                    lon: parseFloat(coordMatch[2])
                };
            }
            
            // Normale Adresse - Geocoding über Nominatim
            console.log('Geocode Adresse:', address);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'de',
                    'User-Agent': 'FireWoodFlow/1.0'
                }
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            if (data.length === 0) return null;
            
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        },

        async calculateRoute(from, to) {
            // OSRM Routing API (kostenlos, OpenStreetMap)
            const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('OSRM API Fehler');
            }
            
            const data = await response.json();
            
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                throw new Error('Keine Route gefunden');
            }
            
            const route = data.routes[0];
            
            return {
                distance: route.distance / 1000, // Meter → km
                duration: route.duration // Sekunden
            };
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
            console.log('=== addCustomer aufgerufen ===');
            console.log('newCustomer:', this.newCustomer);
            
            try {
                // Validierung
                if (!this.newCustomer.name || !this.newCustomer.name.trim()) {
                    alert('Bitte geben Sie einen Namen ein.');
                    return;
                }

                const customer = {
                    id: Date.now().toString(),
                    name: this.newCustomer.name.trim(),
                    address: (this.newCustomer.address || '').trim(),
                    phone: (this.newCustomer.phone || '').trim(),
                    email: (this.newCustomer.email || '').trim(),
                    notes: (this.newCustomer.notes || '').trim(),
                    createdAt: new Date().toISOString()
                };

                console.log('Erstelle Kunde:', customer);
                console.log('Kunden vorher:', this.customers.length);
                
                // Array kopieren um Reaktivität sicherzustellen
                const updatedCustomers = [...this.customers, customer];
                this.customers = updatedCustomers;
                this.customerCount = this.customers.length;
                
                console.log('Kunden nachher:', this.customers.length);
                console.log('Alle Kunden:', this.customers);

                // Formular zurücksetzen
                this.newCustomer = {
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    notes: ''
                };

                // Modal schließen mit kleiner Verzögerung damit Alert zuerst kommt
                setTimeout(() => {
                    this.showAddCustomer = false;
                }, 100);
                
                alert('✓ Kunde erfolgreich gespeichert!');
                
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                console.error('Error Stack:', error.stack);
                alert('❌ Fehler beim Speichern des Kunden: ' + error.message);
            }
        },

        editCustomer(customer) {
            // Kunde zum Bearbeiten laden
            this.editingCustomer = { ...customer };
            this.showEditCustomer = true;
        },

        async saveCustomer() {
            try {
                // Validierung
                if (!this.editingCustomer.name || !this.editingCustomer.name.trim()) {
                    alert('Bitte geben Sie einen Namen ein.');
                    return;
                }

                console.log('Speichere Änderungen:', this.editingCustomer);

                // Index des Kunden finden
                const index = this.customers.findIndex(c => c.id === this.editingCustomer.id);
                
                if (index !== -1) {
                    // Aktualisierten Kunden speichern
                    const updatedCustomer = {
                        ...this.editingCustomer,
                        name: this.editingCustomer.name.trim(),
                        address: (this.editingCustomer.address || '').trim(),
                        phone: (this.editingCustomer.phone || '').trim(),
                        email: (this.editingCustomer.email || '').trim(),
                        notes: (this.editingCustomer.notes || '').trim(),
                        updatedAt: new Date().toISOString()
                    };

                    // Array kopieren um Reaktivität sicherzustellen
                    const updatedCustomers = [...this.customers];
                    updatedCustomers[index] = updatedCustomer;
                    this.customers = updatedCustomers;

                    console.log('Kunde aktualisiert:', updatedCustomer);

                    // Modal schließen
                    setTimeout(() => {
                        this.showEditCustomer = false;
                        this.editingCustomer = null;
                    }, 100);

                    alert('✓ Kunde erfolgreich aktualisiert!');
                } else {
                    throw new Error('Kunde nicht gefunden');
                }

            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('❌ Fehler beim Speichern: ' + error.message);
            }
        },

        deleteCustomer(customer) {
            if (confirm('Möchtest du "' + customer.name + '" wirklich löschen?')) {
                this.customers = this.customers.filter(c => c.id !== customer.id);
                this.customerCount = this.customers.length;
                alert('✓ Kunde gelöscht.');
            }
        },

        async previewLocation(inputId, previewId) {
            const address = this[inputId.replace('MapPreview', '')];
            if (!address || !address.trim()) {
                alert('Bitte geben Sie zuerst eine Adresse oder Koordinaten ein.');
                return;
            }

            const previewDiv = document.getElementById(previewId);
            if (!previewDiv) return;

            // Lade-Indikator anzeigen
            previewDiv.innerHTML = '<p style="text-align:center;padding:20px;">🗺️ Lade Karte...</p>';

            try {
                // Koordinaten ermitteln
                let coords;
                
                // Prüfen ob es bereits Koordinaten sind
                const coordMatch = address.match(/(-?\d+\.?\d*)°?\s*,\s*(-?\d+\.?\d*)°?/);
                
                if (coordMatch) {
                    coords = {
                        lat: parseFloat(coordMatch[1]),
                        lon: parseFloat(coordMatch[2])
                    };
                } else {
                    // Geocoding für normale Adresse
                    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
                    const response = await fetch(url, {
                        headers: {
                            'Accept-Language': 'de',
                            'User-Agent': 'FireWoodFlow/1.0'
                        }
                    });
                    
                    if (!response.ok) throw new Error('Geocoding fehlgeschlagen');
                    
                    const data = await response.json();
                    if (data.length === 0) throw new Error('Adresse nicht gefunden');
                    
                    coords = {
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    };
                }

                // OpenStreetMap Static Map als Bild einbetten
                // Verwende OpenStreetMap Export API für einen Kartenausschnitt
                const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.01},${coords.lat - 0.01},${coords.lon + 0.01},${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat},${coords.lon}`;
                
                previewDiv.innerHTML = `
                    <iframe 
                        src="${mapUrl}" 
                        width="100%" 
                        height="250" 
                        style="border:1px solid #ccc;border-radius:8px;"
                        loading="lazy"
                    ></iframe>
                    <p style="text-align:center;margin-top:10px;font-size:0.9em;color:#6B5D52;">
                        📍 ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}
                    </p>
                `;

            } catch (error) {
                console.error('Fehler beim Laden der Karte:', error);
                previewDiv.innerHTML = `<p style="color:#dc3545;text-align:center;padding:20px;">❌ Karte konnte nicht geladen werden: ${error.message}</p>`;
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
