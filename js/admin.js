/* ============================================
   PET PAWS JOURNEY — ADMIN DASHBOARD
   Auth, CRUD for shipments, tracking updates
   + EmailJS notifications to client & admin
   ============================================ */

// ---- EmailJS Configuration ----
const EMAILJS_PUBLIC_KEY  = 'XXxDKJxYUGQBuhP2w';
const EMAILJS_SERVICE_ID  = 'service_whqk61h';
const EMAILJS_TEMPLATE_ID = 'template_3o1p4qm';
const ADMIN_EMAIL = 'petpawsjourney@gmail.com';

let currentPanel = 'overview';
let shipments = [];
let editingShipmentId = null;
let originMapPicker = null, destMapPicker = null;
let originPickerMarker = null, destPickerMarker = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize EmailJS
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // Check authentication
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'admin-login.html';
    return;
  }

  // Set user info in sidebar
  const user = session.user;
  const nameEl = document.querySelector('.sidebar-user-name');
  const emailEl = document.querySelector('.sidebar-user-email');
  const avatarEl = document.querySelector('.sidebar-user-avatar');
  if (nameEl) nameEl.textContent = user.user_metadata?.full_name || 'Admin';
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent = (user.email || 'A')[0].toUpperCase();

  // Navigation
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const panel = item.getAttribute('data-panel');
      switchPanel(panel);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'admin-login.html';
  });

  // Sidebar toggle (mobile)
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Initialize
  await loadDashboard();

  // Create shipment form
  const createForm = document.getElementById('createShipmentForm');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateShipment);
  }

  // Generate tracking code
  const genBtn = document.getElementById('generateCodeBtn');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      document.getElementById('trackingCodeInput').value = generateTrackingCode();
    });
    // Auto-generate on page load
    document.getElementById('trackingCodeInput').value = generateTrackingCode();
  }

  // Shipment table search
  const searchInput = document.getElementById('shipmentSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      renderShipmentsTable(shipments.filter(s =>
        s.tracking_code.toLowerCase().includes(query) ||
        s.pet_name.toLowerCase().includes(query) ||
        s.client_name.toLowerCase().includes(query)
      ));
    });
  }
});


// ---- Switch Dashboard Panel ----
function switchPanel(panelName) {
  currentPanel = panelName;
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-panel') === panelName);
  });
  document.querySelectorAll('.dashboard-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'panel-' + panelName);
  });

  // Update header
  const titles = {
    overview: 'Dashboard Overview',
    shipments: 'All Shipments',
    create: 'Create Shipment',
    messages: 'Contact Messages'
  };
  const headerTitle = document.querySelector('.dashboard-header h1');
  if (headerTitle) headerTitle.textContent = titles[panelName] || 'Dashboard';

  // Load panel data
  if (panelName === 'shipments') loadShipments();
  if (panelName === 'messages') loadMessages();
  if (panelName === 'create') initMapPickers();
}


// ---- Load Dashboard Overview ----
async function loadDashboard() {
  try {
    const { data, error } = await supabaseClient
      .from('pet_shipments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    shipments = data || [];

    // Calculate stats
    const total = shipments.length;
    const inTransit = shipments.filter(s => s.current_status === 'in_transit').length;
    const delivered = shipments.filter(s => s.current_status === 'delivered').length;
    const pending = shipments.filter(s => s.current_status === 'order_created').length;

    // Update stat cards
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statTransit').textContent = inTransit;
    document.getElementById('statDelivered').textContent = delivered;
    document.getElementById('statPending').textContent = pending;

    // Show recent shipments in overview
    renderShipmentsTable(shipments.slice(0, 5), 'recentShipmentsTable');

  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard data.', 'error');
  }
}


// ---- Load All Shipments ----
async function loadShipments() {
  try {
    const { data, error } = await supabaseClient
      .from('pet_shipments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    shipments = data || [];
    renderShipmentsTable(shipments, 'allShipmentsTable');
  } catch (err) {
    console.error('Load shipments error:', err);
  }
}


// ---- Render Shipments Table ----
function renderShipmentsTable(data, tableId = 'allShipmentsTable') {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">
          No shipments found
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td><span class="tracking-code">${s.tracking_code}</span></td>
      <td>${s.pet_name}</td>
      <td>${s.pet_type}</td>
      <td>${s.client_name}</td>
      <td><span class="status-badge ${getStatusClass(s.current_status)}">${getStatusLabel(s.current_status)}</span></td>
      <td>${formatDate(s.created_at)}</td>
      <td>
        <div class="table-actions">
          <button class="table-btn edit" title="Edit" onclick="editShipment('${s.id}')">
            ${SVG_ICONS.eye}
          </button>
          <button class="table-btn update" title="Add Update" onclick="openUpdateModal('${s.id}')">
            ${SVG_ICONS.mapPin}
          </button>
          <button class="table-btn delete" title="Delete" onclick="deleteShipment('${s.id}')">
            ${SVG_ICONS.x}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}


// ---- Create Shipment Handler ----
async function handleCreateShipment(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Creating...';

  const shipmentData = {
    tracking_code: document.getElementById('trackingCodeInput').value.trim(),
    client_name: document.getElementById('clientName').value.trim(),
    client_email: document.getElementById('clientEmail').value.trim(),
    client_phone: document.getElementById('clientPhone').value.trim() || null,
    shipper_name: document.getElementById('shipperName').value.trim(),
    shipper_email: document.getElementById('shipperEmail').value.trim(),
    shipper_phone: document.getElementById('shipperPhone').value.trim(),
    pet_name: document.getElementById('petName').value.trim(),
    pet_type: document.getElementById('petType').value,
    pet_breed: document.getElementById('petBreed').value.trim() || null,
    pet_image_url: document.getElementById('petImageUrl').value.trim() || null,
    origin_address: document.getElementById('originAddress').value.trim(),
    origin_lat: parseFloat(document.getElementById('originLat').value) || null,
    origin_lng: parseFloat(document.getElementById('originLng').value) || null,
    destination_address: document.getElementById('destAddress').value.trim(),
    destination_lat: parseFloat(document.getElementById('destLat').value) || null,
    destination_lng: parseFloat(document.getElementById('destLng').value) || null,
    current_lat: parseFloat(document.getElementById('originLat').value) || null,
    current_lng: parseFloat(document.getElementById('originLng').value) || null,
    estimated_delivery: document.getElementById('estDelivery').value || null,
    special_notes: document.getElementById('specialNotes').value.trim() || null,
    current_status: document.getElementById('shipmentStatus').value,
    packaging_type: document.getElementById('packagingType').value,
    package_weight: parseFloat(document.getElementById('packageWeight').value) || null
  };

  // Validate required fields
  if (!shipmentData.tracking_code || !shipmentData.client_name || !shipmentData.client_email ||
      !shipmentData.pet_name || !shipmentData.pet_type || !shipmentData.origin_address ||
      !shipmentData.destination_address) {
    showToast('Please fill in all required fields.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('pet_shipments')
      .insert([shipmentData])
      .select()
      .single();

    if (error) throw error;

    // Create initial tracking update (Order Created)
    await supabaseClient
      .from('pet_tracking_updates')
      .insert([{
        shipment_id: data.id,
        status: 'order_created',
        location_address: shipmentData.origin_address,
        lat: shipmentData.origin_lat,
        lng: shipmentData.origin_lng,
        description: 'Shipment order has been created and confirmed.'
      }]);

    showToast(`Shipment created! Code: ${data.tracking_code}`, 'success');

    // Send email notifications to BOTH client and admin
    await notifyShipmentCreated(shipmentData);

    form.reset();
    document.getElementById('trackingCodeInput').value = generateTrackingCode();
    
    // Reload dashboard
    await loadDashboard();

  } catch (err) {
    console.error('Create shipment error:', err);
    showToast('Failed to create shipment: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}


// ---- Edit Shipment (Modal) ----
async function editShipment(id) {
  editingShipmentId = id;
  const shipment = shipments.find(s => s.id === id);
  if (!shipment) return;

  // Populate modal fields
  const modal = document.getElementById('editModal');
  document.getElementById('editClientName').value = shipment.client_name;
  document.getElementById('editClientEmail').value = shipment.client_email;
  document.getElementById('editClientPhone').value = shipment.client_phone || '';
  document.getElementById('editPetName').value = shipment.pet_name;
  document.getElementById('editPetType').value = shipment.pet_type;
  document.getElementById('editPetBreed').value = shipment.pet_breed || '';
  document.getElementById('editPetImageUrl').value = shipment.pet_image_url || '';
  document.getElementById('editEstDelivery').value = shipment.estimated_delivery ? shipment.estimated_delivery.split('T')[0] : '';
  document.getElementById('editSpecialNotes').value = shipment.special_notes || '';
  document.getElementById('editStatus').value = shipment.current_status;
  document.getElementById('editPackagingType').value = shipment.packaging_type || '';
  document.getElementById('editPackageWeight').value = shipment.package_weight || '';
  document.getElementById('editTrackingCode').textContent = shipment.tracking_code;

  modal.classList.add('visible');
}

// Save edited shipment
async function saveEditShipment() {
  if (!editingShipmentId) return;

  const updateData = {
    client_name: document.getElementById('editClientName').value.trim(),
    client_email: document.getElementById('editClientEmail').value.trim(),
    client_phone: document.getElementById('editClientPhone').value.trim() || null,
    pet_name: document.getElementById('editPetName').value.trim(),
    pet_type: document.getElementById('editPetType').value,
    pet_breed: document.getElementById('editPetBreed').value.trim() || null,
    pet_image_url: document.getElementById('editPetImageUrl').value.trim() || null,
    estimated_delivery: document.getElementById('editEstDelivery').value || null,
    special_notes: document.getElementById('editSpecialNotes').value.trim() || null,
    current_status: document.getElementById('editStatus').value,
    packaging_type: document.getElementById('editPackagingType').value,
    package_weight: parseFloat(document.getElementById('editPackageWeight').value) || null,
    updated_at: new Date().toISOString()
  };

  try {
    const shipment = shipments.find(s => s.id === editingShipmentId);
    const oldStatus = shipment ? shipment.current_status : null;

    const { error } = await supabaseClient
      .from('pet_shipments')
      .update(updateData)
      .eq('id', editingShipmentId);

    if (error) throw error;

    // If the status changed, notify client & admin
    if (shipment && oldStatus !== updateData.current_status) {
      await notifyStatusChanged(shipment, updateData.current_status);
    }

    showToast('Shipment updated successfully.', 'success');
    closeModal('editModal');
    await loadShipments();
    await loadDashboard();
  } catch (err) {
    console.error('Edit shipment error:', err);
    showToast('Failed to update shipment.', 'error');
  }
}


// ---- Delete Shipment ----
async function deleteShipment(id) {
  const confirmed = confirm('Are you sure you want to delete this shipment? This action cannot be undone.');
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient
      .from('pet_shipments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Shipment deleted.', 'success');
    await loadShipments();
    await loadDashboard();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete shipment.', 'error');
  }
}


// ---- Add Tracking Update (Modal) ----
let updatingShipmentId = null;

function openUpdateModal(id) {
  updatingShipmentId = id;
  const shipment = shipments.find(s => s.id === id);
  document.getElementById('updateTrackingCode').textContent = shipment ? shipment.tracking_code : '';
  document.getElementById('updateModal').classList.add('visible');
  
  // Initialize update map picker
  setTimeout(() => initUpdateMapPicker(), 200);
}

async function saveTrackingUpdate() {
  if (!updatingShipmentId) return;

  const updateData = {
    shipment_id: updatingShipmentId,
    status: document.getElementById('updateStatus').value,
    location_address: document.getElementById('updateLocation').value.trim(),
    lat: parseFloat(document.getElementById('updateLat').value) || null,
    lng: parseFloat(document.getElementById('updateLng').value) || null,
    description: document.getElementById('updateDescription').value.trim()
  };

  try {
    // Insert tracking update
    const { error: updateError } = await supabaseClient
      .from('pet_tracking_updates')
      .insert([updateData]);

    if (updateError) throw updateError;

    // Update shipment status and current position
    const shipmentUpdate = {
      current_status: updateData.status,
      updated_at: new Date().toISOString()
    };

    if (updateData.lat && updateData.lng) {
      shipmentUpdate.current_lat = updateData.lat;
      shipmentUpdate.current_lng = updateData.lng;
    }

    const { error: shipError } = await supabaseClient
      .from('pet_shipments')
      .update(shipmentUpdate)
      .eq('id', updatingShipmentId);

    if (shipError) throw shipError;

    // Notify client & admin about the tracking update
    const shipment = shipments.find(s => s.id === updatingShipmentId);
    if (shipment) {
      await notifyTrackingUpdate(shipment, updateData);
    }

    showToast('Tracking update added successfully.', 'success');
    closeModal('updateModal');

    // Reset form
    document.getElementById('updateStatus').value = 'in_transit';
    document.getElementById('updateLocation').value = '';
    document.getElementById('updateLat').value = '';
    document.getElementById('updateLng').value = '';
    document.getElementById('updateDescription').value = '';

    await loadShipments();
    await loadDashboard();
  } catch (err) {
    console.error('Tracking update error:', err);
    showToast('Failed to add tracking update.', 'error');
  }
}


// ---- Load Contact Messages ----
async function loadMessages() {
  try {
    const { data, error } = await supabaseClient
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('messagesList');
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${SVG_ICONS.mail}
          <h3>No messages yet</h3>
          <p>Contact messages will appear here.</p>
        </div>`;
      return;
    }

    container.innerHTML = data.map(msg => `
      <div class="message-item ${msg.is_read ? '' : 'unread'}" onclick="markMessageRead('${msg.id}', this)">
        <div class="message-avatar">${msg.name[0].toUpperCase()}</div>
        <div class="message-content">
          <h4>${msg.name} — ${msg.subject}</h4>
          <p>${msg.message}</p>
        </div>
        <div class="message-meta">
          <span class="message-time">${formatDateTime(msg.created_at)}</span>
          ${!msg.is_read ? '<div class="message-unread-dot"></div>' : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load messages error:', err);
  }
}

async function markMessageRead(id, el) {
  try {
    await supabaseClient.from('contact_messages').update({ is_read: true }).eq('id', id);
    el.classList.remove('unread');
    const dot = el.querySelector('.message-unread-dot');
    if (dot) dot.remove();
  } catch (err) {
    console.error('Mark read error:', err);
  }
}


// ---- Google Maps Pickers for Admin ----
function initMapPickers() {
  if (typeof google === 'undefined' || !google.maps) return;

  // Origin map picker
  const originMapEl = document.getElementById('originMapPicker');
  if (originMapEl && !originMapPicker) {
    originMapPicker = new google.maps.Map(originMapEl, {
      center: { lat: 40.7128, lng: -74.0060 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false
    });

    originMapPicker.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      document.getElementById('originLat').value = lat.toFixed(6);
      document.getElementById('originLng').value = lng.toFixed(6);

      if (originPickerMarker) originPickerMarker.setMap(null);
      originPickerMarker = new google.maps.Marker({
        position: e.latLng,
        map: originMapPicker,
        title: 'Origin'
      });
    });

    // Places autocomplete for origin
    const originInput = document.getElementById('originAddress');
    if (originInput && google.maps.places) {
      const autocomplete = new google.maps.places.Autocomplete(originInput);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          document.getElementById('originLat').value = lat.toFixed(6);
          document.getElementById('originLng').value = lng.toFixed(6);
          originMapPicker.setCenter(place.geometry.location);
          originMapPicker.setZoom(12);

          if (originPickerMarker) originPickerMarker.setMap(null);
          originPickerMarker = new google.maps.Marker({
            position: place.geometry.location,
            map: originMapPicker
          });
        }
      });
    }
  }

  // Destination map picker
  const destMapEl = document.getElementById('destMapPicker');
  if (destMapEl && !destMapPicker) {
    destMapPicker = new google.maps.Map(destMapEl, {
      center: { lat: 40.7128, lng: -74.0060 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false
    });

    destMapPicker.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      document.getElementById('destLat').value = lat.toFixed(6);
      document.getElementById('destLng').value = lng.toFixed(6);

      if (destPickerMarker) destPickerMarker.setMap(null);
      destPickerMarker = new google.maps.Marker({
        position: e.latLng,
        map: destMapPicker,
        title: 'Destination'
      });
    });

    // Places autocomplete for destination
    const destInput = document.getElementById('destAddress');
    if (destInput && google.maps.places) {
      const autocomplete = new google.maps.places.Autocomplete(destInput);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          document.getElementById('destLat').value = lat.toFixed(6);
          document.getElementById('destLng').value = lng.toFixed(6);
          destMapPicker.setCenter(place.geometry.location);
          destMapPicker.setZoom(12);

          if (destPickerMarker) destPickerMarker.setMap(null);
          destPickerMarker = new google.maps.Marker({
            position: place.geometry.location,
            map: destMapPicker
          });
        }
      });
    }
  }
}

// Update modal map picker
let updateMapPicker = null, updatePickerMarker = null;

function initUpdateMapPicker() {
  if (typeof google === 'undefined' || !google.maps) return;

  const mapEl = document.getElementById('updateMapPicker');
  if (!mapEl) return;

  updateMapPicker = new google.maps.Map(mapEl, {
    center: { lat: 40.7128, lng: -74.0060 },
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false
  });

  updateMapPicker.addListener('click', (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    document.getElementById('updateLat').value = lat.toFixed(6);
    document.getElementById('updateLng').value = lng.toFixed(6);

    if (updatePickerMarker) updatePickerMarker.setMap(null);
    updatePickerMarker = new google.maps.Marker({
      position: e.latLng,
      map: updateMapPicker
    });
  });
}


// ---- Modal Helpers ----
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('visible');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('visible');
  }
});


// ============================================
// EMAIL NOTIFICATION SYSTEM (EmailJS)
// Sends professional emails to BOTH client & admin
// ============================================

function getStatusEmoji(status) {
  const emojis = {
    pending: '⏳',
    order_created: '📋',
    picked_up: '📦',
    in_transit: '🚚',
    on_hold: '⚠️',
    out_for_delivery: '🏠',
    delivered: '✅'
  };
  return emojis[status] || '📌';
}

// Helper: send email to one recipient (non-blocking)
async function sendEmail(toEmail, subject, messageBody) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS not loaded — skipping email.');
    return;
  }
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: toEmail,
      email_subject: subject,
      from_name: 'Pet Paws Journey',
      from_email: ADMIN_EMAIL,
      from_phone: '+1 (470) 494-2387',
      subject: subject,
      message: messageBody,
      date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
    console.log(`Email sent to ${toEmail}`);
  } catch (err) {
    console.error(`Email to ${toEmail} failed:`, err);
  }
}


// ---- 1. SHIPMENT CREATED NOTIFICATION ----
async function notifyShipmentCreated(shipmentData) {
  const trackingUrl = `${window.location.origin}/track.html?code=${shipmentData.tracking_code}`;

  const clientMessage = `
Hello ${shipmentData.client_name},

Great news! Your pet transport shipment has been created with Pet Paws Journey.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SHIPMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Tracking Code: ${shipmentData.tracking_code}
🐾 Pet Name: ${shipmentData.pet_name}
🐕 Pet Type: ${shipmentData.pet_type}${shipmentData.pet_breed ? ' (' + shipmentData.pet_breed + ')' : ''}
📍 Origin: ${shipmentData.origin_address}
📍 Destination: ${shipmentData.destination_address}
📅 Est. Delivery: ${shipmentData.estimated_delivery || 'To be confirmed'}
📌 Status: Order Created

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Track your pet live: ${trackingUrl}

You will receive email notifications whenever your pet's status is updated.

If you have any questions, please contact us:
📧 Email: petpawsjourney@gmail.com
📞 Phone: +1 (470) 494-2387

Thank you for choosing Pet Paws Journey!
— The Pet Paws Journey Team`;

  const adminMessage = `
📦 NEW SHIPMENT CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Tracking: ${shipmentData.tracking_code}
🐾 Pet: ${shipmentData.pet_name} (${shipmentData.pet_type})
👤 Client: ${shipmentData.client_name}
📧 Client Email: ${shipmentData.client_email}
📞 Client Phone: ${shipmentData.client_phone || 'N/A'}
📍 From: ${shipmentData.origin_address}
📍 To: ${shipmentData.destination_address}
📅 Est. Delivery: ${shipmentData.estimated_delivery || 'TBD'}
${shipmentData.special_notes ? '📝 Notes: ' + shipmentData.special_notes : ''}

Client has been notified via email.`;

  // Send sequentially to prevent rate-limiting drops
  await sendEmail(shipmentData.client_email, `🐾 Shipment Confirmed — ${shipmentData.tracking_code} | Pet Paws Journey`, clientMessage);
  await sendEmail(shipmentData.shipper_email, `📦 Admin Alert: New Shipment Created — ${shipmentData.tracking_code} | ${shipmentData.client_name}`, adminMessage);
}


// ---- 2. STATUS CHANGED NOTIFICATION (via Edit Modal) ----
async function notifyStatusChanged(shipment, newStatus) {
  const emoji = getStatusEmoji(newStatus);
  const statusLabel = getStatusLabel(newStatus);
  const trackingUrl = `${window.location.origin}/track.html?code=${shipment.tracking_code}`;

  const clientMessage = `
Hello ${shipment.client_name},

Your pet transport shipment has been updated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emoji} STATUS UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Tracking Code: ${shipment.tracking_code}
🐾 Pet Name: ${shipment.pet_name}
📌 New Status: ${statusLabel}
📅 Updated: ${new Date().toLocaleString('en-US')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Track your pet live: ${trackingUrl}

If you have any questions, contact us:
📧 Email: petpawsjourney@gmail.com
📞 Phone: +1 (470) 494-2387

— The Pet Paws Journey Team`;

  const adminMessage = `
${emoji} STATUS CHANGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Tracking: ${shipment.tracking_code}
🐾 Pet: ${shipment.pet_name}
👤 Client: ${shipment.client_name} (${shipment.client_email})
📌 Previous Status: ${getStatusLabel(shipment.current_status)}
📌 New Status: ${statusLabel}

Client has been notified via email.`;

  // Send sequentially
  await sendEmail(shipment.client_email, `${emoji} ${shipment.pet_name} — Status: ${statusLabel} | Pet Paws Journey`, clientMessage);
  await sendEmail(shipment.shipper_email, `🛑 Admin Alert: ${emoji} Status Update — ${shipment.tracking_code} → ${statusLabel}`, adminMessage);
}


// ---- 3. TRACKING UPDATE NOTIFICATION (via Update Modal) ----
async function notifyTrackingUpdate(shipment, updateData) {
  const emoji = getStatusEmoji(updateData.status);
  const statusLabel = getStatusLabel(updateData.status);
  const trackingUrl = `${window.location.origin}/track.html?code=${shipment.tracking_code}`;

  const clientMessage = `
Hello ${shipment.client_name},

We have a new tracking update for your pet!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emoji} TRACKING UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Tracking Code: ${shipment.tracking_code}
🐾 Pet Name: ${shipment.pet_name}
📌 Status: ${statusLabel}
📍 Location: ${updateData.location_address || 'In transit'}
💬 Details: ${updateData.description || 'No additional details.'}
📅 Time: ${new Date().toLocaleString('en-US')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Track your pet live: ${trackingUrl}

Your pet is in safe hands with Pet Paws Journey!

📧 Questions? Contact: petpawsjourney@gmail.com
📞 Phone: +1 (470) 494-2387

— The Pet Paws Journey Team`;

  const adminMessage = `
${emoji} TRACKING UPDATE ADDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 Tracking: ${shipment.tracking_code}
🐾 Pet: ${shipment.pet_name}
👤 Client: ${shipment.client_name} (${shipment.client_email})
📌 Status: ${statusLabel}
📍 Location: ${updateData.location_address || 'N/A'}
💬 Description: ${updateData.description || 'None'}

Client has been notified via email.`;

  // Send sequentially
  await sendEmail(shipment.client_email, `${emoji} ${shipment.pet_name} — Tracking Update | Pet Paws Journey`, clientMessage);
  await sendEmail(shipment.shipper_email, `🛑 Admin Alert: ${emoji} Tracking Update — ${shipment.tracking_code} | ${statusLabel}`, adminMessage);
}
