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
            
            // Inventar-Einstellungen
            inventorySettings: {
                woodTypes: ['Buche', 'Eiche', 'Birke', 'Fichte', 'Kiefer', 'Esche', 'Ahorn', 'Gemischt'],
                drynessLevels: [
                    { key: 'frisch', label: 'Frisch (< 1 Jahr)' },
                    { key: 'lufttrocken', label: 'Lufttrocken (1-2 Jahre)' },
                    { key: 'ofentrocken', label: 'Ofentrocken' }
                ],
                logLengths: [25, 33, 50, 100]
            },
            
            // Inventar Daten
            inventoryCount: 0,
            totalValue: 0,
            products: [],
            searchQuery: '',
            showAddProduct: false,
            showEditProduct: false,
            editingProduct: null,
            newProduct: {
                name: '',
                quantity: 0,
                unit: 'RM',
                woodType: '',
                logLength: 25,
                dryness: 'lufttrocken',
                price: 0,
                priceLengths: {}, // { 25: { srm: 0, rm: 0 }, 33: { srm: 0, rm: 0 }, ... }
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
            todayOrders: 0,
            
            // Bestellungen
            orders: [],
            ordersCount: 0,
            showAddOrder: false,
            showEditOrder: false,
            editingOrder: null,
            newOrderItemQuantity: 1,
            editOrderItemQuantity: 1,
            newOrderItemUnit: 'RM',
            editOrderItemUnit: 'RM',
            newOrder: {
                customerId: '',
                customerName: '',
                customerAddress: '',
                deliveryAddress: '',
                items: [],
                subtotal: 0,
                deliveryCosts: 0,
                total: 0,
                paymentMethod: 'bar',
                paymentStatus: 'offen',
                deliveryDate: '',
                deliveryTime: '',
                status: 'neu',
                notes: '',
                logLength: ''
            },
            orderStatusFilter: 'alle'
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
        },

        filteredOrders() {
            if (this.orderStatusFilter === 'alle') return this.orders;
            return this.orders.filter(o => o.status === this.orderStatusFilter);
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
            
            // Inventar-Einstellungen laden
            this.loadInventorySettings();
        },

        loadInventorySettings() {
            const saved = localStorage.getItem('firewoodflow_inventory_settings');
            if (saved) {
                const data = JSON.parse(saved);
                this.inventorySettings = {
                    woodTypes: data.woodTypes || this.inventorySettings.woodTypes,
                    drynessLevels: data.drynessLevels || this.inventorySettings.drynessLevels,
                    logLengths: data.logLengths || this.inventorySettings.logLengths
                };
            }
        },

        saveInventorySettings() {
            localStorage.setItem('firewoodflow_inventory_settings', JSON.stringify(this.inventorySettings));
        },

        toggleWoodType(woodType) {
            // Holzsorte aus Array entfernen oder hinzufügen
            const index = this.inventorySettings.woodTypes.indexOf(woodType);
            if (index > -1) {
                this.inventorySettings.woodTypes.splice(index, 1);
            } else {
                this.inventorySettings.woodTypes.push(woodType);
            }
            this.saveInventorySettings();
        },

        addWoodType() {
            const newType = prompt('Neue Holzsorte eingeben:', '');
            if (newType && newType.trim()) {
                const trimmed = newType.trim();
                if (!this.inventorySettings.woodTypes.includes(trimmed)) {
                    this.inventorySettings.woodTypes.push(trimmed);
                    this.inventorySettings.woodTypes.sort();
                    this.saveInventorySettings();
                    alert('✓ Holzsorte "' + trimmed + '" hinzugefügt!');
                } else {
                    alert('Diese Holzsorte existiert bereits.');
                }
            }
        },

        removeWoodType(woodType) {
            this.inventorySettings.woodTypes = this.inventorySettings.woodTypes.filter(w => w !== woodType);
            this.saveInventorySettings();
        },

        toggleDrynessLevel(key) {
            // Trocknungsgrad aktivieren/deaktivieren
            const level = this.inventorySettings.drynessLevels.find(l => l.key === key);
            if (level) {
                level.active = !level.active;
                this.saveInventorySettings();
            }
        },

        addDrynessLevel() {
            const label = prompt('Bezeichnung für neuen Trocknungsgrad eingeben:', 'Lufttrocken');
            if (label && label.trim()) {
                const trimmed = label.trim();
                const key = trimmed.toLowerCase().replace(/\s+/g, '_');
                if (!this.inventorySettings.drynessLevels.find(l => l.key === key)) {
                    this.inventorySettings.drynessLevels.push({
                        key: key,
                        label: trimmed,
                        active: true
                    });
                    this.saveInventorySettings();
                    alert('✓ Trocknungsgrad "' + trimmed + '" hinzugefügt!');
                } else {
                    alert('Dieser Trocknungsgrad existiert bereits.');
                }
            }
        },

        editDrynessLevel(key) {
            const level = this.inventorySettings.drynessLevels.find(l => l.key === key);
            if (level) {
                const newLabel = prompt('Bezeichnung bearbeiten:', level.label);
                if (newLabel && newLabel.trim()) {
                    level.label = newLabel.trim();
                    this.saveInventorySettings();
                    alert('✓ Trocknungsgrad aktualisiert!');
                }
            }
        },

        removeDrynessLevel(key) {
            this.inventorySettings.drynessLevels = this.inventorySettings.drynessLevels.filter(l => l.key !== key);
            this.saveInventorySettings();
        },

        addLogLength() {
            const newLength = parseInt(prompt('Scheitlänge in cm eingeben:', '25'));
            if (newLength && !this.inventorySettings.logLengths.includes(newLength)) {
                this.inventorySettings.logLengths.push(newLength);
                this.inventorySettings.logLengths.sort((a, b) => a - b);
                this.saveInventorySettings();
            }
        },

        removeLogLength(length) {
            this.inventorySettings.logLengths = this.inventorySettings.logLengths.filter(l => l !== length);
            this.saveInventorySettings();
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

        getActiveWoodTypes() {
            return this.inventorySettings.woodTypes || [];
        },

        getActiveDrynessLevels() {
            return (this.inventorySettings.drynessLevels || []).filter(d => d.active !== false);
        },

        getDrynessLabel(level) {
            // Kann entweder ein String (key) oder ein Object sein
            if (typeof level === 'string') {
                const found = (this.inventorySettings.drynessLevels || []).find(d => d.key === level);
                return found ? found.label : level;
            }
            return level.label || level;
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

        // Preis-Tabellen Methoden für Scheitholz
        getPriceForLength(length, unit) {
            const prices = this.newProduct.priceLengths || {};
            const lengthPrices = prices[length];
            
            // Wenn keine Preise für diese Länge existieren, leeren String zurück
            if (!lengthPrices) {
                return '';
            }
            
            if (unit === 'SRM') {
                const srm = lengthPrices.srm;
                // Nur zurückgeben wenn explizit gesetzt und nicht leer
                return (srm !== undefined && srm !== null && srm !== '') ? String(srm) : '';
            } else if (unit === 'RM') {
                // Zuerst prüfen ob RM-Preis explizit gesetzt ist
                const rm = lengthPrices.rm;
                if (rm !== undefined && rm !== null && rm !== '') {
                    return String(rm);
                }
                
                // Sonst aus SRM berechnen
                const srm = lengthPrices.srm;
                if (srm !== undefined && srm !== null && srm !== '' && !isNaN(parseFloat(srm))) {
                    const calculated = (parseFloat(srm) * 1.42).toFixed(2);
                    console.log('✓ Berechne RM-Preis für ' + length + 'cm: ' + srm + ' × 1.42 = ' + calculated);
                    return calculated;
                }
                return '';
            }
            return '';
        },

        updatePriceForLength(length, unit, value) {
            console.log('Update gestartet: Länge=' + length + ', Einheit=' + unit + ', Wert="' + value + '"');
            
            // priceLengths initialisieren wenn nötig
            if (!this.newProduct.priceLengths) {
                this.newProduct.priceLengths = {};
            }
            
            // Eintrag für diese Länge initialisieren
            if (!this.newProduct.priceLengths[length]) {
                this.newProduct.priceLengths[length] = { srm: '', rm: '' };
            }
            
            if (unit === 'SRM') {
                // SRM-Wert setzen
                this.newProduct.priceLengths[length].srm = value;
                
                // RM automatisch berechnen WENN noch kein manueller RM-Wert existiert
                const currentRM = this.newProduct.priceLengths[length].rm;
                const calculatedRM = value && value !== '' && !isNaN(parseFloat(value)) 
                    ? (parseFloat(value) * 1.42).toFixed(2) 
                    : '';
                
                // Prüfen ob RM bereits manuell gesetzt wurde (unterschiedlich vom berechneten Wert)
                const hasManualRM = currentRM && currentRM !== '' && currentRM !== calculatedRM;
                
                if (!hasManualRM) {
                    this.newProduct.priceLengths[length].rm = calculatedRM;
                    if (calculatedRM) {
                        console.log('✓ RM automatisch berechnet und gesetzt: ' + calculatedRM);
                    }
                } else if (!value || value === '') {
                    // Wenn SRM geleert wird, auch RM leeren (außer es war manuell)
                    if (!hasManualRM) {
                        this.newProduct.priceLengths[length].rm = '';
                    }
                }
            } else if (unit === 'RM') {
                // RM-Wert manuell setzen
                this.newProduct.priceLengths[length].rm = value;
                console.log('✓ RM manuell gesetzt: ' + value);
            }
            
            // Force reactivity - komplettes Objekt neu zuweisen (Vue 3)
            this.newProduct = { ...this.newProduct, priceLengths: { ...this.newProduct.priceLengths } };
            
            console.log('Aktueller priceLengths Stand:', JSON.stringify(this.newProduct.priceLengths[length]));
        },

        async loadData() {
            // Produkte aus localStorage laden
            const savedProducts = localStorage.getItem('firewoodflow_products');
            if (savedProducts) {
                this.products = JSON.parse(savedProducts);
            } else {
                this.products = [];
            }
            this.inventoryCount = this.products.length;
            this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
            
            // Kunden aus localStorage laden
            const savedCustomers = localStorage.getItem('firewoodflow_customers');
            if (savedCustomers) {
                this.customers = JSON.parse(savedCustomers);
            } else {
                this.customers = [];
            }
            this.customerCount = this.customers.length;
            
            // Bestellungen aus localStorage laden
            const savedOrders = localStorage.getItem('firewoodflow_orders');
            if (savedOrders) {
                this.orders = JSON.parse(savedOrders);
                this.ordersCount = this.orders.length;
            } else {
                this.orders = [];
                this.ordersCount = 0;
            }
            
            // Heute Bestellungen berechnen
            const today = new Date().toDateString();
            this.todayOrders = this.orders.filter(o => new Date(o.createdAt).toDateString() === today).length;
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
                console.log('=== Lieferkosten Berechnung ===');
                console.log('Von:', fromAddress);
                console.log('Nach:', customer.address);
                
                // Geocoding: Startadresse zu Koordinaten
                console.log('Geocode Startadresse...');
                const fromCoords = await this.geocodeAddress(fromAddress);
                console.log('Startkoordinaten:', fromCoords);
                
                if (!fromCoords) {
                    this.distanceError = 'Startadresse konnte nicht gefunden werden. Bitte Adresse überprüfen.';
                    this.loadingDistance = false;
                    return;
                }

                // Geocoding: Kundenadresse zu Koordinaten
                console.log('Geocode Kundenadresse...');
                const customerCoords = await this.geocodeAddress(customer.address);
                console.log('Kundenkoordinaten:', customerCoords);
                
                if (!customerCoords) {
                    this.distanceError = 'Kundenadresse konnte nicht gefunden werden. Bitte Adresse überprüfen.';
                    this.loadingDistance = false;
                    return;
                }

                // Route berechnen mit OSRM
                const route = await this.calculateRoute(fromCoords, customerCoords);
                
                // Google Maps URL mit KOORDINATEN statt Adress-Strings
                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${fromCoords.lat},${fromCoords.lon}&destination=${customerCoords.lat},${customerCoords.lon}&travelmode=driving`;
                
                this.distanceResult = {
                    distance: route.distance, // in km
                    duration: route.duration, // in Sekunden
                    mapsUrl: googleMapsUrl,
                    isFallback: route.isFallback || false
                };

            } catch (error) {
                console.error('Fehler bei Entfernungsberechnung:', error);
                this.distanceError = 'Entfernung konnte nicht berechnet werden. Bitte versuchen Sie es später erneut.';
            } finally {
                this.loadingDistance = false;
            }
        },

        async saveDeliveryCosts() {
            try {
                if (!this.selectedCustomer || !this.distanceResult) {
                    alert('Keine Lieferkosten zum Speichern vorhanden.');
                    return;
                }

                // Berechne Lieferkosten basierend auf Einstellung
                const calculatedCost = this.roundDeliveryCost(
                    this.distanceResult.distance * this.costPerKm
                );

                // Speichere beim Kunden
                const index = this.customers.findIndex(c => c.id === this.selectedCustomer.id);
                if (index !== -1) {
                    const updatedCustomers = [...this.customers];
                    updatedCustomers[index].deliveryCosts = calculatedCost;
                    this.customers = updatedCustomers;
                    
                    console.log('Lieferkosten gespeichert:', calculatedCost, 'für', this.selectedCustomer.name);
                    alert(`✓ Lieferkosten gespeichert: ${this.formatCurrency(calculatedCost)}`);
                    
                    // Modal schließen
                    this.showDeliveryModal = false;
                }
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('❌ Fehler beim Speichern der Lieferkosten.');
            }
        },

        async geocodeAddress(address) {
            // Prüfen ob es Koordinaten sind - unterstützt mehrere Formate:
            // Format 1: 49.006930°, 8.58789° (Punkt als Dezimaltrenner)
            // Format 2: 49,006930°, 8,58789° (Komma als Dezimaltrenner)
            // Format 3: 49.006930° N, 8.58789° O (mit Himmelsrichtung)
            // Format 4: 49,006930° N, 8,58789° O (Komma + Himmelsrichtung)
            // Format 5: 49.069348057006046, 8.587855863985201 (ohne Grad-Symbol)
            
            console.log('Geocode Address Input:', address);
            
            // WICHTIG: Koordinaten müssen mind. 4 Nachkommastellen haben oder Grad-Symbol
            // Sonst halten wir PLZ+Hausnummer (z.B. "76689,2") fälschlich für Koordinaten!
            
            // Regex für Koordinaten MIT Grad-Symbol (beliebig viele Nachkommastellen)
            const coordMatchWithDegree = address.match(
                /(\d+[,.]?\d*)°\s*[NS]?\s*,\s*(\d+[,.]?\d*)°\s*[OW]?\s*/i
            );
            
            // Regex für Koordinaten OHNE Grad-Symbol (aber mind. 4 Nachkommastellen für echten Koordinaten)
            const coordMatchDecimal = address.match(
                /^(\d{2}\.\d{4,})\s*,\s*(\d{1,2}\.\d{4,})$/i
            );
            
            const coordMatch = coordMatchWithDegree || coordMatchDecimal;
            
            if (coordMatch) {
                console.log('Koordinaten Match:', coordMatch);
                
                let lat = parseFloat(coordMatch[1].replace(',', '.'));
                let lon = parseFloat(coordMatch[2].replace(',', '.'));
                
                // Prüfen auf Himmelsrichtungen im Original-String
                const upperAddress = address.toUpperCase();
                
                // Süd oder West macht Koordinate negativ
                if (upperAddress.includes('S') && !upperAddress.includes('N')) {
                    lat = -Math.abs(lat);
                } else {
                    lat = Math.abs(lat); // Nord ist positiv
                }
                
                if (upperAddress.includes('W') && !upperAddress.includes('O') && !upperAddress.includes('E')) {
                    lon = -Math.abs(lon);
                } else {
                    lon = Math.abs(lon); // Ost ist positiv
                }
                
                // Validierung: Deutschland liegt bei ca. 47-55°N, 5-16°E
                if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    console.error('Ungültige Koordinaten:', lat, lon);
                    return null;
                }
                
                console.log('Koordinaten erkannt:', lat, lon);
                return {
                    lat: lat,
                    lon: lon
                };
            }
            
            console.log('Keine Koordinaten erkannt, versuche Geocoding...');
            // Normale Adresse - Geocoding über Nominatim
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'de',
                    'User-Agent': 'FireWoodFlow/1.0'
                }
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            console.log('Geocoding Result:', data);
            
            if (data.length === 0) return null;
            
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        },

        async calculateRoute(from, to) {
            // OSRM Routing API (kostenlos, OpenStreetMap)
            // OSRM snapt automatisch zur nächsten befahrbaren Straße!
            // WICHTIG: OSRM erwartet Format: lon,lat (Longitude zuerst!)
            
            // Validiere Koordinaten
            if (!from || !to || 
                typeof from.lat !== 'number' || typeof from.lon !== 'number' ||
                typeof to.lat !== 'number' || typeof to.lon !== 'number') {
                console.error('Ungültige Koordinaten:', from, to);
                throw new Error('Ungültige Koordinaten');
            }
            
            const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
            
            console.log('Berechne Route:', from, '→', to);
            console.log('URL:', url);
            
            try {
                const response = await fetch(url, { timeout: 10000 });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('OSRM Response:', response.status, errorText);
                    throw new Error(`OSRM API Fehler: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                    // Fallback: Luftlinien-Entfernung wenn keine Route gefunden
                    console.warn('Keine Route gefunden, verwende Luftlinie');
                    const distance = this.calculateHaversineDistance(from.lat, from.lon, to.lat, to.lon);
                    return {
                        distance: distance,
                        duration: distance * 60, // Schätzung: 1 km ≈ 1 min
                        isFallback: true
                    };
                }
                
                const route = data.routes[0];
                
                console.log('Route gefunden:', route.distance / 1000, 'km');
                
                return {
                    distance: route.distance / 1000, // Meter → km
                    duration: route.duration // Sekunden
                };
            } catch (error) {
                console.error('Fehler bei Routenberechnung:', error);
                
                // Fallback: Luftlinien-Entfernung
                const distance = this.calculateHaversineDistance(from.lat, from.lon, to.lat, to.lon);
                return {
                    distance: distance,
                    duration: distance * 60,
                    isFallback: true,
                    errorMessage: error.message
                };
            }
        },

        calculateHaversineDistance(lat1, lon1, lat2, lon2) {
            // Haversine Formel für Luftlinien-Entfernung
            const R = 6371; // Erdradius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            console.log('Luftlinien-Entfernung:', distance.toFixed(1), 'km');
            return distance;
        },

        // Produkt Methoden
        async addProduct() {
            try {
                // Validierung
                if (!this.newProduct.name || !this.newProduct.name.trim()) {
                    alert('Bitte geben Sie einen Produktnamen ein.');
                    return;
                }

                if (this.newProduct.quantity < 0) {
                    alert('Die Menge darf nicht negativ sein.');
                    return;
                }

                // Produkt erstellen
                const product = {
                    id: Date.now().toString(),
                    name: this.newProduct.name.trim(),
                    quantity: parseFloat(this.newProduct.quantity) || 0,
                    unit: this.newProduct.unit,
                    woodType: this.newProduct.woodType,
                    logLength: parseInt(this.newProduct.logLength) || 25,
                    dryness: this.newProduct.dryness,
                    price: parseFloat(this.newProduct.price) || 0,
                    priceLengths: this.newProduct.priceLengths || {},
                    notes: (this.newProduct.notes || '').trim(),
                    createdAt: new Date().toISOString()
                };
                
                console.log('Erstelle Produkt:', product);
                
                this.products.push(product);
                this.inventoryCount = this.products.length;
                this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                
                // In localStorage speichern
                this.saveProducts();
                
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
                    priceUnit: '',
                    notes: ''
                };
                
                alert('✓ Produkt erfolgreich gespeichert!');
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('❌ Fehler beim Speichern des Produkts.');
            }
        },

        editProduct(product) {
            // Produkt zum Bearbeiten laden
            this.editingProduct = { ...product };
            this.showEditProduct = true;
        },

        async saveProduct() {
            try {
                // Validierung
                if (!this.editingProduct.name || !this.editingProduct.name.trim()) {
                    alert('Bitte geben Sie einen Produktnamen ein.');
                    return;
                }

                if (this.editingProduct.quantity < 0) {
                    alert('Die Menge darf nicht negativ sein.');
                    return;
                }

                console.log('Speichere Produkt-Änderungen:', this.editingProduct);

                // Index des Produkts finden
                const index = this.products.findIndex(p => p.id === this.editingProduct.id);
                
                if (index !== -1) {
                    // Aktualisiertes Produkt speichern
                    const updatedProduct = {
                        ...this.editingProduct,
                        name: this.editingProduct.name.trim(),
                        quantity: parseFloat(this.editingProduct.quantity) || 0,
                        price: parseFloat(this.editingProduct.price) || 0,
                        logLength: parseInt(this.editingProduct.logLength) || 25,
                        priceUnit: this.editingProduct.priceUnit || this.editingProduct.unit,
                        updatedAt: new Date().toISOString()
                    };

                    // Array kopieren um Reaktivität sicherzustellen
                    const updatedProducts = [...this.products];
                    updatedProducts[index] = updatedProduct;
                    this.products = updatedProducts;
                    
                    // Stats aktualisieren
                    this.inventoryCount = this.products.length;
                    this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);

                    console.log('Produkt aktualisiert:', updatedProduct);
                    
                    // In localStorage speichern
                    this.saveProducts();

                    // Modal schließen
                    setTimeout(() => {
                        this.showEditProduct = false;
                        this.editingProduct = null;
                    }, 100);

                    alert('✓ Produkt erfolgreich aktualisiert!');
                } else {
                    throw new Error('Produkt nicht gefunden');
                }

            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('❌ Fehler beim Speichern: ' + error.message);
            }
        },

        deleteProduct(product) {
            if (confirm('Möchtest du "' + product.name + '" wirklich löschen?')) {
                this.products = this.products.filter(p => p.id !== product.id);
                this.inventoryCount = this.products.length;
                this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                this.saveProducts();
            }
        },
        
        saveProducts() {
            localStorage.setItem('firewoodflow_products', JSON.stringify(this.products));
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
                    deliveryCosts: 0,
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
                
                // In localStorage speichern
                this.saveCustomers();

                // Formular zurücksetzen
                this.newCustomer = {
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    notes: '',
                    deliveryCosts: 0
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
                        deliveryCosts: this.editingCustomer.deliveryCosts || 0,
                        updatedAt: new Date().toISOString()
                    };

                    // Array kopieren um Reaktivität sicherzustellen
                    const updatedCustomers = [...this.customers];
                    updatedCustomers[index] = updatedCustomer;
                    this.customers = updatedCustomers;

                    console.log('Kunde aktualisiert:', updatedCustomer);
                    
                    // In localStorage speichern
                    this.saveCustomers();

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
                this.saveCustomers();
                alert('✓ Kunde gelöscht.');
            }
        },
        
        saveCustomers() {
            localStorage.setItem('firewoodflow_customers', JSON.stringify(this.customers));
        },

        // Bestell-Methoden
        selectCustomerForOrder(customer) {
            // Kunde für Bestellung auswählen
            this.newOrder.customerId = customer.id;
            this.newOrder.customerName = customer.name;
            this.newOrder.customerAddress = customer.address || '';
            this.newOrder.deliveryAddress = customer.address || '';
            
            // Lieferkosten vom Kunden übernehmen wenn vorhanden
            if (customer.deliveryCosts && customer.deliveryCosts > 0) {
                this.newOrder.deliveryCosts = customer.deliveryCosts;
            } else {
                this.newOrder.deliveryCosts = 0;
            }
            
            console.log('Kunde ausgewählt:', customer.name);
        },

        addProductToOrder(product) {
            if (product && product.id) {
                // Prüfen ob Produkt bereits in Bestellung
                const existingItem = this.newOrder.items.find(item => item.productId === product.id);
                
                if (existingItem) {
                    alert('Dieses Produkt wurde bereits hinzugefügt. Bitte ändere die Menge direkt in der Liste.');
                    return;
                }
                
                // Neues Item mit Standard-Menge 1
                this.newOrder.items.push({
                    id: Date.now().toString() + Math.random().toString().slice(2, 7),
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    unit: product.unit,
                    pricePerUnit: product.price,
                    priceUnit: product.priceUnit || product.unit,
                    total: product.price
                });
            }
            
            this.calculateOrderTotals();
            console.log('Produkt hinzugefügt:', product.name);
        },

        addProductToOrderWithQuantity(isEditing = false) {
            // Menge und Einheit aus den reaktiven Werten lesen
            const quantity = isEditing ? this.editOrderItemQuantity : this.newOrderItemQuantity;
            const orderUnit = isEditing ? this.editOrderItemUnit : this.newOrderItemUnit;
            
            // Produkt-Select ID bestimmen
            const selectId = isEditing ? 'editOrderProductSelect' : 'orderProductSelect';
            const selectInput = document.getElementById(selectId);
            
            if (!selectInput || !selectInput.value) {
                alert('Bitte wähle ein Produkt aus.');
                return;
            }
            
            if (!quantity || quantity <= 0) {
                alert('Die Menge muss größer als 0 sein.');
                return;
            }
            
            const product = this.products.find(p => p.id === selectInput.value);
            
            if (!product) {
                alert('Produkt nicht gefunden.');
                return;
            }
            
            // Umrechnungsfaktoren (in RM als Basis)
            // 1 FM = 1.42 RM
            // 1 RM = 1.42 SRM → 1 FM = 1.42 * 1.42 = 2.0164 SRM
            const toRM = {
                'FM': 1.42,
                'RM': 1,
                'SRM': 1 / 1.42
            };
            
            // Bestellmenge in Produkteinheit umrechnen für Lagerbestandsprüfung
            const quantityInProductUnit = quantity * toRM[orderUnit] / toRM[product.unit];
            
            // Lagerbestand prüfen (mit der umgerechneten Menge)
            if (product.quantity < quantityInProductUnit) {
                alert(`❌ Nicht genügend Lagerbestand!\nVerfügbar: ${product.quantity.toFixed(2)} ${product.unit}\nBestellt: ${quantityInProductUnit.toFixed(2)} ${product.unit} (${quantity} ${orderUnit})`);
                return;
            }
            
            // Ziel-Array bestimmen (newOrder oder editingOrder)
            const targetItems = isEditing ? this.editingOrder.items : this.newOrder.items;
            
            // Prüfen ob Produkt bereits vorhanden
            const existingItem = targetItems.find(item => item.productId === product.id);
            
            if (existingItem) {
                // Wenn gleiche Einheit, Menge addieren
                if (existingItem.unit === orderUnit) {
                    existingItem.quantity += quantity;
                    existingItem.total = existingItem.quantity * existingItem.pricePerUnit;
                    
                    // Preis anpassen wenn Preiseinheit anders ist
                    if (product.priceUnit && product.priceUnit !== orderUnit) {
                        // Umrechnung für korrekte Preisanzeige
                        const conversionFactor = toRM[orderUnit] / toRM[product.priceUnit];
                        existingItem.pricePerUnit = product.price * conversionFactor;
                    }
                    
                    this.calculateOrderTotals();
                    selectInput.value = '';
                    if (isEditing) {
                        this.editOrderItemQuantity = 1;
                        this.editOrderItemUnit = 'RM';
                    } else {
                        this.newOrderItemQuantity = 1;
                        this.newOrderItemUnit = 'RM';
                    }
                    alert('✓ Menge aktualisiert: ' + existingItem.quantity.toFixed(2) + ' ' + existingItem.unit);
                    return;
                } else {
                    alert('Dieses Produkt wurde bereits mit einer anderen Einheit hinzugefügt (' + existingItem.unit + '). Bitte entferne es zuerst und füge es neu hinzu.');
                    return;
                }
            }
            
            // Preis pro Einheit berechnen basierend auf Produktpreis
            let pricePerUnit = product.price;
            const priceUnit = product.priceUnit || product.unit;
            
            // Wenn Bestelleinheit != Preiseinheit, Preis umrechnen
            if (orderUnit !== priceUnit) {
                // Preis von Preiseinheit auf Bestelleinheit umrechnen
                // Beispiel: Preis ist €100/FM, Bestellung in RM → €100/1.42 = €70.42/RM
                pricePerUnit = product.price * (toRM[priceUnit] / toRM[orderUnit]);
            }
            
            // Neues Item mit der eingegebenen Menge und Einheit
            targetItems.push({
                id: Date.now().toString() + Math.random().toString().slice(2, 7),
                productId: product.id,
                productName: product.name,
                woodType: product.woodType || '',
                logLength: product.logLength || 25,
                quantity: quantity,
                unit: orderUnit,
                pricePerUnit: pricePerUnit,
                priceUnit: priceUnit,
                total: quantity * pricePerUnit
            });
            
            // Eingabefelder zurücksetzen
            selectInput.value = '';
            if (isEditing) {
                this.editOrderItemQuantity = 1;
                this.editOrderItemUnit = 'RM';
            } else {
                this.newOrderItemQuantity = 1;
                this.newOrderItemUnit = 'RM';
            }
            
            this.calculateOrderTotals();
            console.log('Produkt mit Menge hinzugefügt:', product.name, quantity, orderUnit);
            alert('✓ ' + product.name + ' (' + quantity.toFixed(2) + ' ' + orderUnit + ') hinzugefügt!');
        },

        removeProductFromOrder(itemId, isEditing = false) {
            const targetItems = isEditing ? this.editingOrder.items : this.newOrder.items;
            const index = targetItems.findIndex(item => item.productId === itemId);
            if (index !== -1) {
                targetItems.splice(index, 1);
                this.calculateOrderTotals();
            }
        },

        updateItemQuantity(itemId, newQuantity) {
            const item = this.newOrder.items.find(item => item.productId === itemId);
            if (item) {
                if (newQuantity <= 0) {
                    this.removeProductFromOrder(itemId);
                } else {
                    item.quantity = newQuantity;
                    item.total = item.quantity * item.pricePerUnit;
                    this.calculateOrderTotals();
                }
            }
        },

        calculateOrderTotals() {
            // Zwischensumme berechnen (für newOrder)
            const subtotal = this.newOrder.items.reduce((sum, item) => {
                return sum + (item.quantity * item.pricePerUnit);
            }, 0);
            
            this.newOrder.subtotal = subtotal;
            this.newOrder.total = subtotal + this.newOrder.deliveryCosts;
            
            // Auch für editingOrder berechnen falls vorhanden
            if (this.editingOrder && this.editingOrder.items) {
                const editSubtotal = this.editingOrder.items.reduce((sum, item) => {
                    return sum + (item.quantity * item.pricePerUnit);
                }, 0);
                
                this.editingOrder.subtotal = editSubtotal;
                this.editingOrder.total = editSubtotal + (this.editingOrder.deliveryCosts || 0);
            }
        },

        async calculateDeliveryCostsForOrder() {
            if (!this.newOrder.deliveryAddress || !this.storageLocation) {
                alert('Bitte gib eine Lieferadresse und Holzlagerplatz an.');
                return;
            }
            
            this.loadingDistance = true;
            this.distanceError = '';
            
            try {
                const fromCoords = await this.geocodeAddress(this.storageLocation);
                const toCoords = await this.geocodeAddress(this.newOrder.deliveryAddress);
                
                if (!fromCoords || !toCoords) {
                    throw new Error('Konnte Koordinaten nicht ermitteln');
                }
                
                const route = await this.calculateRoute(fromCoords, toCoords);
                
                const rawCost = route.distance * this.costPerKm;
                const roundedCost = Math.round(rawCost * 100) / 100; // Auf 2 Dezimalstellen runden
                
                this.newOrder.deliveryCosts = roundedCost;
                this.calculateOrderTotals();
                
                alert(`✓ Lieferkosten berechnet: €${roundedCost.toFixed(2)} (${route.distance.toFixed(1)} km)`);
            } catch (error) {
                this.distanceError = error.message;
                alert('❌ Fehler bei Berechnung: ' + error.message);
            } finally {
                this.loadingDistance = false;
            }
        },

        async addOrder() {
            try {
                // Validierung
                if (!this.newOrder.customerId) {
                    alert('Bitte wähle einen Kunden aus.');
                    return;
                }
                
                if (this.newOrder.items.length === 0) {
                    alert('Bitte füge mindestens ein Produkt hinzu.');
                    return;
                }
                
                if (!this.newOrder.deliveryAddress || !this.newOrder.deliveryAddress.trim()) {
                    alert('Bitte gib eine Lieferadresse an.');
                    return;
                }
                
                // Lagerbestand prüfen und reduzieren
                for (const item of this.newOrder.items) {
                    const product = this.products.find(p => p.id === item.productId);
                    if (!product) {
                        throw new Error(`Produkt "${item.productName}" nicht gefunden`);
                    }
                    
                    if (product.quantity < item.quantity) {
                        alert(`❌ Nicht genügend Lagerbestand für "${product.name}":\nVerfügbar: ${product.quantity} ${product.unit}\nBestellt: ${item.quantity} ${item.unit}`);
                        return;
                    }
                }
                
                // Bestellung erstellen
                const order = {
                    id: Date.now().toString(),
                    orderNumber: 'ORD-' + Date.now().toString().slice(-6),
                    customerId: this.newOrder.customerId,
                    customerName: this.newOrder.customerName,
                    customerAddress: this.newOrder.customerAddress,
                    deliveryAddress: this.newOrder.deliveryAddress,
                    items: [...this.newOrder.items],
                    subtotal: this.newOrder.subtotal,
                    deliveryCosts: this.newOrder.deliveryCosts,
                    total: this.newOrder.total,
                    paymentMethod: this.newOrder.paymentMethod,
                    paymentStatus: this.newOrder.paymentStatus,
                    deliveryDate: this.newOrder.deliveryDate,
                    deliveryTime: this.newOrder.deliveryTime,
                    status: this.newOrder.status,
                    notes: (this.newOrder.notes || '').trim(),
                    logLength: this.newOrder.logLength || null,
                    createdAt: new Date().toISOString()
                };
                
                console.log('Erstelle Bestellung:', order);
                
                // Lagerbestand reduzieren (mit Umrechnung auf Produkteinheit)
                const toRM = {
                    'FM': 1.42,
                    'RM': 1,
                    'SRM': 1 / 1.42
                };
                
                for (const item of order.items) {
                    const productIndex = this.products.findIndex(p => p.id === item.productId);
                    if (productIndex !== -1) {
                        // Bestellmenge in Produkteinheit umrechnen
                        const quantityInProductUnit = item.quantity * toRM[item.unit] / toRM[this.products[productIndex].unit];
                        // Auf 1 Nachkommastelle runden und abziehen
                        const newQuantity = Math.round((this.products[productIndex].quantity - quantityInProductUnit) * 10) / 10;
                        
                        // Array kopieren für Vue-Reaktivität
                        const updatedProducts = [...this.products];
                        updatedProducts[productIndex].quantity = newQuantity;
                        this.products = updatedProducts;
                        
                        console.log(`Bestand aktualisiert: ${item.productName}, alt: ${this.products[productIndex].quantity + quantityInProductUnit}, neu: ${newQuantity}`);
                    }
                }
                
                // Stats aktualisieren
                this.orders.push(order);
                this.ordersCount = this.orders.length;
                this.inventoryCount = this.products.length;
                this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                
                // Daten in localStorage speichern
                this.saveProducts();
                this.saveOrders();
                
                // Formular zurücksetzen
                this.showAddOrder = false;
                this.newOrder = {
                    customerId: '',
                    customerName: '',
                    customerAddress: '',
                    deliveryAddress: '',
                    items: [],
                    subtotal: 0,
                    deliveryCosts: 0,
                    total: 0,
                    paymentMethod: 'bar',
                    paymentStatus: 'offen',
                    deliveryDate: '',
                    deliveryTime: '',
                    status: 'neu',
                    notes: ''
                };
                
                alert('✓ Bestellung erfolgreich erstellt!');
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('❌ Fehler beim Speichern der Bestellung: ' + error.message);
            }
        },

        editOrder(order) {
            this.editingOrder = { ...order, items: [...order.items] };
            this.showEditOrder = true;
        },

        async saveOrder() {
            try {
                // Validierung
                if (!this.editingOrder.customerId) {
                    alert('Bitte wähle einen Kunden aus.');
                    return;
                }
                
                if (this.editingOrder.items.length === 0) {
                    alert('Bitte füge mindestens ein Produkt hinzu.');
                    return;
                }
                
                // Index finden
                const index = this.orders.findIndex(o => o.id === this.editingOrder.id);
                
                if (index !== -1) {
                    // Bestand anpassen (Differenz berechnen)
                    const oldOrder = this.orders[index];
                    
                    // Alten Bestand wiederherstellen (mit Umrechnung auf Produkteinheit)
                    const toRM = {
                        'FM': 1.42,
                        'RM': 1,
                        'SRM': 1 / 1.42
                    };
                    
                    for (const item of oldOrder.items) {
                        const productIndex = this.products.findIndex(p => p.id === item.productId);
                        if (productIndex !== -1) {
                            const quantityInProductUnit = item.quantity * toRM[item.unit] / toRM[this.products[productIndex].unit];
                            this.products[productIndex].quantity = Math.round((this.products[productIndex].quantity + quantityInProductUnit) * 10) / 10;
                        }
                    }
                    
                    // Neuen Bestand abziehen (mit Umrechnung auf Produkteinheit)
                    for (const item of this.editingOrder.items) {
                        const productIndex = this.products.findIndex(p => p.id === item.productId);
                        if (productIndex !== -1) {
                            const quantityInProductUnit = item.quantity * toRM[item.unit] / toRM[this.products[productIndex].unit];
                            if (this.products[productIndex].quantity < quantityInProductUnit) {
                                alert(`❌ Nicht genügend Lagerbestand für "${this.products[productIndex].name}"`);
                                return;
                            }
                            this.products[productIndex].quantity = Math.round((this.products[productIndex].quantity - quantityInProductUnit) * 10) / 10;
                        }
                    }
                    
                    // Bestellung aktualisieren
                    const updatedOrder = {
                        ...this.editingOrder,
                        updatedAt: new Date().toISOString()
                    };
                    
                    const updatedOrders = [...this.orders];
                    updatedOrders[index] = updatedOrder;
                    this.orders = updatedOrders;
                    
                    // Stats aktualisieren
                    this.inventoryCount = this.products.length;
                    this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                    
                    // In localStorage speichern
                    this.saveProducts();
                    this.saveOrders();
                    
                    setTimeout(() => {
                        this.showEditOrder = false;
                        this.editingOrder = null;
                    }, 100);
                    
                    alert('✓ Bestellung erfolgreich aktualisiert!');
                } else {
                    throw new Error('Bestellung nicht gefunden');
                }
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                alert('❌ Fehler beim Speichern: ' + error.message);
            }
        },

        deleteOrder(order) {
            if (confirm('Möchtest du die Bestellung "' + order.orderNumber + '" wirklich löschen?')) {
                // Bestand wiederherstellen (mit Umrechnung auf Produkteinheit)
                const toRM = {
                    'FM': 1.42,
                    'RM': 1,
                    'SRM': 1 / 1.42
                };
                
                for (const item of order.items) {
                    const productIndex = this.products.findIndex(p => p.id === item.productId);
                    if (productIndex !== -1) {
                        const quantityInProductUnit = item.quantity * toRM[item.unit] / toRM[this.products[productIndex].unit];
                        this.products[productIndex].quantity = Math.round((this.products[productIndex].quantity + quantityInProductUnit) * 10) / 10;
                    }
                }
                
                this.orders = this.orders.filter(o => o.id !== order.id);
                this.ordersCount = this.orders.length;
                this.inventoryCount = this.products.length;
                this.totalValue = this.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                
                // In localStorage speichern
                this.saveProducts();
                this.saveOrders();
                
                alert('✓ Bestellung gelöscht.');
            }
        },
        
        saveOrders() {
            localStorage.setItem('firewoodflow_orders', JSON.stringify(this.orders));
        },

        updateOrderStatus(order, newStatus) {
            const index = this.orders.findIndex(o => o.id === order.id);
            if (index !== -1) {
                this.orders[index].status = newStatus;
                alert('✓ Status aktualisiert: ' + newStatus);
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
                const coordMatch = address.match(
                    /(-?\d+[,.]?\d*)°?\s*[NS]?\s*,\s*(-?\d+[,.]?\d*)°?\s*[OW]?\s*/i
                );
                
                if (coordMatch) {
                    let lat = parseFloat(coordMatch[1].replace(',', '.'));
                    let lon = parseFloat(coordMatch[2].replace(',', '.'));
                    
                    const upperAddress = address.toUpperCase();
                    
                    if (upperAddress.includes('S') && !upperAddress.includes('N')) {
                        lat = -Math.abs(lat);
                    } else {
                        lat = Math.abs(lat);
                    }
                    
                    if (upperAddress.includes('W') && !upperAddress.includes('O') && !upperAddress.includes('E')) {
                        lon = -Math.abs(lon);
                    } else {
                        lon = Math.abs(lon);
                    }
                    
                    coords = { lat, lon };
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
        },

        // Helper Methoden für Bestellungen
        getStatusLabel(status) {
            const labels = {
                'neu': '🆕 Neu',
                'bestaetigt': '✓ Bestätigt',
                'in_lieferung': '🚚 In Lieferung',
                'abgeschlossen': '✅ Abgeschlossen',
                'storniert': '❌ Storniert'
            };
            return labels[status] || status;
        },

        getPaymentMethodLabel(method) {
            const labels = {
                'bar': '💵 Bar',
                'ueberweisung': '🏦 Überweisung',
                'paypal': '📱 PayPal'
            };
            return labels[method] || method;
        },

        getPaymentStatusLabel(status) {
            const labels = {
                'offen': '⏳ Offen',
                'bezahlt': '✓ Bezahlt',
                'teilweise': '◐ Teilweise'
            };
            return labels[status] || status;
        },

        formatDeliveryDate(date, time) {
            if (!date) return 'Kein Datum';
            const d = new Date(date);
            const dateStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
            if (!time || time === '') return dateStr;
            // Zeit im Format HH:MM anzeigen
            return `${dateStr} • ${time} Uhr`;
        }
    }
}).mount('#app');
