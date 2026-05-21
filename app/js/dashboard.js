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
            costPerKm: 1.50,
            roundingMode: 'exact',
            whatsappConfirmationTemplate: `Hallo {customer_name},\n\nvielen Dank für Ihre Bestellung bei FireWoodFlow!\n\n📦 **Bestellübersicht**:\n{items}\n\n💰 **Gesamtsumme**: {total} (inkl. {delivery_costs} Lieferkosten)\n\n📅 **Lieferdatum**: {delivery_date}\n📍 **Lieferadresse**: {delivery_address}\n\nBei Fragen antworten Sie einfach auf diese Nachricht.\n\nMit freundlichen Grüßen,\nIhr FireWoodFlow Team`,
            
            // Inventar-Einstellungen
            inventorySettings: {
                woodTypes: ['Buche', 'Eiche', 'Birke', 'Fichte', 'Kiefer', 'Esche', 'Ahorn', 'Gemischt'],
                productTypes: ['Brennholz', 'Anzündholz'],
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
                productType: 'Brennholz',
                quantity: 0,
                unit: 'FM',
                woodType: '',
                logLength: 100,
                dryness: 'frisch',
                price: 0,
                priceLengths: {}, // { 25: { srm: 0, rm: 0 }, 33: { srm: 0, rm: 0 }, ... }
                storageLocationIndex: '',
                purchaseDate: new Date().toISOString().split('T')[0],
                notes: ''
            },
            
            // Kunden Daten
            customerCount: 0,
            customers: [],
            showAddCustomer: false,
            showAddCustomerFromOrder: false,
            showEditCustomer: false,
            editingCustomer: null,
            showDeliveryModal: false,
            selectedCustomer: null,
            
            // Customer Details Modal (neu)
            showCustomerDetailsModal: false,
            customerOrdersFilter: 'all',
            selectedSeasonYear: null,
            
            // Reminder & WhatsApp Settings
            reminderSettings: {
                enabled: false,
                daysBeforeReminder: 30, // Tage vor erwarteter Bestellung
                viaWhatsApp: true,
                viaEmail: false,
                customMessage: ''
            },
            
            loadingDistance: false,
            distanceError: '',
            distanceResult: null,
            newCustomer: {
                name: '',
                address: '',
                phone: '',
                email: '',
                notes: '',
                deliveryCosts: 0,
                preferredStorageLocationIndex: ''
            },
            
            // Stats
            todayOrders: [],
            
            // Delivery Planning
            currentWeekStart: null,
            selectedDay: null,
            
            // Revenue Dashboard
            revenuePeriod: 'month',
            showAddExpense: false,
            expenses: [],
            newExpense: {
                amount: '',
                category: 'fuel',
                description: '',
                date: '',
                notes: '',
                storageLocationIndex: ''
            },
            selectedStorageLocation: null, // null = alle Lager, 0 = Lager 1, 1 = Lager 2, etc.
            
            // Storage Locations (Lagerplätze)
            storageLocations: [],
            
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
            newOrderItemLogLength: 100,
            editOrderItemLogLength: 100,
            newOrder: {
                customerId: '',
                customerName: '',
                customerAddress: '',
                deliveryAddress: '',
                items: [],
                subtotal: 0,
                deliveryCosts: 0,
                discount: 0,
                total: 0,
                paymentMethod: 'bar',
                paymentStatus: 'offen',
                deliveryDate: '',
                deliveryTime: '',
                status: 'neu',
                notes: '',
                logLength: '',
                storageLocationIndex: 0 // Default: erster Lagerplatz
            },
            orderStatusFilter: 'alle',
            
            // Quick Order (Schnellbestellung)
            showQuickOrderModal: false,
            quickOrderStep: 1,
            selectedQuickOrderCustomer: null,
            quickOrderCustomers: [],
            lastOrderForCustomer: null,
            quickOrderData: {
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
            }
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
        },

        nextOrder() {
            // Finde den nächsten ausstehenden Auftrag basierend auf Lieferdatum und -zeit
            const pendingOrders = this.orders.filter(o => {
                const status = o.status || '';
                return status !== 'erledigt' && status !== 'storniert' && o.deliveryDate;
            });

            if (pendingOrders.length === 0) return null;

            // Sortiere nach Datum und Zeit
            pendingOrders.sort((a, b) => {
                const dateA = new Date(a.deliveryDate + 'T' + (a.deliveryTime || '00:00'));
                const dateB = new Date(b.deliveryDate + 'T' + (b.deliveryTime || '00:00'));
                return dateA - dateB;
            });

            return pendingOrders[0];
        },

        todayOrdersList() {
            // Alle Aufträge für heute zurückgeben
            const today = new Date().toISOString().split('T')[0];
            
            const todaysOrders = this.orders.filter(o => {
                const status = o.status || '';
                return o.deliveryDate === today && status !== 'erledigt' && status !== 'storniert';
            });

            // Nach Uhrzeit sortieren
            todaysOrders.sort((a, b) => {
                const timeA = a.deliveryTime || '00:00';
                const timeB = b.deliveryTime || '00:00';
                return timeA.localeCompare(timeB);
            });

            return todaysOrders;
        },

        // Delivery Planning Computed
        weekDays() {
            // Array der 7 Tage der aktuellen Woche
            const days = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(this.currentWeekStart);
                date.setDate(date.getDate() + i);
                
                const dateStr = date.toISOString().split('T')[0];
                const dayOrders = this.orders.filter(o => o.deliveryDate === dateStr);
                
                days.push({
                    date: dateStr,
                    dayName: date.toLocaleDateString('de-DE', { weekday: 'short' }),
                    dayNumber: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                    orderCount: dayOrders.length,
                    totalDistance: dayOrders.reduce((sum, o) => sum + (o.distance || 0), 0)
                });
            }
            return days;
        },

        selectedDayOrders() {
            if (!this.selectedDay) return [];
            return this.orders.filter(o => o.deliveryDate === this.selectedDay);
        },

        // Revenue Dashboard Computed
        periodOrders() {
            const now = new Date();
            let startDate = null;
            
            switch(this.revenuePeriod) {
                case 'today':
                    startDate = now.toISOString().split('T')[0];
                    break;
                case 'week':
                    const day = now.getDay();
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(now.setDate(diff));
                    startDate = monday.toISOString().split('T')[0];
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    break;
                case 'all':
                default:
                    startDate = '2000-01-01';
            }
            
            return this.orders.filter(o => o.deliveryDate >= startDate && o.status !== 'storniert');
        },

        // Filter orders by selected storage location
        filteredPeriodOrders() {
            if (this.selectedStorageLocation === null) {
                return this.periodOrders;
            }
            return this.periodOrders.filter(o => {
                const orderLoc = o.storageLocationIndex !== undefined ? o.storageLocationIndex : 0;
                return orderLoc === this.selectedStorageLocation;
            });
        },

        periodRevenue() {
            return this.filteredPeriodOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        },

        periodOrderCount() {
            return this.filteredPeriodOrders.length;
        },

        // Filter expenses by selected storage location
        filteredPeriodExpensesData() {
            const now = new Date();
            let startDate = null;
            
            switch(this.revenuePeriod) {
                case 'today':
                    startDate = now.toISOString().split('T')[0];
                    break;
                case 'week':
                    const day = now.getDay();
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(now.setDate(diff));
                    startDate = monday.toISOString().split('T')[0];
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    break;
                case 'all':
                default:
                    startDate = '2000-01-01';
            }
            
            let filtered = this.expenses.filter(e => e.date >= startDate);
            
            if (this.selectedStorageLocation !== null) {
                filtered = filtered.filter(e => {
                    // Beide Varianten prüfen: camelCase und snake_case
                    const expenseLoc = e.storageLocationIndex !== undefined ? e.storageLocationIndex : 
                                       e.storage_location_index !== undefined ? e.storage_location_index : null;
                    return expenseLoc === this.selectedStorageLocation;
                });
            }
            
            return filtered;
        },

        periodExpenses() {
            return this.filteredPeriodExpensesData.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        },

        periodExpenseCount() {
            return this.filteredPeriodExpensesData.length;
        },

        periodProfit() {
            return this.periodRevenue - this.periodExpenses - this.periodInventoryCost;
        },

        periodInventoryCost() {
            // Berechnet die Wareneinsatzkosten (Einkaufspreis der verkauften Produkte)
            const toRM = {
                'FM': 1.42,
                'RM': 1,
                'SRM': 1 / 1.42
            };
            
            let totalCost = 0;
            
            this.filteredPeriodOrders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        const product = this.products.find(p => p.id === item.productId);
                        if (product) {
                            // Verkaufte Menge in Produkteinheit umrechnen
                            const quantityInProductUnit = (parseFloat(item.quantity) || 0) * toRM[item.unit] / toRM[product.unit];
                            // Mit Einkaufspreis multiplizieren
                            totalCost += quantityInProductUnit * (parseFloat(product.price) || 0);
                        }
                    });
                }
            });
            
            return totalCost;
        },

        periodInventoryCostCount() {
            // Anzahl der verkauften Produkte mit Wareneinsatz
            let count = 0;
            this.filteredPeriodOrders.forEach(order => {
                if (order.items) {
                    count += order.items.length;
                }
            });
            return count;
        },

        profitMargin() {
            if (this.periodRevenue === 0) return 0;
            return (this.periodProfit / this.periodRevenue) * 100;
        },

        avgOrderValue() {
            if (this.periodOrderCount === 0) return 0;
            return this.periodRevenue / this.periodOrderCount;
        },

        // Letzte Aktivitäten – zeigt die 10 neuesten Ereignisse
        recentActivities() {
            const activities = [];
            
            // 1. Bestellungen (Statusänderungen & neue Bestellungen)
            this.orders.forEach(order => {
                // Neue Bestellung erstellt
                if (order.createdAt) {
                    activities.push({
                        type: 'order_created',
                        title: 'Bestellung erstellt',
                        description: `${order.orderNumber || 'Bestellung'} von ${order.customerName}`,
                        date: order.createdAt,
                        icon: '📦',
                        color: '#4CAF50'
                    });
                }
                
                // Statusänderung (wenn statusUpdatedAt vorhanden)
                if (order.status && order.statusUpdatedAt) {
                    activities.push({
                        type: 'status_changed',
                        title: `Status: ${this.getStatusLabel(order.status)}`,
                        description: `${order.orderNumber || 'Bestellung'} von ${order.customerName}`,
                        date: order.statusUpdatedAt,
                        icon: '🔄',
                        color: '#2196F3'
                    });
                }
            });
            
            // 2. Neue Kunden
            this.customers.forEach(customer => {
                if (customer.createdAt) {
                    activities.push({
                        type: 'customer_added',
                        title: 'Neuer Kunde',
                        description: customer.name,
                        date: customer.createdAt,
                        icon: '👤',
                        color: '#FF9800'
                    });
                }
            });
            
            // 3. Neue Produkte
            this.products.forEach(product => {
                if (product.createdAt || product.purchaseDate) {
                    activities.push({
                        type: 'product_added',
                        title: 'Produkt ins Lager aufgenommen',
                        description: `${product.name} (${product.quantity} ${product.unit})`,
                        date: product.createdAt || product.purchaseDate,
                        icon: '🪵',
                        color: '#795548'
                    });
                }
            });
            
            // Nach Datum sortieren (neueste zuerst)
            activities.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Nur die 10 neuesten zurückgeben
            return activities.slice(0, 10);
        },

        revenueChartData() {
            const data = [];
            const now = new Date();
            let days = [];
            
            switch(this.revenuePeriod) {
                case 'today':
                    // Hourly chart for today
                    for (let i = 0; i < 24; i += 4) {
                        days.push({ label: `${i}:00`, value: 0 });
                    }
                    break;
                case 'week':
                    // Daily chart for this week
                    const day = now.getDay();
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(now.setDate(diff));
                    for (let i = 0; i < 7; i++) {
                        const date = new Date(monday);
                        date.setDate(date.getDate() + i);
                        const dateStr = date.toISOString().split('T')[0];
                        days.push({ 
                            label: date.toLocaleDateString('de-DE', { weekday: 'short' }), 
                            date: dateStr,
                            value: 0 
                        });
                    }
                    break;
                case 'month':
                    // Daily chart for this month (simplified to weeks)
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const weeks = Math.ceil(daysInMonth / 7);
                    for (let i = 0; i < weeks; i++) {
                        days.push({ label: `KW ${i + 1}`, value: 0 });
                    }
                    break;
                case 'year':
                    // Monthly chart
                    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                    for (let i = 0; i < 12; i++) {
                        days.push({ label: months[i], value: 0 });
                    }
                    break;
                case 'all':
                default:
                    // Yearly chart
                    const currentYear = now.getFullYear();
                    for (let i = currentYear - 4; i <= currentYear; i++) {
                        days.push({ label: String(i), value: 0 });
                    }
            }
            
            // Calculate values
            this.periodOrders.forEach(order => {
                const orderDate = new Date(order.deliveryDate);
                let idx = -1;
                
                switch(this.revenuePeriod) {
                    case 'today':
                        idx = Math.floor(orderDate.getHours() / 4);
                        break;
                    case 'week':
                        const dayOfWeek = orderDate.getDay() || 7; // Convert Sunday from 0 to 7
                        idx = dayOfWeek - 1;
                        break;
                    case 'month':
                        const dayOfMonth = orderDate.getDate();
                        idx = Math.floor((dayOfMonth - 1) / 7);
                        break;
                    case 'year':
                        idx = orderDate.getMonth();
                        break;
                    case 'all':
                        idx = orderDate.getFullYear() - (now.getFullYear() - 4);
                }
                
                if (idx >= 0 && idx < days.length) {
                    days[idx].value += parseFloat(order.total) || 0;
                }
            });
            
            // Calculate heights based on max value
            const maxValue = Math.max(...days.map(d => d.value), 1);
            days.forEach(day => {
                day.height = (day.value / maxValue) * 100;
            });
            
            return days;
        },

        topCustomers() {
            const customerMap = {};
            
            this.periodOrders.forEach(order => {
                if (!customerMap[order.customerName]) {
                    customerMap[order.customerName] = { name: order.customerName, total: 0, orderCount: 0 };
                }
                customerMap[order.customerName].total += parseFloat(order.total) || 0;
                customerMap[order.customerName].orderCount++;
            });
            
            return Object.values(customerMap)
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);
        },

        topProducts() {
            const productMap = {};
            
            this.periodOrders.forEach(order => {
                order.items.forEach(item => {
                    const key = `${item.productName}-${item.logLength}`;
                    if (!productMap[key]) {
                        productMap[key] = { 
                            name: item.productName, 
                            logLength: item.logLength,
                            unit: item.unit,
                            quantitySold: 0, 
                            revenue: 0 
                        };
                    }
                    productMap[key].quantitySold += parseFloat(item.quantity) || 0;
                    
                    // Calculate revenue proportionally
                    const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.pricePerUnit) || 0);
                    productMap[key].revenue += itemTotal;
                });
            });
            
            return Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);
        },

        // Customer Details Computed Properties
        customerLifetimeRevenue() {
            if (!this.selectedCustomer) return 0;
            const customerOrders = this.orders.filter(o => o.customerId === this.selectedCustomer.id && o.status !== 'storniert');
            return customerOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        },

        customerOrderCount() {
            if (!this.selectedCustomer) return 0;
            return this.orders.filter(o => o.customerId === this.selectedCustomer.id).length;
        },

        customerAvgOrderValue() {
            if (!this.selectedCustomer || this.customerOrderCount === 0) return 0;
            return this.customerLifetimeRevenue / this.customerOrderCount;
        },

        customerLastOrderDate() {
            if (!this.selectedCustomer) return null;
            const customerOrders = this.orders.filter(o => o.customerId === this.selectedCustomer.id);
            if (customerOrders.length === 0) return null;
            
            const sorted = customerOrders.sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
            return this.formatDate(sorted[0].deliveryDate);
        },

        // Season year (Juli–Juni): Saison 2025/26 = Juli 2025 bis Juni 2026
        availableSeasonYears() {
            const now = new Date();
            const currentYear = now.getFullYear();
            const years = [];
            
            // Letzte 5 Saisons + aktuelle Saison
            for (let i = 4; i >= 0; i--) {
                years.push(currentYear - i);
            }
            return years;
        },

        selectedSeasonYear() {
            // Automatisch aktuelle Saison auswählen
            const now = new Date();
            const currentYear = now.getFullYear();
            // Wenn wir zwischen Jan-Jun sind, gehört das zur vorherigen Saison (Juni ist Ende)
            // Wenn wir zwischen Jul-Dez sind, gehört das zur aktuellen Saison
            if (now.getMonth() < 6) { // Jan-Jun
                return currentYear - 1;
            } else { // Jul-Dez
                return currentYear;
            }
        },

        // Bestellungen der aktuellen Saison für den Kunden
        currentSeasonOrders() {
            if (!this.selectedCustomer) return [];
            
            const seasonStartYear = this.selectedSeasonYear;
            const seasonEndYear = seasonStartYear + 1;
            
            // Saison: 1. Juli seasonStartYear bis 30. Juni seasonEndYear
            const seasonStart = new Date(seasonStartYear, 6, 1); // 1. Juli (Monat 6 = Juli)
            const seasonEnd = new Date(seasonEndYear, 5, 30); // 30. Juni (Monat 5 = Juni)
            
            return this.orders.filter(o => {
                if (o.customerId !== this.selectedCustomer.id) return false;
                if (o.status === 'storniert') return false;
                
                const orderDate = new Date(o.deliveryDate);
                return orderDate >= seasonStart && orderDate <= seasonEnd;
            });
        },

        // Durchschnitt pro Scheitlänge für aktuelle Saison
        currentSeasonStats() {
            const orders = this.currentSeasonOrders;
            if (orders.length === 0) return [];
            
            // Gruppiere nach Scheitlänge
            const byLogLength = {};
            
            orders.forEach(order => {
                order.items.forEach(item => {
                    const key = `${item.logLength}-${item.unit}`;
                    if (!byLogLength[key]) {
                        byLogLength[key] = {
                            logLength: item.logLength,
                            unit: item.unit,
                            totalQuantity: 0,
                            orderCount: 0
                        };
                    }
                    byLogLength[key].totalQuantity += parseFloat(item.quantity) || 0;
                    byLogLength[key].orderCount++;
                });
            });
            
            // Berechne Durchschnitt pro Bestellung
            return Object.values(byLogLength).map(stat => ({
                ...stat,
                avgQuantity: stat.totalQuantity / stat.orderCount
            })).sort((a, b) => a.logLength - b.logLength);
        },

        // Gefilterte Bestellungen des Kunden
        filteredCustomerOrders() {
            if (!this.selectedCustomer) return [];
            
            let orders = this.orders.filter(o => o.customerId === this.selectedCustomer.id);
            
            // Nach Jahr filtern
            const now = new Date();
            const currentYear = now.getFullYear();
            
            if (this.customerOrdersFilter === 'this_year') {
                const yearStart = new Date(currentYear, 0, 1);
                orders = orders.filter(o => new Date(o.deliveryDate) >= yearStart);
            } else if (this.customerOrdersFilter === 'last_year') {
                const lastYearStart = new Date(currentYear - 1, 0, 1);
                const thisYearStart = new Date(currentYear, 0, 1);
                orders = orders.filter(o => {
                    const d = new Date(o.deliveryDate);
                    return d >= lastYearStart && d < thisYearStart;
                });
            }
            
            // Sortieren nach Datum (neueste zuerst)
            return orders.sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
        },

        // Vorjahres-Vergleich (aktuelle Saison vs. letzte Saison)
        previousSeasonOrders() {
            if (!this.selectedCustomer) return [];
            
            const prevSeasonStartYear = this.selectedSeasonYear - 1;
            const prevSeasonEndYear = prevSeasonStartYear + 1;
            
            // Letzte Saison: 1. Juli (Jahr-1) bis 30. Juni (Jahr)
            const seasonStart = new Date(prevSeasonStartYear, 6, 1);
            const seasonEnd = new Date(prevSeasonEndYear, 5, 30);
            
            return this.orders.filter(o => {
                if (o.customerId !== this.selectedCustomer.id) return false;
                if (o.status === 'storniert') return false;
                
                const orderDate = new Date(o.deliveryDate);
                return orderDate >= seasonStart && orderDate <= seasonEnd;
            });
        },

        seasonComparison() {
            const currentRevenue = this.currentSeasonOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
            const prevRevenue = this.previousSeasonOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
            
            const currentQuantity = {};
            const prevQuantity = {};
            
            // Mengen nach Scheitlänge aggregieren
            this.currentSeasonOrders.forEach(o => {
                o.items.forEach(item => {
                    const key = `${item.logLength}-${item.unit}`;
                    if (!currentQuantity[key]) currentQuantity[key] = 0;
                    currentQuantity[key] += parseFloat(item.quantity);
                });
            });
            
            this.previousSeasonOrders.forEach(o => {
                o.items.forEach(item => {
                    const key = `${item.logLength}-${item.unit}`;
                    if (!prevQuantity[key]) prevQuantity[key] = 0;
                    prevQuantity[key] += parseFloat(item.quantity);
                });
            });
            
            // Vergleich berechnen
            const comparisons = [];
            const allKeys = [...new Set([...Object.keys(currentQuantity), ...Object.keys(prevQuantity)])];
            
            allKeys.forEach(key => {
                const [logLength, unit] = key.split('-');
                const curr = currentQuantity[key] || 0;
                const prev = prevQuantity[key] || 0;
                const diff = curr - prev;
                const percentChange = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
                
                comparisons.push({
                    logLength,
                    unit,
                    current: curr,
                    previous: prev,
                    diff,
                    percentChange
                });
            });
            
            return {
                revenue: {
                    current: currentRevenue,
                    previous: prevRevenue,
                    diff: currentRevenue - prevRevenue,
                    percentChange: prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : (currentRevenue > 0 ? 100 : 0)
                },
                quantities: comparisons.sort((a, b) => a.logLength - b.logLength)
            };
        },

        // Nächste Bestellung vorhersagen
        nextOrderPrediction() {
            if (!this.selectedCustomer) return null;
            
            const customerOrders = this.orders
                .filter(o => o.customerId === this.selectedCustomer.id && o.status !== 'storniert')
                .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));
            
            if (customerOrders.length < 2) return null;
            
            // Durchschnittlichen Abstand zwischen Bestellungen berechnen
            const intervals = [];
            for (let i = 1; i < customerOrders.length; i++) {
                const daysDiff = (new Date(customerOrders[i].deliveryDate) - new Date(customerOrders[i-1].deliveryDate)) / (1000 * 60 * 60 * 24);
                intervals.push(daysDiff);
            }
            
            const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
            
            // Letzte Bestellung
            const lastOrder = customerOrders[customerOrders.length - 1];
            const lastOrderDate = new Date(lastOrder.deliveryDate);
            
            // Voraussichtlicher nächster Termin
            const predictedDate = new Date(lastOrderDate);
            predictedDate.setDate(predictedDate.getDate() + Math.round(avgInterval));
            
            // Erinnerungsd datum (basierend auf reminderSettings)
            const reminderDays = this.reminderSettings.daysBeforeReminder || 30;
            const reminderDate = new Date(predictedDate);
            reminderDate.setDate(reminderDate.getDate() - reminderDays);
            
            return {
                avgIntervalDays: Math.round(avgInterval),
                lastOrderDate,
                predictedDate,
                reminderDate,
                shouldRemindNow: new Date() >= reminderDate && new Date() < predictedDate
            };
        },

        // Treue-Rabatt Empfehlung
        loyaltyDiscountRecommendation() {
            if (!this.selectedCustomer) return null;
            
            const totalRevenue = this.customerLifetimeRevenue;
            const orderCount = this.customerOrderCount;
            
            // Rabatt-Stufen basierend auf Umsatz
            let tier = '';
            let recommendedPercent = 0;
            let nextTierThreshold = 0;
            let progress = 0;
            
            if (totalRevenue >= 5000) {
                tier = 'Platin';
                recommendedPercent = 8;
                nextTierThreshold = 0;
                progress = 100;
            } else if (totalRevenue >= 2500) {
                tier = 'Gold';
                recommendedPercent = 5;
                nextTierThreshold = 5000;
                progress = ((totalRevenue - 2500) / 2500) * 100;
            } else if (totalRevenue >= 1000) {
                tier = 'Silber';
                recommendedPercent = 3;
                nextTierThreshold = 2500;
                progress = ((totalRevenue - 1000) / 1500) * 100;
            } else if (totalRevenue >= 500) {
                tier = 'Bronze';
                recommendedPercent = 2;
                nextTierThreshold = 1000;
                progress = ((totalRevenue - 500) / 500) * 100;
            } else {
                tier = 'Standard';
                recommendedPercent = 0;
                nextTierThreshold = 500;
                progress = (totalRevenue / 500) * 100;
            }
            
            return {
                tier,
                recommendedPercent,
                nextTierThreshold,
                progress: Math.min(progress, 100),
                totalRevenue,
                orderCount,
                avgOrderValue: this.customerAvgOrderValue
            };
        },

        // WhatsApp Nachricht vorbereiten
        getWhatsAppMessage(template) {
            if (!this.selectedCustomer) return '';
            
            const prediction = this.nextOrderPrediction;
            const loyalty = this.loyaltyDiscountRecommendation;
            
            const messages = {
                reminder: () => {
                    const dateStr = prediction.predictedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return `Hallo ${this.selectedCustomer.name}! 👋%0A%0AEs ist wieder soweit – die nächste Brennholz-Bestellung steht an! Basierend auf Ihren bisherigen Bestellungen empfehlen wir eine Lieferung am ${dateStr}.%0A%0AWollen wir das so planen? Einfach antworten! 🔥`;
                },
                loyalty: () => {
                    if (!loyalty || loyalty.recommendedPercent === 0) return '';
                    return `Hallo ${this.selectedCustomer.name}! 👋%0A%0AAls treuer Kunde (Umsatz: €${loyalty.totalRevenue.toFixed(2)}) haben Sie sich einen ${loyalty.recommendedPercent}% Treue-Rabatt verdient! 🎉%0A%0ABei Ihrer nächsten Bestellung einfach diesen Code nennen: LOYAL${loyalty.recommendedPercent}%0A%0AVielen Dank für Ihre Treue! 🔥`;
                },
                seasonal: () => {
                    return `Hallo ${this.selectedCustomer.name}! 👋%0A%0ADie neue Heizsaison kommt! 🍂 Haben Sie schon genug Brennholz für den Winter?%0A%0AJetzt bestellen und von aktuellen Preisen profitieren. Gerne liefern wir Ihnen! 🔥%0A%0AFragen Sie einfach nach Ihrem persönlichen Angebot!`;
                }
            };
            
            return messages[template] ? messages[template]() : '';
        },

        openWhatsApp(template) {
            if (!this.selectedCustomer) return;
            
            const message = this.getWhatsAppMessage(template);
            if (!message) {
                alert('Keine Nachricht verfügbar');
                return;
            }
            
            // Telefonnumer formatieren (nur Ziffern, Ländervorwahl)
            let phone = this.selectedCustomer.phone || '';
            phone = phone.replace(/[^0-9+]/g, '');
            
            // Wenn keine Ländervorwahl, deutsche hinzufügen
            if (!phone.startsWith('+')) {
                if (phone.startsWith('0')) {
                    phone = '+49' + phone.substring(1);
                } else if (phone.startsWith('49')) {
                    phone = '+' + phone;
                } else {
                    phone = '+49' + phone;
                }
            }
            
            const url = `https://wa.me/${phone}?text=${message}`;
            window.open(url, '_blank');
        },

        recentExpenses() {
            return this.expenses
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);
        },

        expensesByCategory() {
            const categoryMap = {};
            const now = new Date();
            let startDate = null;
            
            switch(this.revenuePeriod) {
                case 'today':
                    startDate = now.toISOString().split('T')[0];
                    break;
                case 'week':
                    const day = now.getDay();
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(now.setDate(diff));
                    startDate = monday.toISOString().split('T')[0];
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    break;
                case 'all':
                default:
                    startDate = '2000-01-01';
            }
            
            this.expenses.filter(e => e.date >= startDate).forEach(expense => {
                if (!categoryMap[expense.category]) {
                    categoryMap[expense.category] = { total: 0, count: 0 };
                }
                categoryMap[expense.category].total += parseFloat(expense.amount) || 0;
                categoryMap[expense.category].count++;
            });
            
            return categoryMap;
        }
    },

    async mounted() {
        // Session prüfen
        await this.checkAuth();
        
        // Firmen-Daten laden (ohne storageLocations - die kommen aus Supabase)
        this.loadCompanySettings();
        
        // Lagerplätze aus Supabase laden (neu!)
        await this.loadStorageLocations();
        
        // Delivery Planning initialisieren
        this.initWeekStart();
        
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
                this.companyName = data.name || '';
                this.companyLogo = data.logo || '';
                this.companyAddress = data.address || '';
                // storageLocations werden jetzt aus Supabase geladen!
                this.costPerKm = data.costPerKm || 1.50;
                this.roundingMode = data.roundingMode || 'exact';
                this.whatsappConfirmationTemplate = data.whatsappConfirmationTemplate || `Hallo {customer_name},\n\nvielen Dank für Ihre Bestellung bei FireWoodFlow!\n\n📦 **Bestellübersicht**:\n{items}\n\n💰 **Gesamtsumme**: {total} (inkl. {delivery_costs} Lieferkosten)\n\n📅 **Lieferdatum**: {delivery_date}\n📍 **Lieferadresse**: {delivery_address}\n\nBei Fragen antworten Sie einfach auf diese Nachricht.\n\nMit freundlichen Grüßen,\nIhr FireWoodFlow Team`;
            }
            
            // Inventar-Einstellungen laden
            this.loadInventorySettings();
        },

        loadInventorySettings() {
            // Zuerst aus Supabase laden (wenn verfügbar)
            this.loadInventorySettingsFromSupabase();
            
            // Fallback: Aus localStorage laden (wird in loadInventorySettingsFromSupabase gemacht)
        },

        async loadInventorySettingsFromSupabase() {
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    const { data, error } = await supabaseClient
                        .from('inventory_settings')
                        .select('*')
                        .single();
                    
                    if (!error && data) {
                        // JSONB Arrays parsen
                        this.inventorySettings = {
                            woodTypes: data.wood_types || [],
                            drynessLevels: data.dryness_levels || [],
                            logLengths: data.log_lengths || []
                        };
                        console.log('✓ Inventar-Einstellungen aus Supabase geladen');
                        return;
                    }
                }
            } catch (error) {
                console.warn('Konnte Inventar-Einstellungen nicht aus Supabase laden:', error.message);
            }
            
            // Fallback: Aus localStorage laden
            const saved = localStorage.getItem('firewoodflow_inventory_settings');
            if (saved) {
                const data = JSON.parse(saved);
                this.inventorySettings = {
                    woodTypes: data.woodTypes || this.inventorySettings.woodTypes,
                    drynessLevels: data.drynessLevels || this.inventorySettings.drynessLevels,
                    logLengths: data.logLengths || this.inventorySettings.logLengths
                };
                console.log('✓ Inventar-Einstellungen aus localStorage geladen');
            }
        },

        async saveInventorySettings() {
            // In Supabase speichern (wenn verfügbar)
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    // Prüfen ob Eintrag existiert
                    const { data: existing } = await supabaseClient
                        .from('inventory_settings')
                        .select('id')
                        .eq('user_id', user.id)
                        .single();
                    
                    let error;
                    if (existing) {
                        // Update
                        ({ error } = await supabaseClient
                            .from('inventory_settings')
                            .update({
                                wood_types: this.inventorySettings.woodTypes,
                                dryness_levels: this.inventorySettings.drynessLevels,
                                log_lengths: this.inventorySettings.logLengths
                            })
                            .eq('user_id', user.id));
                    } else {
                        // Insert
                        ({ error } = await supabaseClient
                            .from('inventory_settings')
                            .insert({
                                user_id: user.id,
                                wood_types: this.inventorySettings.woodTypes,
                                dryness_levels: this.inventorySettings.drynessLevels,
                                log_lengths: this.inventorySettings.logLengths
                            }));
                    }
                    
                    if (!error) {
                        console.log('✓ Inventar-Einstellungen in Supabase gespeichert');
                        return;
                    }
                }
            } catch (error) {
                console.warn('Konnte Inventar-Einstellungen nicht in Supabase speichern:', error.message);
            }
            
            // Fallback: Nur lokal speichern
            localStorage.setItem('firewoodflow_inventory_settings', JSON.stringify(this.inventorySettings));
            console.log('✓ Inventar-Einstellungen lokal gespeichert');
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

        addProductType() {
            const newType = prompt('Neue Produktart eingeben:', '');
            if (newType && newType.trim()) {
                const trimmed = newType.trim();
                if (!this.inventorySettings.productTypes.includes(trimmed)) {
                    this.inventorySettings.productTypes.push(trimmed);
                    this.saveInventorySettings();
                    alert('✓ Produktart "' + trimmed + '" hinzugefügt!');
                } else {
                    alert('Diese Produktart existiert bereits.');
                }
            }
        },

        removeProductType(productType) {
            this.inventorySettings.productTypes = this.inventorySettings.productTypes.filter(t => t !== productType);
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
                // storageLocations werden jetzt in Supabase gespeichert!
                costPerKm: this.costPerKm,
                roundingMode: this.roundingMode,
                whatsappConfirmationTemplate: this.whatsappConfirmationTemplate,
                googleCalendarConnected: this.googleCalendarConnected,
                googleCalendarId: this.googleCalendarId
            };
            localStorage.setItem('firewoodflow_company', JSON.stringify(data));
            
            // Auch in Supabase speichern
            this.saveCompanySettingsToSupabase();
        },

        // Storage Location Methods
        async loadStorageLocations() {
            // Zuerst aus Supabase laden (wenn verfügbar)
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    const { data, error } = await supabaseClient
                        .from('storage_locations')
                        .select('*')
                        .order('sort_order', { ascending: true });
                    
                    if (!error && data) {
                        this.storageLocations = data;
                        console.log('✓ Lagerplätze aus Supabase geladen:', this.storageLocations.length);
                        return;
                    }
                }
            } catch (error) {
                console.warn('Konnte Lagerplätze nicht aus Supabase laden:', error.message);
            }
            
            // Fallback: Aus localStorage laden
            const saved = localStorage.getItem('firewoodflow_company_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.storageLocations = settings.storageLocations || [];
                console.log('✓ Lagerplätze aus localStorage geladen:', this.storageLocations.length);
            }
        },

        async addStorageLocation() {
            const name = prompt('Name für den Lagerplatz (z.B. "Hauptlager", "Außenlager Nord"):', 'Lager ' + (this.storageLocations.length + 1));
            if (!name || !name.trim()) return;
            
            const address = prompt('Adresse oder GPS-Koordinaten des Lagerplatzes:', '');
            
            const newLocation = {
                name: name.trim(),
                address: address ? address.trim() : '',
                sort_order: this.storageLocations.length
            };
            
            // In Supabase speichern (wenn verfügbar)
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    const { data, error } = await supabaseClient
                        .from('storage_locations')
                        .insert({
                            user_id: user.id,
                            name: newLocation.name,
                            address: newLocation.address,
                            sort_order: newLocation.sort_order
                        })
                        .select()
                        .single();
                    
                    if (!error && data) {
                        this.storageLocations.push(data);
                        console.log('✓ Lagerplatz in Supabase gespeichert');
                        alert('✓ Lagerplatz "' + name.trim() + '" hinzugefügt!');
                        return;
                    }
                }
            } catch (error) {
                console.warn('Konnte Lagerplatz nicht in Supabase speichern:', error.message);
            }
            
            // Fallback: Nur lokal speichern
            this.storageLocations.push(newLocation);
            this.saveCompanySettings();
            alert('✓ Lagerplatz "' + name.trim() + '" hinzugefügt! (nur lokal)');
        },

        async editStorageLocation(index) {
            const loc = this.storageLocations[index];
            if (!loc) return;
            
            const newName = prompt('Name bearbeiten:', loc.name);
            if (!newName || !newName.trim()) return;
            
            const newAddress = prompt('Adresse/GPS bearbeiten:', loc.address || '');
            
            const updatedData = {
                name: newName.trim(),
                address: newAddress ? newAddress.trim() : ''
            };
            
            // In Supabase aktualisieren (wenn verfügbar)
            if (loc.id) {
                try {
                    const { error } = await supabaseClient
                        .from('storage_locations')
                        .update(updatedData)
                        .eq('id', loc.id);
                    
                    if (!error) {
                        Object.assign(loc, updatedData);
                        console.log('✓ Lagerplatz in Supabase aktualisiert');
                        alert('✓ Lagerplatz aktualisiert!');
                        return;
                    }
                } catch (error) {
                    console.warn('Konnte Lagerplatz nicht in Supabase aktualisieren:', error.message);
                }
            }
            
            // Fallback: Nur lokal aktualisieren
            loc.name = updatedData.name;
            loc.address = updatedData.address;
            this.saveCompanySettings();
            alert('✓ Lagerplatz aktualisiert! (nur lokal)');
        },

        async removeStorageLocation(index) {
            const loc = this.storageLocations[index];
            if (!loc) return;
            
            if (!confirm('Möchtest du den Lagerplatz "' + loc.name + '" wirklich löschen?')) return;
            
            // Aus Supabase löschen (wenn verfügbar)
            if (loc.id) {
                try {
                    const { error } = await supabaseClient
                        .from('storage_locations')
                        .delete()
                        .eq('id', loc.id);
                    
                    if (!error) {
                        this.storageLocations.splice(index, 1);
                        console.log('✓ Lagerplatz aus Supabase gelöscht');
                        alert('✓ Lagerplatz gelöscht.');
                        return;
                    }
                } catch (error) {
                    console.warn('Konnte Lagerplatz nicht aus Supabase löschen:', error.message);
                }
            }
            
            // Fallback: Nur lokal löschen
            this.storageLocations.splice(index, 1);
            this.saveCompanySettings();
            alert('✓ Lagerplatz gelöscht. (nur lokal)');
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
                if (srm === undefined || srm === null || srm === '') {
                    return '';
                }
                return String(srm);
            } else if (unit === 'RM') {
                const rm = lengthPrices.rm;
                if (rm !== undefined && rm !== null && rm !== '') {
                    return String(rm);
                }
                
                const srm = lengthPrices.srm;
                if (srm !== undefined && srm !== null && srm !== '' && !isNaN(parseFloat(srm))) {
                    const srmNum = parseFloat(srm);
                    if (srmNum > 0) {
                        const calculated = (srmNum * 1.42).toFixed(2);
                        return calculated;
                    }
                }
                return '';
            }
            return '';
        },

        // Initialisiere priceLengths Struktur beim ersten Öffnen
        initPriceLengths() {
            if (!this.newProduct.priceLengths) {
                this.newProduct.priceLengths = {};
            }
            this.inventorySettings.logLengths.forEach(length => {
                if (!this.newProduct.priceLengths[length]) {
                    this.newProduct.priceLengths[length] = { srm: '', rm: '' };
                }
            });
        },

        // Modal öffnen und priceLengths initialisieren
        openAddProductModal() {
            this.newProduct.priceLengths = {};
            this.inventorySettings.logLengths.forEach(length => {
                this.newProduct.priceLengths[length] = { srm: '', rm: '' };
            });
            this.showAddProduct = true;
        },

        // Wird aufgerufen wenn SRM-Preis geändert wird (beim neuen Produkt)
        onSRMPriceChange(length, value) {
            // Sicherstellen dass die Struktur existiert
            if (!this.newProduct.priceLengths[length]) {
                this.newProduct.priceLengths[length] = { srm: '', rm: '' };
            }
            
            // SRM speichern
            this.newProduct.priceLengths[length].srm = value;
            
            // RM automatisch berechnen
            if (value && value !== '' && !isNaN(parseFloat(value))) {
                const calculatedRM = (parseFloat(value) * 1.42).toFixed(2);
                this.newProduct.priceLengths[length].rm = calculatedRM;
            } else {
                this.newProduct.priceLengths[length].rm = '';
            }
            
            // Vue 3 reactivity trigger
            this.newProduct = { ...this.newProduct, priceLengths: { ...this.newProduct.priceLengths } };
        },

        // Wird aufgerufen wenn Preis beim Bearbeiten geändert wird
        onEditProductPriceChange(length, unit) {
            // Sicherstellen dass die Struktur existiert
            if (!this.editingProduct.priceLengths) {
                this.editingProduct.priceLengths = {};
            }
            if (!this.editingProduct.priceLengths[length]) {
                this.editingProduct.priceLengths[length] = { srm: '', rm: '' };
            }
            
            // Bei SRM-Änderung RM automatisch berechnen
            if (unit === 'SRM') {
                const srmValue = this.editingProduct.priceLengths[length].srm;
                
                if (srmValue && srmValue !== '' && !isNaN(parseFloat(srmValue))) {
                    const calculatedRM = (parseFloat(srmValue) * 1.42).toFixed(2);
                    this.editingProduct.priceLengths[length].rm = calculatedRM;
                } else {
                    this.editingProduct.priceLengths[length].rm = '';
                }
            }
            
            // Vue 3 reactivity trigger
            this.editingProduct = { ...this.editingProduct, priceLengths: { ...this.editingProduct.priceLengths } };
        },

        async loadData() {
            // Zuerst versuchen, Daten von Supabase zu laden
            await this.loadFromSupabase();
            
            // Falls keine Daten in Supabase, localStorage verwenden (Offline-Support)
            if (this.products.length === 0) {
                const savedProducts = localStorage.getItem('firewoodflow_products');
                if (savedProducts) {
                    this.products = JSON.parse(savedProducts);
                }
            }
            this.inventoryCount = this.products.length;
            this.totalValue = this.calculateTotalValue();
            
            if (this.customers.length === 0) {
                const savedCustomers = localStorage.getItem('firewoodflow_customers');
                if (savedCustomers) {
                    this.customers = JSON.parse(savedCustomers);
                }
            }
            this.customerCount = this.customers.length;
            
            if (this.orders.length === 0) {
                const savedOrders = localStorage.getItem('firewoodflow_orders');
                if (savedOrders) {
                    this.orders = JSON.parse(savedOrders);
                }
            }
            this.ordersCount = this.orders.length;
            
            // Expenses laden
            const savedExpenses = localStorage.getItem('firewoodflow_expenses');
            if (savedExpenses) {
                this.expenses = JSON.parse(savedExpenses);
            }
            
            // Rückwirkend Wareneinkäufe für bestehende Produkte erstellen
            await this.createMissingInventoryExpenses();
            
            // Bestehtehende Wareneinkäufe mit Lagerorten reparieren
            await this.repairInventoryExpenseStorageLocations();
            
            // Heute Bestellungen berechnen (Array mit allen Aufträgen heute)
            const today = new Date().toISOString().split('T')[0];
            this.todayOrders = this.orders.filter(o => {
                const status = o.status || '';
                return o.deliveryDate === today && status !== 'erledigt' && status !== 'storniert';
            }).sort((a, b) => {
                const timeA = a.deliveryTime || '00:00';
                const timeB = b.deliveryTime || '00:00';
                return timeA.localeCompare(timeB);
            });
        },

        calculateTotalValue() {
            // Berechnet den Gesamtwert des Lagers basierend auf Einkaufspreisen
            return this.products.reduce((sum, p) => {
                const price = parseFloat(p.price) || 0;
                const quantity = parseFloat(p.quantity) || 0;
                return sum + (price * quantity);
            }, 0);
        },

        async loadFromSupabase() {
            try {
                console.log('=== Lade Daten von Supabase ===');
                
                // Produkte laden
                const { data: productsData, error: productsError } = await supabaseClient
                    .from('products')
                    .select('*')
                    .order('name');
                
                if (productsError) {
                    console.warn('Produkte konnten nicht geladen werden:', productsError.message);
                } else {
                    // snake_case zu camelCase konvertieren für Vue Templates
                    this.products = (productsData || []).map(product => ({
                        ...product,
                        woodType: product.wood_type,
                        logLength: product.log_length,
                        priceLengths: product.price_lengths || {},
                        priceUnit: product.price_unit,
                        storageLocationIndex: product.storage_location_index !== undefined ? product.storage_location_index : null,
                        purchaseDate: product.purchase_date || new Date().toISOString().split('T')[0]
                    }));
                    console.log('✓ Produkte geladen:', this.products.length);
                }
                
                // Kunden laden
                const { data: customersData, error: customersError } = await supabaseClient
                    .from('customers')
                    .select('*')
                    .order('name');
                
                if (customersError) {
                    console.warn('Kunden konnten nicht geladen werden:', customersError.message);
                } else {
                    this.customers = customersData || [];
                    console.log('✓ Kunden geladen:', this.customers.length);
                }
                
                // Bestellungen laden
                const { data: ordersData, error: ordersError } = await supabaseClient
                    .from('orders')
                    .select('*')
                    .order('delivery_date, delivery_time');
                
                if (ordersError) {
                    console.warn('Bestellungen konnten nicht geladen werden:', ordersError.message);
                } else {
                    // snake_case zu camelCase konvertieren für Vue Templates
                    this.orders = (ordersData || []).map(order => ({
                        ...order,
                        customerId: order.customer_id,
                        customerName: order.customer_name,
                        customerAddress: order.customer_address,
                        deliveryAddress: order.delivery_address,
                        deliveryCosts: order.delivery_costs,
                        paymentMethod: order.payment_method,
                        paymentStatus: order.payment_status,
                        deliveryDate: order.delivery_date,
                        deliveryTime: order.delivery_time
                    }));
                    console.log('✓ Bestellungen geladen:', this.orders.length);
                }
                
                // Ausgaben laden (neu)
                const { data: expensesData, error: expensesError } = await supabaseClient
                    .from('expenses')
                    .select('*')
                    .order('date DESC');
                
                if (expensesError) {
                    console.warn('Ausgaben konnten nicht geladen werden:', expensesError.message);
                } else {
                    // snake_case zu camelCase konvertieren
                    this.expenses = (expensesData || []).map(expense => ({
                        ...expense,
                        userId: expense.user_id
                    }));
                    console.log('✓ Ausgaben geladen:', this.expenses.length);
                }
                
                // Firmeneinstellungen laden (optional, nur wenn Supabase verfügbar)
                // Wenn company_settings Tabelle nicht existiert, verwende Standardwerte
                // Hinweis: Fehler wird bewusst nicht geloggt um Console sauber zu halten
                const { data: settingsData, error: settingsError } = await supabaseClient
                    .from('company_settings')
                    .select('*')
                    .single()
                    .then(res => res)
                    .catch(() => ({ data: null, error: null })); // Fehler schlucken
                
                if (settingsData) {
                    this.companyName = settingsData.company_name || 'FireWoodFlow';
                    this.companyLogo = settingsData.company_logo || null;
                    this.companyAddress = settingsData.company_address || '';
                    this.storageLocation = settingsData.storage_location || '';
                    this.costPerKm = parseFloat(settingsData.cost_per_km) || 0;
                    this.roundingMode = settingsData.rounding_mode || 'exact';
                    
                    if (settingsData.inventory_settings) {
                        this.inventorySettings = {
                            woodTypes: settingsData.inventory_settings.woodTypes || this.inventorySettings.woodTypes,
                            drynessLevels: settingsData.inventory_settings.drynessLevels || this.inventorySettings.drynessLevels,
                            logLengths: settingsData.inventory_settings.logLengths || this.inventorySettings.logLengths
                        };
                    }
                    console.log('✓ Firmeneinstellungen geladen');
                }
                
            } catch (error) {
                console.error('Fehler beim Laden von Supabase:', error);
            }
        },

        async saveToSupabase(table, data, userId) {
            try {
                const record = { ...data, user_id: userId, updated_at: new Date().toISOString() };
                
                if (data.id) {
                    // Update existing record
                    const { error } = await supabaseClient
                        .from(table)
                        .update(record)
                        .eq('id', data.id)
                        .eq('user_id', userId);
                    
                    if (error) throw error;
                } else {
                    // Insert new record
                    record.id = crypto.randomUUID();
                    record.created_at = new Date().toISOString();
                    
                    const { error } = await supabaseClient
                        .from(table)
                        .insert([record]);
                    
                    if (error) throw error;
                    
                    return record.id;
                }
                
                return true;
            } catch (error) {
                console.error('Fehler beim Speichern in Supabase:', error);
                throw error;
            }
        },

        // Spezielle Funktion um nur den Status einer Bestellung zu aktualisieren (mit status_updated_at Tracking)
        async updateOrderStatusInSupabase(orderId, newStatus, userId) {
            try {
                const { error } = await supabaseClient
                    .from('orders')
                    .update({ 
                        status: newStatus,
                        status_updated_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', orderId)
                    .eq('user_id', userId);
                
                if (error) throw error;
                
                return true;
            } catch (error) {
                console.error('Fehler beim Aktualisieren des Bestellstatus:', error);
                throw error;
            }
        },

        async deleteFromSupabase(table, id, userId) {
            try {
                const { error } = await supabaseClient
                    .from(table)
                    .delete()
                    .eq('id', id)
                    .eq('user_id', userId);
                
                if (error) throw error;
                
                return true;
            } catch (error) {
                console.error('Fehler beim Löschen aus Supabase:', error);
                throw error;
            }
        },

        async saveCompanySettingsToSupabase() {
            try {
                const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                if (userError || !user) return;
                
                const settings = {
                    company_name: this.companyName,
                    company_logo: this.companyLogo,
                    company_address: this.companyAddress,
                    storage_location: this.storageLocation,
                    cost_per_km: this.costPerKm,
                    rounding_mode: this.roundingMode,
                    inventory_settings: this.inventorySettings
                };
                
                // Prüfen ob bereits Einstellungen existieren
                try {
                    const { data: existing } = await supabaseClient
                        .from('company_settings')
                        .select('id')
                        .eq('user_id', user.id)
                        .single();
                    
                    if (existing) {
                        // Update
                        await supabaseClient
                            .from('company_settings')
                            .update({ ...settings, updated_at: new Date().toISOString() })
                            .eq('id', existing.id);
                    } else {
                        // Insert
                        await supabaseClient
                            .from('company_settings')
                            .insert([{
                                id: crypto.randomUUID(),
                                user_id: user.id,
                                ...settings,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);
                    }
                    
                    console.log('✓ Firmeneinstellungen in Supabase gespeichert');
                } catch (e) {
                    console.log('⚠ company_settings Tabelle nicht verfügbar, speichere nur lokal');
                }
            } catch (error) {
                console.error('Fehler beim Speichern der Einstellungen:', error);
            }
        },

        formatCurrency(value) {
            return new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR'
            }).format(value);
        },

        getStorageLocationName(index) {
            // Gibt den Lagerort-Namen mit eckigen Klammern zurück, z.B. "[Lager Nord] "
            if (index === undefined || index === null || !this.storageLocations[index]) {
                return '';
            }
            const location = this.storageLocations[index];
            const name = location.name || `Lager ${index + 1}`;
            return `[${name}] `;
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        },

        formatDateGerman(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Heute oder morgen?
            if (date.toDateString() === today.toDateString()) {
                return 'Heute';
            } else if (date.toDateString() === tomorrow.toDateString()) {
                return 'Morgen';
            }

            // Sonst deutsches Datum
            return date.toLocaleDateString('de-DE', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit'
            });
        },

        formatTime(timeString) {
            if (!timeString) return '';
            return timeString;
        },

        formatDateForCalendar(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('de-DE', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        },

        openInCalendar(mode) {
            // Google Calendar URL öffnen - funktioniert für neue und bearbeitete Bestellungen
            const order = this.showEditOrder ? this.editingOrder : this.newOrder;
            
            if (!order.deliveryDate) {
                alert('Bitte wähle zuerst ein Lieferdatum.');
                return;
            }

            // Basis-Parameter für Google Calendar
            const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
            
            // Titel der Veranstaltung
            let title = encodeURIComponent('🚚 Lieferung - FireWoodFlow');
            if (order.customerName || (this.customers && this.customers.find(c => c.id === order.customerId))) {
                const customerName = order.customerName || this.customers.find(c => c.id === order.customerId).name;
                title = encodeURIComponent(`🚚 Lieferung an ${customerName}`);
            }

            // Datum formatieren (YYYYMMDD oder YYYYMMDDTHHMMSSZ)
            const datePart = order.deliveryDate.replace(/-/g, '');
            
            let datesParam;
            if (order.deliveryTime) {
                // Mit Uhrzeit: 1 Stunde Dauer
                const startDateTime = `${datePart}T${order.deliveryTime.replace(':', '')}00`;
                // Endzeit = Start + 1 Stunde
                const [hours, mins] = order.deliveryTime.split(':');
                const endHours = String(Math.min(parseInt(hours) + 1, 23)).padStart(2, '0');
                const endDateTime = `${datePart}T${endHours}${mins}00`;
                datesParam = `dates=${startDateTime}/${endDateTime}`;
            } else {
                // Ganztägig
                datesParam = `dates=${datePart}/${datePart}`;
            }

            // Beschreibung mit Bestelldetails
            let description = encodeURIComponent('FireWoodFlow Bestellung\n');
            if (order.customerName || (this.customers && this.customers.find(c => c.id === order.customerId))) {
                const customerName = order.customerName || this.customers.find(c => c.id === order.customerId).name;
                description += encodeURIComponent(`Kunde: ${customerName}\n`);
            }
            if (order.deliveryAddress) {
                description += encodeURIComponent(`Lieferadresse: ${order.deliveryAddress}\n`);
            }
            if (order.items && order.items.length > 0) {
                description += encodeURIComponent('\nBestellung:\n');
                for (const item of order.items) {
                    description += encodeURIComponent(`${item.quantity} ${item.unit} ${item.productName} (${item.logLength}cm)\n`);
                }
            }
            if (order.total) {
                description += encodeURIComponent(`\nGesamtsumme: €${order.total.toFixed(2)}`);
            }

            // Standort (Lieferadresse)
            let location = '';
            if (order.deliveryAddress) {
                location = `&location=${encodeURIComponent(order.deliveryAddress)}`;
            }

            // URL zusammenbauen
            let calendarUrl = `${baseUrl}&text=${title}&${datesParam}&details=${description}${location}`;

            // In neuem Tab öffnen
            window.open(calendarUrl, '_blank');
        },

        // iCal/ICS Export - Funktioniert immer, keine OAuth nötig
        exportOrderAsIcs() {
            const order = this.showEditOrder ? this.editingOrder : this.newOrder;
            
            if (!order.deliveryDate) {
                alert('Bitte wähle zuerst ein Lieferdatum.');
                return;
            }

            // Kundenname ermitteln
            let customerName = order.customerName || 'Unbekannt';
            if (!order.customerName && order.customerId && this.customers) {
                const customer = this.customers.find(c => c.id === order.customerId);
                if (customer) customerName = customer.name;
            }

            // iCal Dateiinhalt erstellen
            const uid = `firewoodflow-order-${order.id || Date.now()}@firewoodflow`;
            const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            // Startzeit berechnen
            let dtStart, dtEnd;
            if (order.deliveryTime) {
                // Mit Uhrzeit: 1 Stunde Dauer
                const [hours, mins] = order.deliveryTime.split(':');
                const startDate = order.deliveryDate.replace(/-/g, '');
                dtStart = `${startDate}T${hours}${mins}00`;
                
                const endHours = String(Math.min(parseInt(hours) + 1, 23)).padStart(2, '0');
                dtEnd = `${startDate}T${endHours}${mins}00`;
            } else {
                // Ganztägig
                const startDate = order.deliveryDate.replace(/-/g, '');
                dtStart = startDate;
                dtEnd = startDate;
            }

            // Beschreibung zusammenbauen
            let description = 'FireWoodFlow Bestellung\\n';
            description += `Kunde: ${customerName}\\n`;
            if (order.deliveryAddress) {
                description += `Lieferadresse: ${order.deliveryAddress}\\n`;
            }
            if (order.items && order.items.length > 0) {
                description += '\\nBestellung:\\n';
                for (const item of order.items) {
                    description += `${item.quantity} ${item.unit} ${item.productName} (${item.logLength}cm)\\n`;
                }
            }
            if (order.total) {
                description += `\\nGesamtsumme: €${order.total.toFixed(2)}`;
            }

            // LOCATION für Google Maps
            let location = '';
            if (order.deliveryAddress) {
                location = `LOCATION:${order.deliveryAddress}\\n`;
            }

            // iCal Content
            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//FireWoodFlow//Delivery Calendar//DE',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:FireWoodFlow Lieferungen',
                'X-WR-TIMEZONE:Europe/Berlin',
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${now}`,
                `DTSTART:${dtStart}`,
                `DTEND:${dtEnd}`,
                `SUMMARY:🚚 Lieferung an ${customerName}`,
                location,
                `DESCRIPTION:${description}`,
                'URL:https://firewoodflow.de',
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\\r\\n');

            // Datei herunterladen
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Dateiname generieren
            const dateStr = order.deliveryDate.replace(/-/g, '_');
            link.setAttribute('download', `firewoodflow-lieferung-${dateStr}.ics`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
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

                // Speichere beim Kunden: Lieferkosten + tatsächliche Distanz
                const index = this.customers.findIndex(c => c.id === this.selectedCustomer.id);
                if (index !== -1) {
                    const updatedCustomers = [...this.customers];
                    updatedCustomers[index].deliveryCosts = calculatedCost;
                    updatedCustomers[index].actualDistanceKm = this.distanceResult.distance;
                    updatedCustomers[index].distanceCalculatedAt = new Date().toISOString();
                    this.customers = updatedCustomers;
                    
                    console.log('Lieferkosten gespeichert:', calculatedCost, 'für', this.selectedCustomer.name);
                    console.log('Distanz gespeichert:', this.distanceResult.distance.toFixed(1), 'km');
                    alert(`✓ Lieferkosten gespeichert: ${this.formatCurrency(calculatedCost)} (${this.distanceResult.distance.toFixed(1)} km)`);
                    
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
                    name: this.newProduct.name.trim(),
                    product_type: this.newProduct.productType || 'Brennholz',
                    quantity: parseFloat(this.newProduct.quantity) || 0,
                    unit: this.newProduct.unit,
                    wood_type: this.newProduct.woodType,
                    log_length: parseInt(this.newProduct.logLength) || 25,
                    dryness: this.newProduct.dryness,
                    price: parseFloat(this.newProduct.price) || 0,
                    price_lengths: this.newProduct.priceLengths || {},
                    storage_location_index: this.newProduct.storageLocationIndex !== undefined ? this.newProduct.storageLocationIndex : null,
                    purchase_date: this.newProduct.purchaseDate || new Date().toISOString().split('T')[0],
                    notes: (this.newProduct.notes || '').trim()
                };
                
                console.log('Erstelle Produkt:', product);
                
                // In Supabase speichern
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    console.log('User eingeloggt, speichere in Supabase...');
                    console.log('Produkt-Daten vor saveToSupabase:', product);
                    console.log('User ID:', user.id);
                    
                    try {
                        const productId = await this.saveToSupabase('products', product, user.id);
                        product.id = productId;
                        product.user_id = user.id;
                        product.created_at = new Date().toISOString();
                        product.updated_at = product.created_at;
                        this.products.push(product);
                        console.log('✓ Produkt in Supabase gespeichert');
                        
                        // Automatisch Ausgabe für Wareneinkauf erstellen
                        await this.createInventoryExpense(product, user.id);
                    } catch (saveError) {
                        console.error('Speichern in Supabase fehlgeschlagen:', saveError);
                        console.error('Fehlerdetails:', JSON.stringify(saveError, null, 2));
                        throw saveError;
                    }
                } else {
                    // Fallback: localStorage
                    product.id = Date.now().toString();
                    product.createdAt = new Date().toISOString();
                    this.products.push(product);
                    
                    // Auch in localStorage Ausgabe erstellen
                    this.createInventoryExpenseLocal(product);
                }
                
                this.inventoryCount = this.products.length;
                this.totalValue = this.calculateTotalValue();
                
                // Auch in localStorage speichern (für Offline-Support)
                this.saveProducts();
                
                // Formular zurücksetzen
                this.showAddProduct = false;
                this.newProduct = {
                    name: '',
                    productType: 'Brennholz',
                    quantity: 0,
                    unit: 'RM',
                    woodType: '',
                    logLength: 25,
                    dryness: 'lufttrocken',
                    price: 0,
                    priceLengths: {},
                    storageLocationIndex: '',
                    purchaseDate: new Date().toISOString().split('T')[0],
                    notes: ''
                };
                
                alert('✓ Produkt erfolgreich gespeichert!');
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                console.error('Error details:', error.message, error.details, error.hint);
                alert('❌ Fehler beim Speichern des Produkts: ' + error.message + (error.details ? '\n' + JSON.stringify(error.details) : ''));
            }
        },

        editProduct(product) {
            // Produkt zum Bearbeiten laden
            this.editingProduct = { 
                ...product,
                productType: product.product_type || 'Brennholz',
                woodType: product.wood_type,
                logLength: product.log_length,
                priceLengths: product.price_lengths || {}
            };
            
            // priceLengths für alle Scheitlängen initialisieren
            if (!this.editingProduct.priceLengths) {
                this.editingProduct.priceLengths = {};
            }
            this.inventorySettings.logLengths.forEach(length => {
                if (!this.editingProduct.priceLengths[length]) {
                    this.editingProduct.priceLengths[length] = { srm: '', rm: '' };
                } else {
                    // Ensure both srm and rm exist
                    if (this.editingProduct.priceLengths[length].srm === undefined) {
                        this.editingProduct.priceLengths[length].srm = '';
                    }
                    if (this.editingProduct.priceLengths[length].rm === undefined) {
                        this.editingProduct.priceLengths[length].rm = '';
                    }
                }
            });
            
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
                // Aktualisiertes Produkt vorbereiten
                const updatedProductData = {
                    name: this.editingProduct.name.trim(),
                    product_type: this.editingProduct.productType || 'Brennholz',
                    quantity: parseFloat(this.editingProduct.quantity) || 0,
                    unit: this.editingProduct.unit,
                    wood_type: this.editingProduct.woodType,
                    log_length: parseInt(this.editingProduct.logLength) || 25,
                    dryness: this.editingProduct.dryness,
                    price: parseFloat(this.editingProduct.price) || 0,
                    price_lengths: this.editingProduct.priceLengths || {},
                    storage_location_index: this.editingProduct.storageLocationIndex !== undefined ? this.editingProduct.storageLocationIndex : null,
                    purchase_date: this.editingProduct.purchaseDate || this.editingProduct.purchase_date || new Date().toISOString().split('T')[0],
                    notes: (this.editingProduct.notes || '').trim()
                };

                    // In Supabase speichern wenn User eingeloggt ist
                    const { data: { user } } = await supabaseClient.auth.getUser();
                    if (user && this.editingProduct.id && !this.editingProduct.id.includes('.')) {
                        // Echte UUID = Supabase Produkt
                        await this.saveToSupabase('products', { id: this.editingProduct.id, ...updatedProductData }, user.id);
                        console.log('✓ Produkt in Supabase aktualisiert');
                    }
                    
                    // Lokal aktualisieren
                    const updatedProduct = {
                        ...this.products[index],
                        ...updatedProductData,
                        updatedAt: new Date().toISOString()
                    };

                    // Array kopieren um Reaktivität sicherzustellen
                    const updatedProducts = [...this.products];
                    updatedProducts[index] = updatedProduct;
                    this.products = updatedProducts;
                    
                    // Stats aktualisieren
                    this.inventoryCount = this.products.length;
                    this.totalValue = this.calculateTotalValue();

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

        async deleteProduct(product) {
            if (confirm('Möchtest du "' + product.name + '" wirklich löschen?')) {
                // Aus Supabase löschen wenn möglich
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user && product.id && !product.id.includes('.')) {
                    try {
                        await this.deleteFromSupabase('products', product.id, user.id);
                        console.log('✓ Produkt aus Supabase gelöscht');
                    } catch (error) {
                        console.error('Fehler beim Löschen aus Supabase:', error);
                    }
                }
                
                // Lokal löschen
                this.products = this.products.filter(p => p.id !== product.id);
                this.inventoryCount = this.products.length;
                this.totalValue = this.calculateTotalValue();
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
                    name: this.newCustomer.name.trim(),
                    address: (this.newCustomer.address || '').trim(),
                    phone: (this.newCustomer.phone || '').trim(),
                    email: (this.newCustomer.email || '').trim(),
                    notes: (this.newCustomer.notes || '').trim(),
                    preferred_storage_location_index: this.newCustomer.preferredStorageLocationIndex !== '' ? parseInt(this.newCustomer.preferredStorageLocationIndex) : null
                };

                console.log('Erstelle Kunde:', customer);
                
                // In Supabase speichern
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    const customerId = await this.saveToSupabase('customers', customer, user.id);
                    customer.id = customerId;
                    customer.user_id = user.id;
                    customer.created_at = new Date().toISOString();
                    customer.updated_at = customer.created_at;
                    customer.deliveryCosts = 0;
                    this.customers.push(customer);
                    console.log('✓ Kunde in Supabase gespeichert');
                } else {
                    // Fallback: localStorage
                    customer.id = Date.now().toString();
                    customer.createdAt = new Date().toISOString();
                    customer.deliveryCosts = 0;
                    this.customers.push(customer);
                }
                
                this.customerCount = this.customers.length;
                
                // Auch in localStorage speichern (für Offline-Support)
                this.saveCustomers();

                // Formular zurücksetzen
                this.newCustomer = {
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    notes: '',
                    deliveryCosts: 0,
                    preferredStorageLocationIndex: ''
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

        // Neuer Kunde aus Bestellung heraus anlegen
        async addCustomerFromOrder() {
            console.log('=== addCustomerFromOrder aufgerufen ===');
            
            try {
                // Validierung
                if (!this.newCustomer.name || !this.newCustomer.name.trim()) {
                    alert('Bitte geben Sie einen Namen ein.');
                    return;
                }
                if (!this.newCustomer.address || !this.newCustomer.address.trim()) {
                    alert('Bitte geben Sie eine Adresse ein.');
                    return;
                }

                const customer = {
                    name: this.newCustomer.name.trim(),
                    address: (this.newCustomer.address || '').trim(),
                    phone: (this.newCustomer.phone || '').trim(),
                    email: (this.newCustomer.email || '').trim(),
                    notes: (this.newCustomer.notes || '').trim(),
                    deliveryCosts: this.newCustomer.deliveryCosts || 0,
                    preferred_storage_location_index: this.newCustomer.preferredStorageLocationIndex !== '' ? parseInt(this.newCustomer.preferredStorageLocationIndex) : null
                };

                console.log('Erstelle Kunde für Bestellung:', customer);
                
                // In Supabase speichern
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    const customerId = await this.saveToSupabase('customers', customer, user.id);
                    customer.id = customerId;
                    customer.user_id = user.id;
                    customer.created_at = new Date().toISOString();
                    customer.updated_at = customer.created_at;
                    this.customers.push(customer);
                    console.log('✓ Kunde in Supabase gespeichert');
                } else {
                    // Fallback: localStorage
                    customer.id = Date.now().toString();
                    customer.createdAt = new Date().toISOString();
                    this.customers.push(customer);
                }
                
                this.customerCount = this.customers.length;
                
                // Auch in localStorage speichern
                this.saveCustomers();

                // Kunde automatisch für die Bestellung auswählen
                this.newOrder.customerId = customer.id;
                this.selectCustomerForOrder(customer);

                // Formular zurücksetzen
                this.newCustomer = {
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    notes: '',
                    deliveryCosts: 0,
                    preferredStorageLocationIndex: ''
                };

                // Modal schließen
                this.showAddCustomerFromOrder = false;
                
                alert('✓ Kunde erstellt und für Bestellung ausgewählt!');
                
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                console.error('Error Stack:', error.stack);
                alert('❌ Fehler beim Speichern des Kunden: ' + error.message);
            }
        },

        closeAddCustomerFromOrder() {
            // Formular zurücksetzen ohne zu speichern
            this.newCustomer = {
                name: '',
                address: '',
                phone: '',
                email: '',
                notes: '',
                deliveryCosts: 0,
                preferredStorageLocationIndex: ''
            };
            this.showAddCustomerFromOrder = false;
        },

        editCustomer(customer) {
            // Kunde zum Bearbeiten laden
            this.editingCustomer = { 
                ...customer,
                preferredStorageLocationIndex: customer.preferred_storage_location_index !== undefined && customer.preferred_storage_location_index !== null ? customer.preferred_storage_location_index : ''
            };
            this.showEditCustomer = true;
        },

        showCustomerDetails(customer) {
            // Kunden-Detailansicht öffnen
            this.selectedCustomer = customer;
            this.customerOrdersFilter = 'all';
            this.showCustomerDetailsModal = true;
        },

        getStatusLabel(status) {
            const labels = {
                neu: '🆕 Neu',
                bestaetigt: '✓ Bestätigt',
                in_lieferung: '🚚 In Lieferung',
                abgeschlossen: '✅ Abgeschlossen',
                storniert: '❌ Storniert'
            };
            return labels[status] || status;
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
                    // Aktualisierten Kunden vorbereiten
                    const updatedCustomerData = {
                        name: this.editingCustomer.name.trim(),
                        address: (this.editingCustomer.address || '').trim(),
                        phone: (this.editingCustomer.phone || '').trim(),
                        email: (this.editingCustomer.email || '').trim(),
                        notes: (this.editingCustomer.notes || '').trim(),
                        delivery_costs: this.editingCustomer.deliveryCosts || 0,
                        preferred_storage_location_index: this.editingCustomer.preferredStorageLocationIndex !== '' && this.editingCustomer.preferredStorageLocationIndex !== undefined ? parseInt(this.editingCustomer.preferredStorageLocationIndex) : null
                    };

                    // In Supabase speichern wenn User eingeloggt ist
                    const { data: { user } } = await supabaseClient.auth.getUser();
                    if (user && this.editingCustomer.id && !this.editingCustomer.id.includes('.')) {
                        // Echte UUID = Supabase Kunde
                        await this.saveToSupabase('customers', { id: this.editingCustomer.id, ...updatedCustomerData }, user.id);
                        console.log('✓ Kunde in Supabase aktualisiert');
                    }
                    
                    // Lokal aktualisieren
                    const updatedCustomer = {
                        ...this.customers[index],
                        ...updatedCustomerData,
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

        async deleteCustomer(customer) {
            if (confirm('Möchtest du "' + customer.name + '" wirklich löschen?')) {
                // Aus Supabase löschen wenn möglich
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user && customer.id && !customer.id.includes('.')) {
                    try {
                        await this.deleteFromSupabase('customers', customer.id, user.id);
                        console.log('✓ Kunde aus Supabase gelöscht');
                    } catch (error) {
                        console.error('Fehler beim Löschen aus Supabase:', error);
                    }
                }
                
                // Lokal löschen
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
            // Menge, Einheit und Scheitlänge aus den reaktiven Werten lesen
            const quantity = isEditing ? this.editOrderItemQuantity : this.newOrderItemQuantity;
            const orderUnit = isEditing ? this.editOrderItemUnit : this.newOrderItemUnit;
            const logLength = isEditing ? this.editOrderItemLogLength : this.newOrderItemLogLength;
            
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
            
            if (!logLength) {
                alert('Bitte wähle eine Scheitlänge.');
                return;
            }
            
            const product = this.products.find(p => p.id === selectInput.value);
            
            if (!product) {
                alert('Produkt nicht gefunden.');
                return;
            }
            
            // Umrechnungsfaktoren (in RM als Basis)
            const toRM = {
                'FM': 1.42,
                'RM': 1,
                'SRM': 1 / 1.42
            };
            
            // Bestellmenge in Produkteinheit umrechnen für Lagerbestandsprüfung
            const quantityInProductUnit = quantity * toRM[orderUnit] / toRM[product.unit];
            
            // Lagerbestand prüfen
            if (product.quantity < quantityInProductUnit) {
                alert(`❌ Nicht genügend Lagerbestand!\nVerfügbar: ${product.quantity.toFixed(2)} ${product.unit}\nBestellt: ${quantityInProductUnit.toFixed(2)} ${product.unit} (${quantity} ${orderUnit})`);
                return;
            }
            
            // Ziel-Array bestimmen
            const targetItems = isEditing ? this.editingOrder.items : this.newOrder.items;
            
            // Prüfen ob Produkt bereits vorhanden
            const existingItem = targetItems.find(item => item.productId === product.id && item.logLength === logLength);
            
            if (existingItem) {
                // Wenn gleiche Einheit, Menge addieren
                if (existingItem.unit === orderUnit) {
                    existingItem.quantity += quantity;
                    existingItem.total = existingItem.quantity * existingItem.pricePerUnit;
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
            
            // Preis pro Einheit basierend auf Scheitlänge und Einheit ermitteln
            let pricePerUnit = product.price; // Fallback: Einkaufspreis
            
            // Wenn priceLengths existiert und die Scheitlänge konfiguriert ist
            if (product.priceLengths && product.priceLengths[logLength]) {
                const lengthPrices = product.priceLengths[logLength];
                
                // Preis basierend auf Einheit wählen
                if (orderUnit === 'SRM' && lengthPrices.srm) {
                    pricePerUnit = parseFloat(lengthPrices.srm);
                } else if (orderUnit === 'RM' && lengthPrices.rm) {
                    pricePerUnit = parseFloat(lengthPrices.rm);
                } else if (orderUnit === 'FM') {
                    // FM-Preis: RM-Preis × 1.42 (da 1 FM = 1.42 RM)
                    if (lengthPrices.rm) {
                        pricePerUnit = parseFloat(lengthPrices.rm) * 1.42;
                    } else if (lengthPrices.srm) {
                        pricePerUnit = parseFloat(lengthPrices.srm) * 2.0164; // 1.42 × 1.42
                    }
                }
            }
            
            // Neues Item mit der eingegebenen Menge, Einheit und Scheitlänge
            targetItems.push({
                id: Date.now().toString() + Math.random().toString().slice(2, 7),
                productId: product.id,
                productName: product.name,
                productType: product.product_type || 'Brennholz',
                woodType: product.woodType || '',
                logLength: logLength,
                quantity: quantity,
                unit: orderUnit,
                pricePerUnit: pricePerUnit,
                priceUnit: orderUnit,
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
            console.log('Produkt mit Menge hinzugefügt:', product.name, quantity, orderUnit, logLength + 'cm');
            alert('✓ ' + product.name + ' (' + quantity.toFixed(2) + ' ' + orderUnit + ', ' + logLength + 'cm) hinzugefügt!');
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
            // Rabatt von der Gesamtsumme abziehen
            this.newOrder.total = subtotal + this.newOrder.deliveryCosts - (this.newOrder.discount || 0);
            
            // Auch für editingOrder berechnen falls vorhanden
            if (this.editingOrder && this.editingOrder.items) {
                const editSubtotal = this.editingOrder.items.reduce((sum, item) => {
                    return sum + (item.quantity * item.pricePerUnit);
                }, 0);
                
                this.editingOrder.subtotal = editSubtotal;
                this.editingOrder.total = editSubtotal + (this.editingOrder.deliveryCosts || 0) - (this.editingOrder.discount || 0);
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
                    customer_id: this.newOrder.customerId,
                    customer_name: this.newOrder.customerName,
                    customer_address: this.newOrder.customerAddress,
                    delivery_address: this.newOrder.deliveryAddress,
                    items: [...this.newOrder.items],
                    subtotal: this.newOrder.subtotal,
                    delivery_costs: this.newOrder.deliveryCosts,
                    total: this.newOrder.total,
                    payment_method: this.newOrder.paymentMethod,
                    payment_status: this.newOrder.paymentStatus,
                    delivery_date: this.newOrder.deliveryDate || null,
                    delivery_time: this.newOrder.deliveryTime || null,
                    status: this.newOrder.status,
                    notes: (this.newOrder.notes || '').trim()
                };
                
                console.log('Erstelle Bestellung:', order);
                
                // In Supabase speichern
                const { data: { user } } = await supabaseClient.auth.getUser();
                let orderId = null;
                if (user) {
                    orderId = await this.saveToSupabase('orders', order, user.id);
                    order.id = orderId;
                    order.user_id = user.id;
                    order.created_at = new Date().toISOString();
                    order.updated_at = order.created_at;
                    order.orderNumber = 'ORD-' + orderId.slice(0, 8).toUpperCase();
                    console.log('✓ Bestellung in Supabase gespeichert');
                } else {
                    // Fallback: localStorage
                    order.id = Date.now().toString();
                    order.orderNumber = 'ORD-' + order.id.slice(-6);
                    order.createdAt = new Date().toISOString();
                }
                
                // WICHTIG: camelCase Felder für lokale Nutzung hinzufügen (für Vue Templates)
                order.customerId = order.customer_id;
                order.customerName = order.customer_name;
                order.customerAddress = order.customer_address;
                order.deliveryAddress = order.delivery_address;
                order.deliveryCosts = order.delivery_costs;
                order.paymentMethod = order.payment_method;
                order.paymentStatus = order.payment_status;
                order.deliveryDate = order.delivery_date;
                order.deliveryTime = order.delivery_time;
                
                console.log('Bestellung komplett:', order);
                
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
                        
                        // Produkt auch in Supabase aktualisieren wenn möglich
                        if (user && updatedProducts[productIndex].id && !updatedProducts[productIndex].id.includes('.')) {
                            try {
                                await this.saveToSupabase('products', {
                                    id: updatedProducts[productIndex].id,
                                    quantity: newQuantity
                                }, user.id);
                            } catch (err) {
                                console.error('Fehler beim Aktualisieren des Lagerbestands:', err);
                            }
                        }
                    }
                }
                
                // Stats aktualisieren
                this.orders.push(order);
                this.ordersCount = this.orders.length;
                this.inventoryCount = this.products.length;
                this.totalValue = this.calculateTotalValue();
                
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

        viewOrder(order) {
            // Bestellung in der Orders-Übersicht anzeigen (scrollen zum Order)
            this.currentView = 'orders';
            // Optional: Hier könnte man später die Order im Modal öffnen oder zur Karte scrollen
            console.log('Öffne Bestellung:', order.id);
        },

        openOrderInMaps(order) {
            // Google Maps mit Routenplanung vom Lager zur Lieferadresse öffnen
            if (!order.deliveryAddress || !order.deliveryAddress.trim()) {
                alert('Keine Lieferadresse vorhanden.');
                return;
            }
            
            // Startadresse ermitteln: Lagerplatz der Bestellung oder Firmenadresse
            let startAddress = '';
            
            // Prüfen ob Bestellung einen Lagerplatz hat
            if (order.storageLocationIndex !== undefined && order.storageLocationIndex !== null && this.storageLocations[order.storageLocationIndex]) {
                const warehouse = this.storageLocations[order.storageLocationIndex];
                startAddress = warehouse.address || warehouse.name || '';
            }
            
            // Fallback auf Firmenadresse wenn kein Lagerplatz
            if (!startAddress && this.companyAddress) {
                startAddress = this.companyAddress;
            }
            
            // URLs zusammenbauen
            const destination = encodeURIComponent(order.deliveryAddress);
            
            if (startAddress) {
                const origin = encodeURIComponent(startAddress);
                const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                window.open(url, '_blank');
            } else {
                // Nur Zieladresse wenn keine Startadresse verfügbar
                const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                window.open(url, '_blank');
            }
        },

        // ========== WHATSAPP BESTÄTIGUNG ==========
        
        getCustomerPhone(order) {
            // Kunden-Telefonnummer für Bestellung finden
            const customer = this.customers.find(c => c.id === order.customerId);
            return customer ? customer.phone : null;
        },

        buildWhatsAppMessage(order, template) {
            // Kunden-Informationen holen
            const customer = this.customers.find(c => c.id === order.customerId);
            if (!customer) return '';

            // Bestell-Details formatieren
            const itemsText = order.items.map(item => {
                const productType = item.productType || 'Brennholz';
                const woodType = item.woodType || '';
                const productNameDisplay = woodType ? `${productType} ${woodType}` : productType;
                return `• ${item.quantity} ${item.unit} ${productNameDisplay} (${item.logLength}cm)`;
            }).join('\n');

            const deliveryDateStr = this.formatDeliveryDate(order.deliveryDate, order.deliveryTime);
            const totalText = this.formatCurrency(order.total);
            const deliveryCostsText = this.formatCurrency(order.deliveryCosts);
            const deliveryAddress = order.deliveryAddress || customer.address || '';

            // Platzhalter ersetzen
            let message = template;
            message = message.replace(/{customer_name}/g, customer.name);
            message = message.replace(/{items}/g, itemsText);
            message = message.replace(/{total}/g, totalText);
            message = message.replace(/{delivery_costs}/g, deliveryCostsText);
            message = message.replace(/{delivery_date}/g, deliveryDateStr);
            message = message.replace(/{delivery_time}/g, order.deliveryTime || '');
            message = message.replace(/{delivery_address}/g, deliveryAddress);
            // Firmennamen einsetzen (aus Einstellungen oder Fallback)
            const companyName = this.companyName || 'FireWoodFlow';
            message = message.replace(/FireWoodFlow/g, companyName);

            return message;
        },

        sendWhatsAppConfirmation(order) {
            // Kunden-Informationen holen
            const customer = this.customers.find(c => c.id === order.customerId);
            if (!customer || !customer.phone) {
                alert('Keine Telefonnummer für diesen Kunden gespeichert.');
                return;
            }

            // Nachricht mit Template bauen
            const message = this.buildWhatsAppMessage(order, this.whatsappConfirmationTemplate);

            // URL encoden für WhatsApp
            const encodedMessage = encodeURIComponent(message);
            
            // WhatsApp Link erstellen (wa.me Format)
            // Entferne + und Leerzeichen von der Telefonnummer
            const cleanPhone = customer.phone.replace(/[\s\+\-]/g, '');
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

            // In neuem Tab öffnen
            window.open(whatsappUrl, '_blank');
            
            console.log('WhatsApp Bestätigung geöffnet für:', customer.name, '-', customer.phone);
        },

        testWhatsAppTemplate() {
            // Test-Bestellung für Vorschau erstellen
            const testOrder = {
                customerId: 'test',
                customerName: 'Max Mustermann',
                deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                deliveryTime: '14:00',
                deliveryAddress: 'Musterstraße 123, 12345 Musterstadt',
                deliveryCosts: 35.50,
                total: 485.00,
                items: [
                    { quantity: 5, unit: 'RM', productType: 'Brennholz', woodType: 'Eiche', logLength: 50 },
                    { quantity: 2, unit: 'RM', productType: 'Brennholz', woodType: 'Buche', logLength: 33 }
                ]
            };

            // Mock customer for test
            this.customers = [{ id: 'test', name: 'Max Mustermann', phone: '+49123456789' }];

            // Nachricht mit Template bauen
            const message = this.buildWhatsAppMessage(testOrder, this.whatsappConfirmationTemplate);

            // URL encoden für WhatsApp
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/49123456789?text=${encodedMessage}`;

            // In neuem Tab öffnen
            window.open(whatsappUrl, '_blank');

            console.log('WhatsApp Template Test geöffnet');
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
                    const updatedOrderData = {
                        customer_id: this.editingOrder.customerId,
                        customer_name: this.editingOrder.customerName,
                        customer_address: this.editingOrder.customerAddress,
                        delivery_address: this.editingOrder.deliveryAddress,
                        items: [...this.editingOrder.items],
                        subtotal: this.editingOrder.subtotal,
                        delivery_costs: this.editingOrder.deliveryCosts,
                        total: this.editingOrder.total,
                        payment_method: this.editingOrder.paymentMethod,
                        payment_status: this.editingOrder.paymentStatus,
                        delivery_date: this.editingOrder.deliveryDate || null,
                        delivery_time: this.editingOrder.deliveryTime || null,
                        status: this.editingOrder.status,
                        notes: (this.editingOrder.notes || '').trim()
                    };
                    
                    // In Supabase speichern wenn User eingeloggt ist
                    const { data: { user } } = await supabaseClient.auth.getUser();
                    if (user && this.editingOrder.id && !this.editingOrder.id.includes('.')) {
                        // Echte UUID = Supabase Bestellung
                        await this.saveToSupabase('orders', { id: this.editingOrder.id, ...updatedOrderData }, user.id);
                        console.log('✓ Bestellung in Supabase aktualisiert');
                    }
                    
                    // Lokal aktualisieren
                    const updatedOrder = {
                        ...this.orders[index],
                        ...updatedOrderData,
                        updatedAt: new Date().toISOString()
                    };
                    
                    // WICHTIG: camelCase Felder für lokale Nutzung hinzufügen (für Vue Templates)
                    updatedOrder.customerId = updatedOrder.customer_id;
                    updatedOrder.customerName = updatedOrder.customer_name;
                    updatedOrder.customerAddress = updatedOrder.customer_address;
                    updatedOrder.deliveryAddress = updatedOrder.delivery_address;
                    updatedOrder.deliveryCosts = updatedOrder.delivery_costs;
                    updatedOrder.paymentMethod = updatedOrder.payment_method;
                    updatedOrder.paymentStatus = updatedOrder.payment_status;
                    updatedOrder.deliveryDate = updatedOrder.delivery_date;
                    updatedOrder.deliveryTime = updatedOrder.delivery_time;
                    
                    // Statusänderung für Activity-Feed protokollieren (wenn sich Status geändert hat)
                    const previousOrder = this.orders[index];
                    if (previousOrder.status !== updatedOrder.status) {
                        updatedOrder.statusUpdatedAt = new Date().toISOString();
                    } else if (previousOrder.statusUpdatedAt) {
                        // Bestehenden Wert behalten
                        updatedOrder.statusUpdatedAt = previousOrder.statusUpdatedAt;
                    }
                    
                    const updatedOrders = [...this.orders];
                    updatedOrders[index] = updatedOrder;
                    this.orders = updatedOrders;
                    
                    // Stats aktualisieren
                    this.inventoryCount = this.products.length;
                    this.totalValue = this.calculateTotalValue();
                    
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

        async deleteOrder(order) {
            if (confirm('Möchtest du die Bestellung "' + order.orderNumber + '" wirklich löschen?')) {
                // Aus Supabase löschen wenn möglich
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user && order.id && !order.id.includes('.')) {
                    try {
                        await this.deleteFromSupabase('orders', order.id, user.id);
                        console.log('✓ Bestellung aus Supabase gelöscht');
                    } catch (error) {
                        console.error('Fehler beim Löschen aus Supabase:', error);
                    }
                }
                
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
                        
                        // Produkt auch in Supabase aktualisieren wenn möglich
                        if (user && this.products[productIndex].id && !this.products[productIndex].id.includes('.')) {
                            try {
                                await this.saveToSupabase('products', {
                                    id: this.products[productIndex].id,
                                    quantity: this.products[productIndex].quantity
                                }, user.id);
                            } catch (err) {
                                console.error('Fehler beim Aktualisieren des Lagerbestands:', err);
                            }
                        }
                    }
                }
                
                this.orders = this.orders.filter(o => o.id !== order.id);
                this.ordersCount = this.orders.length;
                this.inventoryCount = this.products.length;
                this.totalValue = this.calculateTotalValue();
                
                // In localStorage speichern
                this.saveProducts();
                this.saveOrders();
                
                alert('✓ Bestellung gelöscht.');
            }
        },
        
        saveOrders() {
            localStorage.setItem('firewoodflow_orders', JSON.stringify(this.orders));
        },

        // ========== QUICK ORDER (SCHNELLBESTELLUNG) ==========
        
        // Lade Kunden mit letzter Bestellung für Quick Order Modal
        loadQuickOrderCustomers() {
            // Kunden sortieren: die mit Bestellungen zuerst, alphabetisch danach
            this.quickOrderCustomers = this.customers.map(customer => {
                const customerOrders = this.orders
                    .filter(o => o.customerId === customer.id)
                    .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
                
                const lastOrder = customerOrders[0];
                
                return {
                    ...customer,
                    lastOrderDate: lastOrder ? this.formatDateGerman(lastOrder.deliveryDate) : null,
                    lastOrderId: lastOrder ? lastOrder.id : null
                };
            }).sort((a, b) => {
                // Kunden mit letzten Bestellungen zuerst
                if (a.lastOrderDate && !b.lastOrderDate) return -1;
                if (!a.lastOrderDate && b.lastOrderDate) return 1;
                return a.name.localeCompare(b.name);
            });
        },
        
        onQuickOrderCustomerSelect() {
            if (!this.selectedQuickOrderCustomer) {
                this.lastOrderForCustomer = null;
                return;
            }
            
            // Letzte Bestellung des Kunden finden
            const customerOrders = this.orders
                .filter(o => o.customerId === this.selectedQuickOrderCustomer.id)
                .sort((a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate));
            
            this.lastOrderForCustomer = customerOrders.length > 0 ? customerOrders[0] : null;
        },
        
        startNewQuickOrder() {
            if (!this.selectedQuickOrderCustomer) {
                alert('Bitte wähle einen Kunden aus.');
                return;
            }
            
            // Quick Order Daten vorbereiten
            const customer = this.selectedQuickOrderCustomer;
            
            this.quickOrderData = {
                customerId: customer.id,
                customerName: customer.name,
                customerAddress: customer.address || '',
                deliveryAddress: customer.address || '',
                items: [],
                subtotal: 0,
                deliveryCosts: parseFloat(customer.deliveryCosts) || 0,
                total: 0,
                paymentMethod: 'bar',
                paymentStatus: 'offen',
                deliveryDate: new Date().toISOString().split('T')[0],
                deliveryTime: '',
                status: 'neu',
                notes: customer.notes || ''
            };
            
            // Wenn letzte Bestellung existiert, diese laden
            if (this.lastOrderForCustomer) {
                // Items kopieren (ohne IDs damit sie neu sind)
                this.quickOrderData.items = this.lastOrderForCustomer.items.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    woodType: item.woodType,
                    logLength: item.logLength,
                    quantity: item.quantity,
                    unit: item.unit,
                    pricePerUnit: item.pricePerUnit,
                    total: item.total
                }));
                
                // Lieferadresse von Kunde übernehmen (kann geändert werden)
                this.quickOrderData.deliveryAddress = this.lastOrderForCustomer.deliveryAddress || customer.address;
                this.quickOrderData.deliveryTime = this.lastOrderForCustomer.deliveryTime || '';
                this.quickOrderData.paymentMethod = this.lastOrderForCustomer.paymentMethod || 'bar';
                this.quickOrderData.deliveryCosts = parseFloat(this.lastOrderForCustomer.deliveryCosts) || 0;
            }
            
            // Berechne Totals
            this.calculateQuickOrderTotals();
            
            // Zu Schritt 2 wechseln
            this.quickOrderStep = 2;
        },
        
        resetQuickOrder() {
            this.quickOrderStep = 1;
            this.selectedQuickOrderCustomer = null;
            this.lastOrderForCustomer = null;
            this.quickOrderData = {
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
        },
        
        changeQuickOrderCustomer() {
            this.resetQuickOrder();
        },
        
        addQuickOrderProduct() {
            if (this.products.length === 0) {
                alert('Keine Produkte im Lager. Bitte zuerst Produkte anlegen.');
                return;
            }
            
            // Erstes Produkt als Default nehmen
            const product = this.products[0];
            
            this.quickOrderData.items.push({
                productId: product.id,
                productName: product.name,
                woodType: product.woodType,
                logLength: product.logLength,
                quantity: 1,
                unit: 'RM',
                pricePerUnit: this.getProductPrice(product, 'RM'),
                total: 0
            });
            
            this.calculateQuickOrderTotals();
        },
        
        removeQuickOrderItem(index) {
            this.quickOrderData.items.splice(index, 1);
            this.calculateQuickOrderTotals();
        },
        
        getProductPrice(product, unit) {
            // Preis aus priceLengths holen wenn vorhanden, sonst Basis-Preis
            if (product.priceLengths && product.priceLengths[product.logLength]) {
                const lengthPrices = product.priceLengths[product.logLength];
                if (unit === 'SRM' && lengthPrices.srm) return parseFloat(lengthPrices.srm);
                if (unit === 'RM' && lengthPrices.rm) return parseFloat(lengthPrices.rm);
            }
            return parseFloat(product.price) || 0;
        },
        
        calculateQuickOrderSubtotal() {
            let subtotal = 0;
            this.quickOrderData.items.forEach(item => {
                const price = this.getProductPriceByItemId(item);
                item.total = (parseFloat(item.quantity) || 0) * price;
                subtotal += item.total;
            });
            this.quickOrderData.subtotal = subtotal;
            return subtotal;
        },
        
        getProductPriceByItemId(item) {
            const product = this.products.find(p => p.id === item.productId);
            if (!product) return 0;
            return this.getProductPrice(product, item.unit);
        },
        
        calculateQuickOrderTotal() {
            const subtotal = this.calculateQuickOrderSubtotal();
            const deliveryCosts = parseFloat(this.quickOrderData.deliveryCosts) || 0;
            this.quickOrderData.total = subtotal + deliveryCosts;
            return this.quickOrderData.total;
        },
        
        calculateQuickOrderTotals() {
            this.calculateQuickOrderTotal();
        },
        
        async submitQuickOrder() {
            // Validierung
            if (!this.quickOrderData.customerId) {
                alert('Kein Kunde ausgewählt.');
                return;
            }
            
            if (this.quickOrderData.items.length === 0) {
                alert('Bitte füge mindestens ein Produkt hinzu.');
                return;
            }
            
            if (!this.quickOrderData.deliveryDate) {
                alert('Bitte wähle ein Lieferdatum.');
                return;
            }
            
            // Lagerbestand prüfen und anpassen
            const toRM = { 'FM': 1.42, 'RM': 1, 'SRM': 1 / 1.42 };
            
            for (const item of this.quickOrderData.items) {
                const productIndex = this.products.findIndex(p => p.id === item.productId);
                if (productIndex !== -1) {
                    const quantityInProductUnit = (parseFloat(item.quantity) || 0) * toRM[item.unit] / toRM[this.products[productIndex].unit];
                    
                    if (this.products[productIndex].quantity < quantityInProductUnit) {
                        alert(`❌ Nicht genügend Lagerbestand für "${this.products[productIndex].name}"`);
                        return;
                    }
                    
                    this.products[productIndex].quantity = Math.round((this.products[productIndex].quantity - quantityInProductUnit) * 10) / 10;
                }
            }
            
            // Bestellung erstellen
            const newOrder = {
                id: crypto.randomUUID(),
                customerId: this.quickOrderData.customerId,
                customerName: this.quickOrderData.customerName,
                customerAddress: this.quickOrderData.customerAddress,
                deliveryAddress: this.quickOrderData.deliveryAddress,
                items: [...this.quickOrderData.items],
                subtotal: this.quickOrderData.subtotal,
                deliveryCosts: this.quickOrderData.deliveryCosts,
                total: this.quickOrderData.total,
                paymentMethod: this.quickOrderData.paymentMethod,
                paymentStatus: this.quickOrderData.paymentStatus,
                deliveryDate: this.quickOrderData.deliveryDate,
                deliveryTime: this.quickOrderData.deliveryTime,
                status: this.quickOrderData.status,
                notes: this.quickOrderData.notes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // In Supabase speichern
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                try {
                    await this.saveToSupabase('orders', newOrder, user.id);
                    console.log('✓ Schnellbestellung in Supabase gespeichert');
                } catch (err) {
                    console.error('❌ Fehler beim Speichern in Supabase:', err);
                }
            }
            
            // Lokal speichern
            this.orders.push(newOrder);
            this.saveOrders();
            this.saveProducts();
            
            // Stats aktualisieren
            this.inventoryCount = this.products.length;
            this.totalValue = this.calculateTotalValue();
            
            // Activity Feed wird automatisch aktualisiert durch computed property
            
            alert('✅ Schnellbestellung erstellt!');
            
            // Modal schließen und zurücksetzen
            this.showQuickOrderModal = false;
            this.resetQuickOrder();
        },

        updateOrderStatus(order, newStatus) {
            const index = this.orders.findIndex(o => o.id === order.id);
            if (index !== -1 && newStatus) {
                this.orders[index].status = newStatus;
                // Statusänderung für Activity-Feed protokollieren
                const now = new Date().toISOString();
                this.orders[index].statusUpdatedAt = now;
                
                // In Supabase speichern wenn User eingeloggt ist
                const { data: { user } } = supabaseClient.auth.getUser();
                if (user && order.id && !order.id.includes('.')) {
                    // Echte UUID = Supabase Bestellung
                    this.updateOrderStatusInSupabase(order.id, newStatus, user.id)
                        .then(() => console.log('✓ Status in Supabase aktualisiert'))
                        .catch(err => console.error('❌ Fehler beim Speichern des Status:', err));
                }
                
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
                previewDiv.innerHTML = `<p style="color:#C0392B;text-align:center;">❌ Fehler: ${error.message}</p>`;
            }
        },

        async previewStorageLocation(address) {
            if (!address || !address.trim()) {
                alert('Dieser Lagerplatz hat keine Adresse hinterlegt.');
                return;
            }

            // Modal mit Kartenvorschau erstellen
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
            modal.onclick = () => document.body.removeChild(modal);

            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            modalContent.style.cssText = 'max-width:600px;width:90%;padding:20px;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
            modalContent.onclick = (e) => e.stopPropagation();

            modalContent.innerHTML = `
                <h2 style="margin-bottom:15px;color:#4A3728;">🗺️ Lagerplatz Vorschau</h2>
                <div id="storageMapPreviewModal" style="min-height:250px;"></div>
                <button onclick="this.closest('.modal-overlay').remove()" style="margin-top:15px;padding:10px 20px;background:#8B4513;color:white;border:none;border-radius:6px;cursor:pointer;">Schließen</button>
            `;

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Karte laden
            const previewDiv = document.getElementById('storageMapPreviewModal');
            previewDiv.innerHTML = '<p style="text-align:center;padding:20px;">🗺️ Lade Karte...</p>';

            try {
                // Koordinaten ermitteln
                let coords;
                
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

                const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.01},${coords.lat - 0.01},${coords.lon + 0.01},${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat},${coords.lon}`;
                
                previewDiv.innerHTML = `
                    <iframe 
                        src="${mapUrl}" 
                        width="100%" 
                        height="300" 
                        style="border:1px solid #ccc;border-radius:8px;"
                        loading="lazy"
                    ></iframe>
                    <p style="text-align:center;margin-top:10px;font-size:0.9em;color:#6B5D52;">
                        📍 ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}
                    </p>
                `;

            } catch (error) {
                console.error('Fehler beim Laden der Karte:', error);
                previewDiv.innerHTML = `<p style="color:#C0392B;text-align:center;">❌ Fehler: ${error.message}</p>`;
            }
        },

        // Settings Methoden
        handleChangePassword() {
            alert('Passwort ändern wird noch implementiert.');
        },

        handleResetApp() {
            if (confirm('ACHTUNG: Dies löscht ALLE lokalen Daten!\n\n• Alle Produkte\n• Alle Kunden\n• Alle Bestellungen\n\nFirmeneinstellungen bleiben erhalten.\n\nBist du sicher? Dies kann nicht rückgängig gemacht werden.')) {
                // localStorage keys für Daten löschen
                localStorage.removeItem('firewoodflow_products');
                localStorage.removeItem('firewoodflow_customers');
                localStorage.removeItem('firewoodflow_orders');
                
                // App neu laden um leere Daten zu laden
                alert('✓ App wurde auf Werkseinstellungen zurückgesetzt.\n\nDie Seite wird jetzt neu geladen.');
                window.location.reload();
            }
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

        // Expense Management Methods
        async addExpense() {
            if (!this.newExpense.amount || parseFloat(this.newExpense.amount) <= 0) {
                alert('Bitte einen gültigen Betrag eingeben.');
                return;
            }

            if (!this.newExpense.date) {
                this.newExpense.date = new Date().toISOString().split('T')[0];
            }

            const expense = {
                id: Date.now().toString(),
                amount: parseFloat(this.newExpense.amount),
                category: this.newExpense.category,
                description: this.newExpense.description || 'Ohne Beschreibung',
                date: this.newExpense.date,
                notes: this.newExpense.notes || '',
                storageLocationIndex: this.newExpense.storageLocationIndex !== '' ? parseInt(this.newExpense.storageLocationIndex) : null
            };

            // In Supabase speichern (wenn verfügbar)
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    const { error } = await supabaseClient
                        .from('expenses')
                        .insert({
                            id: expense.id,
                            user_id: user.id,
                            amount: expense.amount,
                            category: expense.category,
                            description: expense.description,
                            date: expense.date,
                            notes: expense.notes,
                            storage_location_index: expense.storageLocationIndex
                        });
                    
                    if (!error) {
                        console.log('✓ Ausgabe in Supabase gespeichert');
                    }
                }
            } catch (error) {
                console.warn('Konnte Ausgabe nicht in Supabase speichern:', error.message);
            }

            // Auch lokal speichern (Fallback + sofortige UI-Aktualisierung)
            this.expenses.push(expense);
            this.saveExpenses();

            // Reset form
            this.newExpense = {
                amount: '',
                category: 'fuel',
                description: '',
                date: '',
                notes: ''
            };
            this.showAddExpense = false;

            alert('✓ Ausgabe erfolgreich erfasst!');
        },

        async deleteExpense(expense) {
            if (confirm(`Ausgabe "${expense.description}" für ${this.formatCurrency(expense.amount)} löschen?`)) {
                // Aus Supabase löschen (wenn verfügbar)
                try {
                    await supabaseClient
                        .from('expenses')
                        .delete()
                        .eq('id', expense.id);
                    
                    console.log('✓ Ausgabe aus Supabase gelöscht');
                } catch (error) {
                    console.warn('Konnte Ausgabe nicht aus Supabase löschen:', error.message);
                }

                // Auch lokal löschen
                this.expenses = this.expenses.filter(e => e.id !== expense.id);
                this.saveExpenses();
            }
        },

        saveExpenses() {
            localStorage.setItem('firewoodflow_expenses', JSON.stringify(this.expenses));
        },

        async createInventoryExpense(product, userId) {
            // Erstellt automatisch eine Ausgabe beim Anlegen eines Produkts
            const totalValue = (parseFloat(product.quantity) || 0) * (parseFloat(product.price) || 0);
            
            if (totalValue <= 0) return; // Keine Ausgabe bei Wert 0
            
            const expense = {
                id: 'inv-' + Date.now().toString(),
                amount: totalValue,
                category: 'material',
                description: `Wareneinkauf: ${product.name} (${product.quantity} ${product.unit})`,
                date: product.purchase_date || new Date().toISOString().split('T')[0],
                notes: `Automatisch erstellt beim Anlegen von Produkt "${product.name}"`,
                storageLocationIndex: product.storageLocationIndex !== undefined ? product.storageLocationIndex : null,
                storage_location_index: product.storageLocationIndex !== undefined ? product.storageLocationIndex : null,
                is_inventory_purchase: true,
                product_id: product.id
            };
            
            // IMMER zuerst lokal speichern (für sofortige UI-Aktualisierung)
            this.expenses.push(expense);
            this.saveExpenses();
            console.log('✓ Automatische Ausgabe für Wareneinkauf erstellt (local):', expense.description);
            
            // Dann versuchen in Supabase zu speichern (wenn verfügbar)
            try {
                const { error } = await supabaseClient
                    .from('expenses')
                    .insert({
                        id: expense.id,
                        user_id: userId,
                        amount: expense.amount,
                        category: expense.category,
                        description: expense.description,
                        date: expense.date,
                        notes: expense.notes,
                        storage_location_index: expense.storage_location_index,
                        is_inventory_purchase: true,
                        product_id: product.id
                    });
                
                if (error) {
                    console.warn('Supabase konnte Wareneinkauf nicht speichern (fehlende Spalten?). Lokale Kopie bleibt erhalten:', error.message);
                } else {
                    console.log('✓ Automatische Ausgabe auch in Supabase gespeichert');
                }
            } catch (error) {
                console.warn('Supabase-Fehler bei Wareneinkauf (lokale Kopie bleibt):', error.message);
            }
        },

        createInventoryExpenseLocal(product) {
            // Lokale Version für Offline/LocalStorage-Modus
            const totalValue = (parseFloat(product.quantity) || 0) * (parseFloat(product.price) || 0);
            
            if (totalValue <= 0) return;
            
            const expense = {
                id: 'inv-' + Date.now().toString(),
                amount: totalValue,
                category: 'material',
                description: `Wareneinkauf: ${product.name} (${product.quantity} ${product.unit})`,
                date: product.purchase_date || new Date().toISOString().split('T')[0],
                notes: `Automatisch erstellt beim Anlegen von Produkt "${product.name}"`,
                storageLocationIndex: product.storage_location_index !== undefined ? product.storage_location_index : null,
                storage_location_index: product.storage_location_index !== undefined ? product.storage_location_index : null,
                is_inventory_purchase: true,
                product_id: product.id
            };
            
            this.expenses.push(expense);
            this.saveExpenses();
            console.log('✓ Automatische Ausgabe für Wareneinkauf erstellt (local):', expense.description);
        },

        async createMissingInventoryExpenses() {
            // Erstellt rückwirkend Wareneinkäufe für alle bestehenden Produkte ohne Ausgabe
            let createdCount = 0;
            
            for (const product of this.products) {
                // Prüfen ob bereits eine Wareneinkauf-Ausgabe existiert
                const existingExpense = this.expenses.find(e => 
                    e.product_id === product.id && e.is_inventory_purchase === true
                );
                
                if (!existingExpense && product.quantity > 0 && product.price > 0) {
                    // Keine Ausgabe vorhanden → erstellen
                    const totalValue = parseFloat(product.quantity) * parseFloat(product.price);
                    
                    // Lagerort-Index aus Produkt lesen (beide Varianten prüfen)
                    const storageLoc = product.storageLocationIndex !== undefined ? product.storageLocationIndex : 
                                       product.storage_location_index !== undefined ? product.storage_location_index : null;
                    
                    const expense = {
                        id: 'inv-missing-' + product.id + '-' + Date.now().toString(),
                        amount: totalValue,
                        category: 'material',
                        description: `Wareneinkauf (nachgetragen): ${product.name} (${product.quantity} ${product.unit})`,
                        date: product.purchase_date || product.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                        notes: `Rückwirkend erstellt für bestehendes Produkt "${product.name}"`,
                        storageLocationIndex: storageLoc,
                        storage_location_index: storageLoc,
                        is_inventory_purchase: true,
                        product_id: product.id
                    };
                    
                    this.expenses.push(expense);
                    createdCount++;
                    console.log('✓ Nachgetragener Wareneinkauf:', expense.description, 'Lagerort:', storageLoc);
                }
            }
            
            if (createdCount > 0) {
                this.saveExpenses();
                console.log(`✅ ${createdCount} Wareneinkäufe nachträglich erstellt`);
                
                // UI aktualisieren
                alert(`ℹ️ ${createdCount} Wareneinkäufe für bestehende Produkte wurden nachträglich als Ausgaben erfasst.`);
            }
        },

        async repairInventoryExpenseStorageLocations() {
            // Repariert bestehende Wareneinkäufe ohne oder mit falschem Lagerort
            let repairedCount = 0;
            
            for (const expense of this.expenses) {
                // Nur Wareneinkäufe prüfen
                if (expense.is_inventory_purchase !== true && !expense.product_id) {
                    continue;
                }
                
                // Produkt finden das zu dieser Ausgabe gehört
                const product = this.products.find(p => p.id === expense.product_id || p.id === expense.productId);
                
                if (product) {
                    // Lagerort aus Produkt lesen (beide Varianten prüfen)
                    const correctStorageLoc = product.storageLocationIndex !== undefined ? product.storageLocationIndex : 
                                              product.storage_location_index !== undefined ? product.storage_location_index : null;
                    
                    // Aktuelle Lagerorte der Ausgabe prüfen (beide Varianten)
                    const currentStorageLoc = expense.storageLocationIndex !== undefined ? expense.storageLocationIndex : 
                                              expense.storage_location_index !== undefined ? expense.storage_location_index : null;
                    
                    // Reparieren wenn Lagerort fehlt oder falsch ist
                    if (correctStorageLoc !== null && correctStorageLoc !== undefined && currentStorageLoc !== correctStorageLoc) {
                        expense.storageLocationIndex = correctStorageLoc;
                        expense.storage_location_index = correctStorageLoc;
                        repairedCount++;
                        console.log(`✓ Wareneinkauf repariert: "${expense.description}" - Lagerort: ${correctStorageLoc}`);
                    }
                }
            }
            
            if (repairedCount > 0) {
                this.saveExpenses();
                console.log(`✅ ${repairedCount} Wareneinkäufe mit Lagerorten repariert`);
            }
        },

        getCategoryName(category) {
            const names = {
                fuel: 'Sprit',
                maintenance: 'Wartung',
                insurance: 'Versicherung',
                material: 'Material',
                tools: 'Werkzeuge',
                office: 'Büro',
                other: 'Sonstiges'
            };
            return names[category] || category;
        },

        getCategoryIcon(category) {
            const icons = {
                fuel: '⛽',
                maintenance: '🔧',
                insurance: '📋',
                material: '🪵',
                tools: '🔨',
                office: '📁',
                other: '📦'
            };
            return icons[category] || '📦';
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
        },

        // Delivery Planning Methods
        initWeekStart() {
            // Set current week to Monday of this week
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
            const monday = new Date(now.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            this.currentWeekStart = monday.toISOString().split('T')[0];
            
            // Select today by default
            this.selectedDay = new Date().toISOString().split('T')[0];
        },

        previousWeek() {
            const date = new Date(this.currentWeekStart);
            date.setDate(date.getDate() - 7);
            this.currentWeekStart = date.toISOString().split('T')[0];
            this.selectedDay = null;
        },

        nextWeek() {
            const date = new Date(this.currentWeekStart);
            date.setDate(date.getDate() + 7);
            this.currentWeekStart = date.toISOString().split('T')[0];
            this.selectedDay = null;
        },

        goToCurrentWeek() {
            this.initWeekStart();
        },

        selectDay(date) {
            this.selectedDay = date;
        },

        isToday(dateStr) {
            const today = new Date().toISOString().split('T')[0];
            return dateStr === today;
        },

        formatWeekStart(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        formatWeekEnd(dateStr) {
            const date = new Date(dateStr);
            date.setDate(date.getDate() + 6);
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        formatFullDate(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        },

        optimizeRoute() {
            // Simple optimization: Sort by time, then create Google Maps route
            if (this.selectedDayOrders.length === 0) return;
            
            // Sort orders by delivery time
            const sorted = [...this.selectedDayOrders].sort((a, b) => {
                const timeA = a.deliveryTime || '23:59';
                const timeB = b.deliveryTime || '23:59';
                return timeA.localeCompare(timeB);
            });
            
            // Assign optimized positions
            sorted.forEach((order, idx) => {
                order.optimizedPosition = idx + 1;
            });
            
            // Open Google Maps with all stops
            const addresses = sorted.map(o => encodeURIComponent(o.deliveryAddress)).join('/');
            const startAddress = encodeURIComponent(this.companyAddress || this.storageLocations[0]?.address || '');
            
            const mapsUrl = `https://www.google.com/maps/dir/${startAddress}/${addresses}`;
            window.open(mapsUrl, '_blank');
            
            alert(`✓ Route optimiert! ${sorted.length} Stopps in Google Maps geöffnet.`);
        },

        printDeliveryList() {
            // Create printable version
            const printWindow = window.open('', '_blank');
            const orders = this.selectedDayOrders.sort((a, b) => {
                const timeA = a.deliveryTime || '23:59';
                const timeB = b.deliveryTime || '23:59';
                return timeA.localeCompare(timeB);
            });
            
            let html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Lieferliste - ${this.formatFullDate(this.selectedDay)}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #8B7355; border-bottom: 3px solid #8B7355; padding-bottom: 10px; }
        .header { margin-bottom: 30px; }
        .stats { display: flex; gap: 30px; margin: 20px 0; background: #f5f5f5; padding: 15px; border-radius: 8px; }
        .stat { text-align: center; }
        .stat-value { font-size: 1.5em; font-weight: bold; color: #8B7355; }
        .stat-label { font-size: 0.9em; color: #666; }
        .delivery { border: 2px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; page-break-inside: avoid; }
        .delivery-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .position { background: #8B7355; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .time { font-size: 1.2em; font-weight: bold; }
        .customer { font-size: 1.1em; font-weight: bold; }
        .address { color: #666; margin: 8px 0; }
        .items { background: #f9f9f9; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .total { font-size: 1.1em; font-weight: bold; color: #8B7355; text-align: right; }
        @media print { body { padding: 0; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚚 Lieferliste - ${this.companyName}</h1>
        <p><strong>Datum:</strong> ${this.formatFullDate(this.selectedDay)}</p>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-value">${orders.length}</div>
            <div class="stat-label">Lieferungen</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.calculateTotalDistance().toFixed(1)} km</div>
            <div class="stat-label">Gesamt-Strecke</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.earliestDeliveryTime()}</div>
            <div class="stat-label">Erster Start</div>
        </div>
    </div>
    
    <h2>Lieferroute</h2>
`;
            
            orders.forEach((order, idx) => {
                html += `
<div class="delivery">
    <div class="delivery-header">
        <span class="position">${idx + 1}</span>
        <span class="time">${this.formatTime(order.deliveryTime)}</span>
        <span class="customer">${order.customerName}</span>
    </div>
    <div class="address">📍 ${order.deliveryAddress}</div>
    <div class="items">
        ${order.items.map(item => `<div>• ${item.quantity} ${item.unit} ${item.productName} (${item.logLength}cm)</div>`).join('')}
    </div>
    <div class="total">💶 ${this.formatCurrency(order.total)}</div>
</div>
`;
            });
            
            html += `
    <div class="no-print" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print()" style="padding: 15px 30px; font-size: 1em; background: #8B7355; color: white; border: none; border-radius: 8px; cursor: pointer;">🖨️ Drucken</button>
        <button onclick="window.close()" style="padding: 15px 30px; font-size: 1em; background: #ccc; color: #333; border: none; border-radius: 8px; cursor: pointer; margin-left: 10px;">Schließen</button>
    </div>
</body>
</html>`;
            
            printWindow.document.write(html);
            printWindow.document.close();
        },

        calculateTotalDistance() {
            // Simple estimation: 5km average between stops
            return this.selectedDayOrders.length > 0 ? this.selectedDayOrders.length * 5 : 0;
        },

        calculateTotalDriveTime() {
            // Simple estimation: 15 minutes per stop
            const minutes = this.selectedDayOrders.length * 15;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
        },

        earliestDeliveryTime() {
            if (this.selectedDayOrders.length === 0) return '-';
            const times = this.selectedDayOrders.map(o => o.deliveryTime).filter(t => t).sort();
            return times.length > 0 ? times[0] : 'ganztägig';
        },

        getGoogleMapsLink(address) {
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        },

        callCustomer(order) {
            if (order.customerPhone) {
                window.location.href = `tel:${order.customerPhone}`;
            }
        }
    }
}).mount('#app');
