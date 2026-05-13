const socket = io();

// UI Elements - Bot Controls
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const statusBadge = document.getElementById('bot-status-badge');

btnStart.addEventListener('click', () => {
    btnStart.disabled = true;
    socket.emit('start_bot');
});

btnStop.addEventListener('click', () => {
    btnStop.disabled = true;
    socket.emit('stop_bot');
});

socket.on('bot_online_status', (isOnline) => {
    if (isOnline) {
        statusBadge.textContent = "Durum: Çevrimiçi";
        statusBadge.className = "badge status-online";
        btnStart.disabled = true;
        btnStop.disabled = false;
    } else {
        statusBadge.textContent = "Durum: Çevrimdışı";
        statusBadge.className = "badge status-offline";
        btnStart.disabled = false;
        btnStop.disabled = true;
        
        // Reset Dashboard UI
        const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };
        
        setHtml('health-text', '0 / 20'); setStyle('health-bar', 'width', '0%');
        setHtml('food-text', '0 / 20'); setStyle('food-bar', 'width', '0%');
        setHtml('pos-text', 'Yükleniyor...');
        setHtml('username-text', 'Yükleniyor...');
        setHtml('server-badge', 'Sunucu: Bekleniyor');
        setHtml('tps-text', '0.0');
        setHtml('ping-text', '0 ms');
        setHtml('eq-helmet', 'Yok'); setHtml('eq-chest', 'Yok'); setHtml('eq-legs', 'Yok'); setHtml('eq-boots', 'Yok'); setHtml('eq-hand', 'Boş');
        setHtml('inv-list', '');
    }
});

socket.on('system_error', (msg) => {
    alert("Sistem Hatası: " + msg);
    btnStart.disabled = false;
    btnStop.disabled = false;
});

// UI Elements - Navigation
const sidebarNav = document.querySelectorAll('.sidebar-nav li');
const tabContents = document.querySelectorAll('.tab-content');
const toggleSidebar = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');

// Tab Switching
sidebarNav.forEach(item => {
    item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        
        // Update active menu item
        sidebarNav.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) content.classList.add('active');
        });

        // If chests tab, load data
        if (tabId === 'chests') loadChests();
    });
});

// Sidebar Toggle
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const icon = toggleSidebar.querySelector('i');
    if (sidebar.classList.contains('collapsed')) {
        icon.className = 'fas fa-chevron-right';
    } else {
        icon.className = 'fas fa-chevron-left';
    }
});

// --- SOCKET.IO LİSTENERS ---

// Bot Status Update
socket.on('bot_status', (data) => {
    // Health Bar
    const healthPercent = (data.health / 20) * 100;
    document.getElementById('health-bar').style.width = `${healthPercent}%`;
    document.getElementById('health-text').innerText = `${Math.round(data.health)} / 20`;
    
    // Food Bar
    const foodPercent = (data.food / 20) * 100;
    document.getElementById('food-bar').style.width = `${foodPercent}%`;
    document.getElementById('food-text').innerText = `${Math.round(data.food)} / 20`;

    // Position
    if (data.position) {
        document.getElementById('pos-text').innerText = `X: ${data.position.x}, Y: ${data.position.y}, Z: ${data.position.z}`;
    }

    // Server
    document.getElementById('server-badge').innerText = `Sunucu: ${data.server || 'Bilinmiyor'}`;

    // Username
    document.getElementById('username-text').innerText = data.username || 'Bilinmiyor';

    // TPS & Ping
    if (data.tps) document.getElementById('tps-text').innerText = data.tps;
    if (data.ping !== undefined) document.getElementById('ping-text').innerText = `${data.ping} ms`;

    // Equipment
    if (data.equipment) {
        document.getElementById('eq-helmet').innerText = data.equipment.helmet;
        document.getElementById('eq-chest').innerText = data.equipment.chestplate;
        document.getElementById('eq-legs').innerText = data.equipment.leggings;
        document.getElementById('eq-boots').innerText = data.equipment.boots;
        document.getElementById('eq-hand').innerText = data.equipment.hand;
    }

    // Inventory Preview
    // Envanter Tablosu
    const invList = document.getElementById('inv-list');
    invList.innerHTML = '';
    data.inventory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.title = "Tıklayarak atabilirsiniz";
        div.innerHTML = `
            <img src="https://static.minecraftitemids.com/32/${item.name.toLowerCase()}.png" 
                 onerror="this.src='https://static.minecraftitemids.com/32/barrier.png'">
            <span>${item.count}</span>
        `;
        // Eşya atma (Toss) tıklaması
        div.addEventListener('click', () => {
            if(confirm(`1 adet ${item.name} atmak istiyor musunuz?`)) {
                socket.emit('toss_item', { name: item.name, count: 1 });
            }
        });
        invList.appendChild(div);
    });

    // Viewer Update
    const viewerOverlay = document.getElementById('viewer-overlay');
    const viewerIframe = document.getElementById('viewer-iframe');
    if (data.isOnline && viewerIframe.src === "") {
        viewerOverlay.style.display = 'none';
        // Sunucu localhost üzerinde çalışıyorsa adresi ona göre ayarla
        viewerIframe.src = `http://${window.location.hostname}:3000`;
    } else if (!data.isOnline) {
        viewerOverlay.style.display = 'flex';
        viewerIframe.src = "";
    }
});

// Scoreboard Update
socket.on('scoreboard_update', (board) => {
    const sb = document.getElementById('scoreboard-content');
    sb.innerHTML = `<div class="scoreboard-title">${board.title}</div>`;
    board.lines.forEach(line => {
        const div = document.createElement('div');
        div.textContent = line;
        sb.appendChild(div);
    });
});

// Config Sync
const toggleReconnect = document.getElementById('toggle-reconnect');
const toggleTowny = document.getElementById('toggle-towny');
const toggleAutoEat = document.getElementById('toggle-autoeat');

socket.on('config_update', (config) => {
    toggleReconnect.checked = config.autoReconnect;
    toggleTowny.checked = config.autoTowny;
    toggleAutoEat.checked = config.autoEat;
});

function emitConfigUpdate() {
    socket.emit('update_config', {
        autoReconnect: toggleReconnect.checked,
        autoTowny: toggleTowny.checked,
        autoEat: toggleAutoEat.checked
    });
}

toggleReconnect.addEventListener('change', emitConfigUpdate);
toggleTowny.addEventListener('change', emitConfigUpdate);
toggleAutoEat.addEventListener('change', emitConfigUpdate);

document.getElementById('btn-manual-towny').addEventListener('click', () => {
    socket.emit('join_towny');
});

// Theme Logic
const themeSelect = document.getElementById('theme-select');
const currentTheme = localStorage.getItem('bot_theme') || 'glass';
document.body.className = `theme-${currentTheme}`;
themeSelect.value = currentTheme;

themeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    document.body.className = `theme-${val}`;
    localStorage.setItem('bot_theme', val);
});

// Chat Messages
socket.on('chat_message', (data) => {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-line';
    
    // Minecraft renklerini destekleyen ANSI formatını kullanabiliriz 
    // Ancak webde ANSI'yi HTML'e çeviren bir kütüphane lazım. 
    // Şimdilik sadece düz metin olarak ekliyoruz.
    msgDiv.innerText = data.text;
    
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Send Chat Message
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

function sendMessage() {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit('send_chat', msg);
        chatInput.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// --- CHEST DEPOT LOGIC ---
let allChestsData = [];

// Chest Tab Toggles
const chestTabBtns = document.querySelectorAll('.chest-tab-btn');
const chestViews = document.querySelectorAll('.chest-view-container');

chestTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        chestTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const targetId = btn.getAttribute('data-target');
        chestViews.forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
            if (view.id === targetId) {
                view.classList.add('active');
                view.style.display = 'block';
            }
        });
    });
});

// Load Chests from API
async function loadChests() {
    document.getElementById('all-items-grid').innerHTML = '<div class="loading-text">Yükleniyor...</div>';
    document.getElementById('chests-accordion').innerHTML = '<div class="loading-text">Yükleniyor...</div>';
    
    try {
        const response = await fetch('/api/chests');
        allChestsData = await response.json();
        renderChests();
    } catch (err) {
        document.getElementById('all-items-grid').innerHTML = `<div class="loading-text">Hata: ${err.message}</div>`;
        document.getElementById('chests-accordion').innerHTML = `<div class="loading-text">Hata: ${err.message}</div>`;
    }
}

function renderChests(searchQuery = '') {
    const grid = document.getElementById('all-items-grid');
    const accordion = document.getElementById('chests-accordion');
    grid.innerHTML = '';
    accordion.innerHTML = '';

    if (allChestsData.length === 0) {
        const emptyMsg = '<div class="loading-text">Kayıtlı sandık bulunamadı. Önce sandiktara yapın.</div>';
        grid.innerHTML = emptyMsg;
        accordion.innerHTML = emptyMsg;
        return;
    }

    const aggregatedItems = {};
    const query = searchQuery.toLowerCase();

    // Sandık Sandık Görünüm ve Toplama İşlemi
    allChestsData.forEach((chest, index) => {
        // Search Filter
        const filteredItems = chest.items.filter(i => i.name.toLowerCase().includes(query));
        
        // Aggregate for 'All Items'
        filteredItems.forEach(item => {
            if (aggregatedItems[item.name]) aggregatedItems[item.name] += item.count;
            else aggregatedItems[item.name] = item.count;
        });

        // Accordion UI for this chest (Only if it has matching items)
        if (filteredItems.length > 0) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'chest-group';
            
            const totalCount = filteredItems.reduce((acc, curr) => acc + curr.count, 0);
            
            groupDiv.innerHTML = `
                <div class="chest-group-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div class="chest-title">
                        <i class="fas fa-box-open"></i>
                        <span>Sandık (X: ${chest.x}, Y: ${chest.y}, Z: ${chest.z}) - ${filteredItems.length} Çeşit, ${totalCount} Eşya</span>
                    </div>
                    <i class="fas fa-chevron-down text-muted"></i>
                </div>
                <div class="chest-group-content">
                    <div class="item-grid" style="max-height: none;">
                        ${filteredItems.map(item => `
                            <div class="item-card">
                                <img src="https://static.minecraftitemids.com/32/${item.name.toLowerCase()}.png" class="item-img" onerror="this.src='https://static.minecraftitemids.com/32/chest.png'" alt="${item.name}">
                                <span class="item-count">${item.count}x</span>
                                <span class="item-name">${item.name.replace(/_/g, ' ')}</span>
                                <button class="btn-fetch" onclick="requestItem('${item.name}', '${chest.x}', '${chest.y}', '${chest.z}')" style="margin-top: 5px;">Getir</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            accordion.appendChild(groupDiv);
        }
    });

    // Tüm Eşyalar (Grid) UI
    const sortedItems = Object.entries(aggregatedItems).sort((a, b) => b[1] - a[1]);
    
    if (sortedItems.length === 0) {
        grid.innerHTML = '<div class="loading-text">Aramanızla eşleşen eşya bulunamadı.</div>';
    } else {
        sortedItems.forEach(([name, count]) => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <img src="https://static.minecraftitemids.com/32/${name.toLowerCase()}.png" class="item-img" onerror="this.src='https://static.minecraftitemids.com/32/chest.png'" alt="${name}">
                <span class="item-count">${count}x</span>
                <span class="item-name">${name.replace(/_/g, ' ')}</span>
            `;
            grid.appendChild(card);
        });
    }
}

// Search functionality
document.getElementById('item-search').addEventListener('input', (e) => {
    renderChests(e.target.value);
});

function requestItem(itemName, x, y, z) {
    alert(`Sandıktaki ${itemName} eşyasını alma özelliği yakında eklenecek! Koordinat: ${x}, ${y}, ${z}`);
}

document.getElementById('refresh-chests').addEventListener('click', loadChests);

// --- COURIER SYSTEM LOGIC ---
const radioPlayer = document.querySelector('input[name="targetType"][value="player"]');
const radioCoord = document.querySelector('input[name="targetType"][value="coordinate"]');
const containerPlayer = document.getElementById('target-player-container');
const containerCoord = document.getElementById('target-coord-container');
const btnFetchCourier = document.getElementById('btn-fetch-courier');
const courierStatus = document.getElementById('courier-status');
const courierItemInput = document.getElementById('courier-item');
const autocompleteList = document.getElementById('autocomplete-list');

// Toggle Input Fields
radioPlayer.addEventListener('change', () => {
    containerPlayer.style.display = 'flex';
    containerCoord.style.display = 'none';
});
radioCoord.addEventListener('change', () => {
    containerPlayer.style.display = 'none';
    containerCoord.style.display = 'flex';
});

// Autocomplete Logic
courierItemInput.addEventListener('input', function() {
    const val = this.value.toLowerCase();
    autocompleteList.innerHTML = '';
    
    if (!val) return;

    // Aggregate items from all chests
    const aggregated = {};
    allChestsData.forEach(chest => {
        chest.items.forEach(item => {
            if (aggregated[item.name]) aggregated[item.name] += item.count;
            else aggregated[item.name] = item.count;
        });
    });

    const matches = Object.entries(aggregated).filter(([name]) => name.toLowerCase().includes(val));
    
    matches.slice(0, 10).forEach(([name, count]) => {
        const div = document.createElement('div');
        div.innerHTML = `<span><img src="https://static.minecraftitemids.com/32/${name.toLowerCase()}.png" style="width:20px; vertical-align:middle; margin-right:8px;" onerror="this.style.display='none'">${name.replace(/_/g, ' ')}</span> <span class="item-stock">Stok: ${count}</span>`;
        div.addEventListener('click', () => {
            courierItemInput.value = name;
            autocompleteList.innerHTML = '';
        });
        autocompleteList.appendChild(div);
    });
});

// Close autocomplete when clicking outside
document.addEventListener('click', (e) => {
    if (e.target !== courierItemInput) {
        autocompleteList.innerHTML = '';
    }
});

// Submit Courier Request
btnFetchCourier.addEventListener('click', () => {
    const itemName = courierItemInput.value.trim();
    const amount = document.getElementById('courier-amount').value;
    const targetType = document.querySelector('input[name="targetType"]:checked').value;
    
    if (!itemName || !amount) {
        alert("Lütfen eşya adı ve miktarını giriniz.");
        return;
    }

    let targetData = null;
    if (targetType === 'player') {
        targetData = document.getElementById('courier-player').value.trim();
        if (!targetData) return alert("Lütfen oyuncu adı giriniz.");
    } else {
        const x = document.getElementById('coord-x').value;
        const y = document.getElementById('coord-y').value;
        const z = document.getElementById('coord-z').value;
        if (!x || !y || !z) return alert("Lütfen tam koordinat (X, Y, Z) giriniz.");
        targetData = { x, y, z };
    }

    courierStatus.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>İstek gönderiliyor...</span>`;
    btnFetchCourier.disabled = true;

    socket.emit('fetch_item', {
        itemName,
        amount: parseInt(amount),
        targetType,
        targetData
    });
});

// Receive Courier Status
socket.on('courier_status', (res) => {
    if (res.success === null) {
        courierStatus.innerHTML = `<i class="fas fa-spinner fa-spin" style="color:var(--primary-color)"></i> <span>${res.message}</span>`;
    } else if (res.success) {
        courierStatus.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981"></i> <span style="color:#10b981">${res.message}</span>`;
        btnFetchCourier.disabled = false;
        // Stoklar güncellenmiş olabilir
        loadChests();
    } else {
        courierStatus.innerHTML = `<i class="fas fa-times-circle" style="color:#ef4444"></i> <span style="color:#ef4444">${res.message}</span>`;
        btnFetchCourier.disabled = false;
    }
});
