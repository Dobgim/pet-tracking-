/* ============================================
   PET PAWS JOURNEY — TRACK PAGE (Enhanced)
   Professional invoice receipt, live map with
   status-based animation, real-time updates
   ============================================ */

let map, routePath, animatedMarker, originMarker, destMarker;
let animationFrame = null;
let currentShipment = null;
let currentUpdates = [];
let animationProgress = 0;
let animationPaused = false;
let realtimeSubscription = null;

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('trackSearchForm');
  const searchInput = document.getElementById('trackInput');

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = searchInput.value.trim().toUpperCase();
      if (code) {
        trackShipment(code);
      }
    });
  }

  // Check URL params for tracking code
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get('code');
  if (codeParam) {
    searchInput.value = codeParam;
    trackShipment(codeParam.toUpperCase());
  }
});


// ---- Main tracking function ----
async function trackShipment(trackingCode) {
  const loadingEl = document.getElementById('trackLoading');
  const resultsEl = document.getElementById('trackResults');
  const errorEl = document.getElementById('trackError');

  // Show loading, hide others
  loadingEl.classList.add('visible');
  resultsEl.classList.remove('visible');
  errorEl.classList.remove('visible');

  // Cancel previous real-time subscription
  if (realtimeSubscription) {
    supabaseClient.removeChannel(realtimeSubscription);
    realtimeSubscription = null;
  }

  try {
    // Fetch shipment from Supabase
    const { data: shipment, error } = await supabaseClient
      .from('pet_shipments')
      .select('*')
      .eq('tracking_code', trackingCode)
      .single();

    if (error || !shipment) {
      loadingEl.classList.remove('visible');
      errorEl.classList.add('visible');
      return;
    }

    currentShipment = shipment;

    // Fetch tracking updates
    const { data: updates } = await supabaseClient
      .from('pet_tracking_updates')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('timestamp', { ascending: true });

    currentUpdates = updates || [];

    // Hide loading, show results
    loadingEl.classList.remove('visible');
    resultsEl.classList.add('visible');

    // Render all sections
    renderInvoiceReceipt(shipment);
    renderTimeline(shipment, currentUpdates);
    initTrackingMap(shipment, currentUpdates);
    updateLiveStatusBanner(shipment);

    // Subscribe to real-time updates
    subscribeToRealtime(shipment);

  } catch (err) {
    console.error('Tracking error:', err);
    loadingEl.classList.remove('visible');
    errorEl.classList.add('visible');
  }
}


// ============================================
// PROFESSIONAL INVOICE RECEIPT
// ============================================
function renderInvoiceReceipt(shipment) {
  const container = document.getElementById('invoiceReceipt');
  const createdDate = new Date(shipment.created_at);
  const formattedDate = createdDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = createdDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const estDelivery = shipment.estimated_delivery
    ? new Date(shipment.estimated_delivery).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'To be confirmed';

  const statusEmoji = {
    pending: '⏳', order_created: '📋', picked_up: '📦', in_transit: '🚚',
    on_hold: '⚠️', out_for_delivery: '🏠', delivered: '✅'
  };

  container.innerHTML = `
    <!-- Invoice Header -->
    <div class="invoice-header">
      <div class="invoice-logo">
        <svg viewBox="0 0 36 36" fill="currentColor" width="28" height="28">
          <ellipse cx="10" cy="8" rx="3.5" ry="4.5"/><ellipse cx="26" cy="8" rx="3.5" ry="4.5"/>
          <ellipse cx="5" cy="19" rx="3" ry="3.5"/><ellipse cx="31" cy="19" rx="3" ry="3.5"/>
          <path d="M18 34c-5 0-8-3.5-8-7.5 0-3 3.5-6 8-6s8 3 8 6c0 4-3 7.5-8 7.5z"/>
        </svg>
        <div>
          <div class="invoice-company">Pet Paws Journey</div>
          <div class="invoice-subtitle">Transport Receipt</div>
        </div>
      </div>
      <div class="invoice-badge ${shipment.current_status}">
        ${statusEmoji[shipment.current_status] || '📌'} ${getStatusLabel(shipment.current_status)}
      </div>
    </div>

    <!-- Tracking Code Highlight -->
    <div class="invoice-tracking-code">
      <div class="invoice-tracking-label">TRACKING CODE</div>
      <div class="invoice-tracking-value">${shipment.tracking_code}</div>
    </div>

    <!-- Pet Details -->
    <div class="invoice-section">
      <div class="invoice-section-title">
        <svg viewBox="0 0 36 36" fill="currentColor" width="16" height="16"><ellipse cx="10" cy="8" rx="3.5" ry="4.5"/><ellipse cx="26" cy="8" rx="3.5" ry="4.5"/><ellipse cx="5" cy="19" rx="3" ry="3.5"/><ellipse cx="31" cy="19" rx="3" ry="3.5"/><path d="M18 34c-5 0-8-3.5-8-7.5 0-3 3.5-6 8-6s8 3 8 6c0 4-3 7.5-8 7.5z"/></svg>
        Pet Information
      </div>
      ${shipment.pet_image_url ? `<div class="invoice-pet-image"><img src="${shipment.pet_image_url}" alt="${shipment.pet_name}"></div>` : ''}
      <div class="invoice-grid">
        <div class="invoice-field">
          <span class="invoice-field-label">Pet Name</span>
          <span class="invoice-field-value">${shipment.pet_name}</span>
        </div>
        <div class="invoice-field">
          <span class="invoice-field-label">Type</span>
          <span class="invoice-field-value">${shipment.pet_type}</span>
        </div>
        ${shipment.pet_breed ? `
        <div class="invoice-field">
          <span class="invoice-field-label">Breed</span>
          <span class="invoice-field-value">${shipment.pet_breed}</span>
        </div>` : ''}
        ${shipment.packaging_type ? `
        <div class="invoice-field">
          <span class="invoice-field-label">Packaging</span>
          <span class="invoice-field-value">${shipment.packaging_type}</span>
        </div>` : ''}
        ${shipment.package_weight ? `
        <div class="invoice-field">
          <span class="invoice-field-label">Weight</span>
          <span class="invoice-field-value">${shipment.package_weight} kg</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Route Details -->
    <div class="invoice-section">
      <div class="invoice-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Route Details
      </div>
      <div class="invoice-route">
        <div class="invoice-route-point">
          <div class="route-dot origin"></div>
          <div>
            <div class="invoice-field-label">Origin</div>
            <div class="invoice-field-value">${shipment.origin_address}</div>
          </div>
        </div>
        <div class="invoice-route-line"></div>
        <div class="invoice-route-point">
          <div class="route-dot destination"></div>
          <div>
            <div class="invoice-field-label">Destination</div>
            <div class="invoice-field-value">${shipment.destination_address}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Client & Dates -->
    <div class="invoice-section">
      <div class="invoice-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Shipment Information
      </div>
      <div class="invoice-grid">
        <div class="invoice-field">
          <span class="invoice-field-label">Client</span>
          <span class="invoice-field-value">${shipment.client_name}</span>
        </div>
        <div class="invoice-field">
          <span class="invoice-field-label">Shipper</span>
          <span class="invoice-field-value">${shipment.shipper_name}</span>
        </div>
        <div class="invoice-field">
          <span class="invoice-field-label">Created</span>
          <span class="invoice-field-value">${formattedDate}, ${formattedTime}</span>
        </div>
        <div class="invoice-field">
          <span class="invoice-field-label">Est. Delivery</span>
          <span class="invoice-field-value highlight">${estDelivery}</span>
        </div>
      </div>
      ${shipment.special_notes ? `
      <div class="invoice-notes">
        <strong>Notes:</strong> ${shipment.special_notes}
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="invoice-footer-line">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        petpawsjourney@gmail.com
      </div>
      <div class="invoice-footer-line">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        +1 (470) 494-2387
      </div>
      <div class="invoice-watermark">Pet Paws Journey — Premium Pet Transport</div>
    </div>

    <!-- Print Button -->
    <button class="invoice-print-btn" onclick="window.print()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print Receipt
    </button>
  `;
}


// ============================================
// TRACKING TIMELINE
// ============================================
function renderTimeline(shipment, updates) {
  const container = document.getElementById('trackTimeline');
  const statusOrder = ['order_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  let currentIndex = statusOrder.indexOf(shipment.current_status);
  
  // If status is pending or on_hold, determine visual progress
  if (currentIndex === -1) {
    if (shipment.current_status === 'pending') currentIndex = 0;
    else if (shipment.current_status === 'on_hold') {
      // Find highest completed status for 'on hold'
      const foundIdx = statusOrder.slice().reverse().findIndex(s => updates.some(u => u.status === s));
      currentIndex = foundIdx !== -1 ? (statusOrder.length - 1 - foundIdx) : 1; 
    }
  }

  // Map updates by status
  const updatesByStatus = {};
  updates.forEach(u => { updatesByStatus[u.status] = u; });

  const stepsHTML = statusOrder.map((status, i) => {
    let stepClass = 'pending';
    if (i < currentIndex) stepClass = 'completed';
    else if (i === currentIndex) stepClass = 'active';

    const update = updatesByStatus[status];
    const icon = stepClass === 'completed' ? SVG_ICONS.check :
                 stepClass === 'active' ? SVG_ICONS.activity :
                 SVG_ICONS.clock;

    return `
      <div class="timeline-step ${stepClass}">
        <div class="timeline-dot">${icon}</div>
        <div class="timeline-step-title">${getStatusLabel(status)}</div>
        ${update ? `
          <div class="timeline-step-info">${formatDateTime(update.timestamp)}</div>
          ${update.location_address ? `
            <div class="timeline-step-location">
              ${SVG_ICONS.mapPin} ${update.location_address}
            </div>` : ''}
          ${update.description ? `
            <div class="timeline-step-info" style="margin-top:4px">${update.description}</div>` : ''}
        ` : `<div class="timeline-step-info">Pending</div>`}
      </div>
    `;
  }).join('');

  const fillPercent = currentIndex / (statusOrder.length - 1) * 100;

  container.innerHTML = `
    <h3>Tracking Timeline</h3>
    <div class="timeline-steps">
      <div class="timeline-line"></div>
      <div class="timeline-line-filled" style="height: ${fillPercent}%"></div>
      ${stepsHTML}
    </div>
  `;
}


// ============================================
// LIVE STATUS BANNER
// ============================================
function updateLiveStatusBanner(shipment) {
  const banner = document.getElementById('liveStatusBanner');
  const text = document.getElementById('liveStatusText');
  const statusBar = document.getElementById('mapStatusText');

  const statusMessages = {
    pending: { text: '⏳ Pending Approval — Processing Shipment', color: '#64748b', map: '⏳ Setting up shipment details...' },
    order_created: { text: 'Order Created — Awaiting Pickup', color: '#6366f1', map: '📋 Shipment registered — awaiting pickup' },
    picked_up: { text: 'Pet Picked Up — Preparing for Transit', color: '#8b5cf6', map: '📦 Pet has been picked up from origin' },
    in_transit: { text: '🟢 Live Tracking — Pet In Transit', color: '#22c55e', map: '🚚 Pet is moving toward destination...' },
    on_hold: { text: '⚠️ On Hold — Awaiting Clearance/Action', color: '#ef4444', map: '⚠️ Shipment is temporarily on hold' },
    out_for_delivery: { text: 'Out for Delivery — Almost There!', color: '#f59e0b', map: '🏠 Pet is out for delivery near destination!' },
    delivered: { text: '✅ Delivered — Pet Has Arrived Safely!', color: '#10b981', map: '✅ Pet has been delivered safely!' }
  };

  const info = statusMessages[shipment.current_status] || statusMessages.order_created;
  text.textContent = info.text;
  banner.style.borderColor = info.color;
  banner.querySelector('.live-dot').style.background = info.color;
  if (statusBar) statusBar.textContent = info.map;
}


// ============================================
// GOOGLE MAPS — ENHANCED LIVE MAP
// ============================================
function initTrackingMap(shipment, updates, retryCount = 0) {
  if (typeof google === 'undefined' || !google.maps) {
    if (retryCount < 10) {
      setTimeout(() => initTrackingMap(shipment, updates, retryCount + 1), 500);
      return;
    }
    document.getElementById('trackMap').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--gray-100);flex-direction:column;gap:16px;padding:40px">
        ${SVG_ICONS.mapPin}
        <p style="color:var(--gray-500);font-size:14px;text-align:center">Map requires a Google Maps API key.<br>Contact admin to enable live tracking.</p>
      </div>`;
    return;
  }

  // Cancel previous animation
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  const defaultOrigin = { lat: 40.7128, lng: -74.0060 };
  const defaultDest = { lat: 34.0522, lng: -118.2437 };

  const origin = {
    lat: Number(shipment.origin_lat) || defaultOrigin.lat,
    lng: Number(shipment.origin_lng) || defaultOrigin.lng
  };
  const destination = {
    lat: Number(shipment.destination_lat) || defaultDest.lat,
    lng: Number(shipment.destination_lng) || defaultDest.lng
  };

  // Calculate starting progress based on status
  const statusProgress = {
    pending: 0,
    order_created: 0,
    picked_up: 0.02,
    in_transit: 0.0,
    on_hold: 0,
    out_for_delivery: 0.85,
    delivered: 1.0
  };

  animationProgress = statusProgress[shipment.current_status] || 0;

  // If we have a current position, calculate real progress
  if (shipment.current_lat && shipment.current_lng) {
    const totalDist = haversineDistance(origin, destination);
    const coveredDist = haversineDistance(origin, {
      lat: Number(shipment.current_lat),
      lng: Number(shipment.current_lng)
    });
    if (totalDist > 0) {
      animationProgress = Math.min(coveredDist / totalDist, 0.99);
    }
  }

  // Interpolate current position along route
  const currentPos = interpolatePosition(origin, destination, animationProgress);

  // Initialize map
  map = new google.maps.Map(document.getElementById('trackMap'), {
    center: currentPos,
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    styles: [
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e6f5' }] },
      { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#f3f4f6' }] }
    ]
  });

  // --- Draw full route (dashed gray) ---
  new google.maps.Polyline({
    path: [origin, destination],
    geodesic: true,
    strokeColor: '#9CA3AF',
    strokeOpacity: 0,
    strokeWeight: 3,
    icons: [{
      icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.4, scale: 3, strokeColor: '#9CA3AF' },
      offset: '0',
      repeat: '16px'
    }],
    map: map
  });

  // --- Draw completed route (solid orange) ---
  routePath = new google.maps.Polyline({
    path: [origin, currentPos],
    geodesic: true,
    strokeColor: '#E8773A',
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map: map
  });

  // --- Origin Marker ---
  const greenPin = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <path d="M18 0C8.1 0 0 8.1 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.1 27.9 0 18 0z" fill="#2D8B5F"/>
        <circle cx="18" cy="17" r="7" fill="#fff"/>
        <text x="18" y="21" text-anchor="middle" font-size="12" fill="#2D8B5F">A</text>
      </svg>`),
    scaledSize: new google.maps.Size(36, 44),
    anchor: new google.maps.Point(18, 44)
  };

  originMarker = new google.maps.Marker({
    position: origin, map, icon: greenPin,
    title: 'Origin: ' + shipment.origin_address
  });

  // --- Destination Marker ---
  const redPin = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <path d="M18 0C8.1 0 0 8.1 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.1 27.9 0 18 0z" fill="#EF4444"/>
        <circle cx="18" cy="17" r="7" fill="#fff"/>
        <text x="18" y="21" text-anchor="middle" font-size="12" fill="#EF4444">B</text>
      </svg>`),
    scaledSize: new google.maps.Size(36, 44),
    anchor: new google.maps.Point(18, 44)
  };

  destMarker = new google.maps.Marker({
    position: destination, map, icon: redPin,
    title: 'Destination: ' + shipment.destination_address
  });

  // --- Animated Pet Marker ---
  const pawIcon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="#E8773A" stroke="#fff" stroke-width="3">
          <animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite"/>
        </circle>
        <g transform="translate(12,11) scale(1)" fill="#fff">
          <ellipse cx="8" cy="6" rx="2.5" ry="3"/>
          <ellipse cx="16" cy="6" rx="2.5" ry="3"/>
          <ellipse cx="5" cy="13" rx="2" ry="2.5"/>
          <ellipse cx="19" cy="13" rx="2" ry="2.5"/>
          <path d="M12 22c-3 0-5-2.5-5-5 0-2 2-4 5-4s5 2 5 4c0 2.5-2 5-5 5z"/>
        </g>
      </svg>`),
    scaledSize: new google.maps.Size(48, 48),
    anchor: new google.maps.Point(24, 24)
  };

  animatedMarker = new google.maps.Marker({
    position: currentPos, map, icon: pawIcon,
    title: shipment.pet_name, zIndex: 999
  });

  // Info Windows
  const originInfo = new google.maps.InfoWindow({
    content: `<div style="font-family:Inter,sans-serif;padding:10px">
      <strong style="color:#2D8B5F">📍 Origin</strong><br>
      <span style="font-size:13px;color:#6B7280">${shipment.origin_address}</span>
    </div>`
  });

  const destInfo = new google.maps.InfoWindow({
    content: `<div style="font-family:Inter,sans-serif;padding:10px">
      <strong style="color:#EF4444">📍 Destination</strong><br>
      <span style="font-size:13px;color:#6B7280">${shipment.destination_address}</span><br>
      <span style="font-size:12px;color:#9CA3AF">Est. Delivery: ${shipment.estimated_delivery || 'TBD'}</span>
    </div>`
  });

  const petInfo = new google.maps.InfoWindow({
    content: `<div style="font-family:Inter,sans-serif;padding:10px">
      <strong style="color:#E8773A">🐾 ${shipment.pet_name}</strong><br>
      <span style="font-size:13px;color:#6B7280">${shipment.pet_breed || ''} ${shipment.pet_type}</span><br>
      <span style="font-size:12px;color:#9CA3AF">Status: ${getStatusLabel(shipment.current_status)}</span>
    </div>`
  });

  originMarker.addListener('click', () => originInfo.open(map, originMarker));
  destMarker.addListener('click', () => destInfo.open(map, destMarker));
  animatedMarker.addListener('click', () => petInfo.open(map, animatedMarker));

  // Fit map to show all points
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(origin);
  bounds.extend(destination);
  bounds.extend(currentPos);
  map.fitBounds(bounds, 60);

  // Start animation based on status
  startStatusAnimation(shipment, origin, destination);
}


// ============================================
// STATUS-BASED MAP ANIMATION
// ============================================
function startStatusAnimation(shipment, origin, destination) {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  const status = shipment.current_status;

  if (status === 'order_created' || status === 'picked_up' || status === 'pending' || status === 'on_hold') {
    // Pet is stationary at origin/current position — gentle pulse only (no continuous movement)
    animatedMarker.setPosition(status === 'picked_up' || status === 'on_hold'
      ? interpolatePosition(origin, destination, animationProgress > 0 ? animationProgress : 0.02)
      : origin);
    updateRouteProgress(origin, destination, animationProgress > 0 ? animationProgress : (status === 'picked_up' ? 0.02 : 0));
    return;
  }

  if (status === 'delivered') {
    // Pet is at destination — no animation
    animatedMarker.setPosition(destination);
    updateRouteProgress(origin, destination, 1.0);
    return;
  }

  // ---- IN TRANSIT or OUT FOR DELIVERY — very slow crawl animation ----
  const speedMultiplier = status === 'out_for_delivery' ? 0.000005 : 0.000010;
  const maxProgress = status === 'out_for_delivery' ? 0.98 : 0.84;

  // Set minimum progress
  if (status === 'out_for_delivery' && animationProgress < 0.85) {
    animationProgress = 0.85;
  }

  function crawl() {
    if (animationProgress < maxProgress) {
      animationProgress += speedMultiplier;
    } else {
      // Loop back slightly to keep it moving until the next real status change
      if (status === 'in_transit') {
        animationProgress = Math.max(animationProgress - 0.10, 0.0);
      }
    }

    const pos = interpolatePosition(origin, destination, animationProgress);
    animatedMarker.setPosition(pos);
    updateRouteProgress(origin, destination, animationProgress);

    animationFrame = requestAnimationFrame(crawl);
  }

  animationFrame = requestAnimationFrame(crawl);
}


// ---- Update the orange completed-route polyline ----
function updateRouteProgress(origin, destination, progress) {
  if (!routePath) return;

  // Create intermediate points for a smooth line
  const points = [];
  const steps = Math.max(Math.floor(progress * 50), 2);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * progress;
    points.push(interpolatePosition(origin, destination, t));
  }
  routePath.setPath(points);
}


// ---- Interpolate between two lat/lng points ----
function interpolatePosition(from, to, progress) {
  progress = Math.max(0, Math.min(1, progress));
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress
  };
}


// ============================================
// REAL-TIME SUPABASE SUBSCRIPTION
// ============================================
function subscribeToRealtime(shipment) {
  // Subscribe to changes on this specific shipment
  realtimeSubscription = supabaseClient
    .channel(`shipment-${shipment.id}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'pet_shipments', filter: `id=eq.${shipment.id}` },
      (payload) => {
        console.log('Real-time shipment update:', payload.new);
        currentShipment = payload.new;

        // Refresh all UI sections
        renderInvoiceReceipt(currentShipment);
        renderTimeline(currentShipment, currentUpdates);
        updateLiveStatusBanner(currentShipment);

        // Recalculate map animation
        if (map && animatedMarker) {
          const origin = {
            lat: Number(currentShipment.origin_lat) || 40.7128,
            lng: Number(currentShipment.origin_lng) || -74.0060
          };
          const destination = {
            lat: Number(currentShipment.destination_lat) || 34.0522,
            lng: Number(currentShipment.destination_lng) || -118.2437
          };

          // Update progress from current_lat/lng if available
          if (currentShipment.current_lat && currentShipment.current_lng) {
            const totalDist = haversineDistance(origin, destination);
            const covered = haversineDistance(origin, {
              lat: Number(currentShipment.current_lat),
              lng: Number(currentShipment.current_lng)
            });
            if (totalDist > 0) {
              animationProgress = Math.min(covered / totalDist, 0.99);
            }
          }

          startStatusAnimation(currentShipment, origin, destination);
        }
      }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pet_tracking_updates', filter: `shipment_id=eq.${shipment.id}` },
      async (payload) => {
        console.log('Real-time tracking update:', payload.new);
        currentUpdates.push(payload.new);
        renderTimeline(currentShipment, currentUpdates);
      }
    )
    .subscribe();
}


// ---- Haversine distance (km) ----
function haversineDistance(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
