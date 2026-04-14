/* ============================================
   PET PAWS JOURNEY — TRACK PAGE
   Fetches shipment data, renders timeline,
   Google Maps route with animated marker
   ============================================ */

let map, routePath, animatedMarker, originMarker, destMarker;
let animationFrame = null;
let currentStep = 0;

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

    // Fetch tracking updates
    const { data: updates } = await supabaseClient
      .from('pet_tracking_updates')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('timestamp', { ascending: true });

    // Hide loading, show results
    loadingEl.classList.remove('visible');
    resultsEl.classList.add('visible');

    // Render all sections
    renderPetCard(shipment);
    renderShipmentInfo(shipment);
    renderTimeline(shipment, updates || []);
    initTrackingMap(shipment, updates || []);

  } catch (err) {
    console.error('Tracking error:', err);
    loadingEl.classList.remove('visible');
    errorEl.classList.add('visible');
  }
}

// ---- Render pet details card ----
function renderPetCard(shipment) {
  const container = document.getElementById('petCard');
  container.innerHTML = `
    <div class="pet-card-header">
      <div class="pet-card-image">
        ${shipment.pet_image_url
          ? `<img src="${shipment.pet_image_url}" alt="${shipment.pet_name}">`
          : SVG_ICONS.paw
        }
      </div>
      <div>
        <div class="pet-card-name">${shipment.pet_name}</div>
        <div class="pet-card-type">${shipment.pet_breed ? shipment.pet_breed + ' ' : ''}${shipment.pet_type}</div>
      </div>
      <span class="status-badge ${getStatusClass(shipment.current_status)}" style="margin-left:auto">
        ${SVG_ICONS.activity}
        ${getStatusLabel(shipment.current_status)}
      </span>
    </div>
    <div class="pet-card-details">
      <div class="pet-detail-item">
        <div class="pet-detail-label">Tracking Code</div>
        <div class="pet-detail-value" style="font-family:monospace;color:var(--primary)">${shipment.tracking_code}</div>
      </div>
      <div class="pet-detail-item">
        <div class="pet-detail-label">Pet Type</div>
        <div class="pet-detail-value">${shipment.pet_type}</div>
      </div>
      <div class="pet-detail-item">
        <div class="pet-detail-label">Origin</div>
        <div class="pet-detail-value">${shipment.origin_address}</div>
      </div>
      <div class="pet-detail-item">
        <div class="pet-detail-label">Destination</div>
        <div class="pet-detail-value">${shipment.destination_address}</div>
      </div>
    </div>
  `;
}

// ---- Render shipment info card ----
function renderShipmentInfo(shipment) {
  const container = document.getElementById('shipmentInfo');
  container.innerHTML = `
    <h3>Shipment Details</h3>
    <div class="shipment-info-row">
      <span class="shipment-info-label">Client Name</span>
      <span class="shipment-info-value">${shipment.client_name}</span>
    </div>
    <div class="shipment-info-row">
      <span class="shipment-info-label">Shipper</span>
      <span class="shipment-info-value">${shipment.shipper_name}</span>
    </div>
    <div class="shipment-info-row">
      <span class="shipment-info-label">Estimated Delivery</span>
      <span class="shipment-info-value">${formatDate(shipment.estimated_delivery)}</span>
    </div>
    <div class="shipment-info-row">
      <span class="shipment-info-label">Last Updated</span>
      <span class="shipment-info-value">${formatDateTime(shipment.updated_at)}</span>
    </div>
    <div class="shipment-info-row">
      <span class="shipment-info-label">Created</span>
      <span class="shipment-info-value">${formatDateTime(shipment.created_at)}</span>
    </div>
    ${shipment.special_notes ? `
    <div class="shipment-info-row">
      <span class="shipment-info-label">Notes</span>
      <span class="shipment-info-value">${shipment.special_notes}</span>
    </div>` : ''}
  `;
}

// ---- Render tracking timeline ----
function renderTimeline(shipment, updates) {
  const container = document.getElementById('trackTimeline');
  const statusOrder = ['order_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  const currentIndex = statusOrder.indexOf(shipment.current_status);

  // Map updates by status for lookup
  const updatesByStatus = {};
  updates.forEach(u => {
    updatesByStatus[u.status] = u;
  });

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

  // Calculate filled line height
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

// ---- Google Maps Integration ----
function initTrackingMap(shipment, updates) {
  // Requires Google Maps JS API to be loaded
  if (typeof google === 'undefined' || !google.maps) {
    console.warn('Google Maps API not loaded.');
    document.getElementById('trackMap').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--gray-100);flex-direction:column;gap:16px;padding:40px">
        ${SVG_ICONS.mapPin}
        <p style="color:var(--gray-500);font-size:14px;text-align:center">Map requires a Google Maps API key.<br>Contact admin to enable live tracking.</p>
      </div>`;
    return;
  }

  const origin = { lat: shipment.origin_lat, lng: shipment.origin_lng };
  const destination = { lat: shipment.destination_lat, lng: shipment.destination_lng };

  // Build route points from updates
  const routePoints = [origin];
  updates.forEach(u => {
    if (u.lat && u.lng) {
      routePoints.push({ lat: u.lat, lng: u.lng });
    }
  });
  if (shipment.current_status === 'delivered') {
    routePoints.push(destination);
  }

  // Current position (last known)
  const currentPos = shipment.current_lat && shipment.current_lng
    ? { lat: shipment.current_lat, lng: shipment.current_lng }
    : routePoints[routePoints.length - 1];

  // Initialize map
  map = new google.maps.Map(document.getElementById('trackMap'), {
    center: currentPos,
    zoom: 6,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    styles: [
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e6f5' }] }
    ]
  });

  // Draw route polyline
  routePath = new google.maps.Polyline({
    path: routePoints,
    geodesic: true,
    strokeColor: '#E8773A',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    map: map
  });

  // Draw dashed remaining route
  if (shipment.current_status !== 'delivered') {
    new google.maps.Polyline({
      path: [currentPos, destination],
      geodesic: true,
      strokeColor: '#9CA3AF',
      strokeOpacity: 0.5,
      strokeWeight: 3,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
        offset: '0',
        repeat: '16px'
      }],
      map: map
    });
  }

  // Create custom SVG markers
  const pawIcon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="#E8773A" stroke="#fff" stroke-width="3"/>
        <g transform="translate(10,9) scale(0.85)" fill="#fff">
          <ellipse cx="8" cy="6" rx="2.5" ry="3"/>
          <ellipse cx="16" cy="6" rx="2.5" ry="3"/>
          <ellipse cx="5" cy="13" rx="2" ry="2.5"/>
          <ellipse cx="19" cy="13" rx="2" ry="2.5"/>
          <path d="M12 22c-3 0-5-2.5-5-5 0-2 2-4 5-4s5 2 5 4c0 2.5-2 5-5 5z"/>
        </g>
      </svg>
    `),
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22)
  };

  const greenPin = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="#2D8B5F"/>
        <circle cx="16" cy="15" r="6" fill="#fff"/>
      </svg>
    `),
    scaledSize: new google.maps.Size(32, 40),
    anchor: new google.maps.Point(16, 40)
  };

  const redPin = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="#EF4444"/>
        <circle cx="16" cy="15" r="6" fill="#fff"/>
      </svg>
    `),
    scaledSize: new google.maps.Size(32, 40),
    anchor: new google.maps.Point(16, 40)
  };

  // Origin marker
  originMarker = new google.maps.Marker({
    position: origin,
    map: map,
    icon: greenPin,
    title: 'Origin: ' + shipment.origin_address
  });

  // Destination marker
  destMarker = new google.maps.Marker({
    position: destination,
    map: map,
    icon: redPin,
    title: 'Destination: ' + shipment.destination_address
  });

  // Info windows
  const originInfo = new google.maps.InfoWindow({
    content: `<div style="font-family:Inter,sans-serif;padding:8px">
      <strong style="color:#2D8B5F">Origin</strong><br>
      <span style="font-size:13px;color:#6B7280">${shipment.origin_address}</span>
    </div>`
  });

  const destInfo = new google.maps.InfoWindow({
    content: `<div style="font-family:Inter,sans-serif;padding:8px">
      <strong style="color:#EF4444">Destination</strong><br>
      <span style="font-size:13px;color:#6B7280">${shipment.destination_address}</span>
    </div>`
  });

  originMarker.addListener('click', () => originInfo.open(map, originMarker));
  destMarker.addListener('click', () => destInfo.open(map, destMarker));

  // Animated pet marker (moves along route)
  animatedMarker = new google.maps.Marker({
    position: routePoints[0],
    map: map,
    icon: pawIcon,
    title: shipment.pet_name,
    zIndex: 999
  });

  const petInfo = new google.maps.InfoWindow({
    content: `<div style="font-family:Inter,sans-serif;padding:8px">
      <strong style="color:#E8773A">${shipment.pet_name}</strong><br>
      <span style="font-size:13px;color:#6B7280">${shipment.pet_breed || ''} ${shipment.pet_type}</span><br>
      <span style="font-size:12px;color:#9CA3AF">Status: ${getStatusLabel(shipment.current_status)}</span>
    </div>`
  });

  animatedMarker.addListener('click', () => petInfo.open(map, animatedMarker));

  // Fit map to show all points
  const bounds = new google.maps.LatLngBounds();
  routePoints.forEach(p => bounds.extend(p));
  bounds.extend(destination);
  map.fitBounds(bounds, 60);

  // Animate marker along route
  if (routePoints.length > 1) {
    animateMarkerAlongRoute(routePoints);
  }
}

// ---- Animate marker smoothly along route points ----
function animateMarkerAlongRoute(routePoints) {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  
  const totalSteps = 300; // Total animation frames
  const pathSegments = [];
  let totalDistance = 0;

  // Calculate distance for each segment
  for (let i = 0; i < routePoints.length - 1; i++) {
    const dist = haversineDistance(routePoints[i], routePoints[i + 1]);
    pathSegments.push({ from: routePoints[i], to: routePoints[i + 1], dist });
    totalDistance += dist;
  }

  let frame = 0;

  function animate() {
    const progress = frame / totalSteps;
    if (progress > 1) {
      // Loop animation
      frame = 0;
      animationFrame = requestAnimationFrame(animate);
      return;
    }

    const targetDist = progress * totalDistance;
    let accumulated = 0;
    let pos = routePoints[0];

    for (const seg of pathSegments) {
      if (accumulated + seg.dist >= targetDist) {
        const segProgress = (targetDist - accumulated) / seg.dist;
        pos = {
          lat: seg.from.lat + (seg.to.lat - seg.from.lat) * segProgress,
          lng: seg.from.lng + (seg.to.lng - seg.from.lng) * segProgress
        };
        break;
      }
      accumulated += seg.dist;
    }

    animatedMarker.setPosition(pos);
    
    // Camera follows marker gently
    if (frame % 10 === 0) {
      map.panTo(pos);
    }

    frame++;
    animationFrame = requestAnimationFrame(animate);
  }

  // Start after a short delay
  setTimeout(() => {
    animationFrame = requestAnimationFrame(animate);
  }, 1000);
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
