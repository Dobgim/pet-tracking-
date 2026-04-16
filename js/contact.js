/* ============================================
   PET PAWS JOURNEY — CONTACT FORM
   Saves messages to Supabase + sends email
   notification via EmailJS
   ============================================ */

// ======================================================
// EmailJS Configuration — UPDATE THESE WITH YOUR OWN
// 1. Go to https://www.emailjs.com (free account)
// 2. Add your Gmail/email as an "Email Service"
// 3. Create a template (see instructions below)
// 4. Replace the 3 values below with your own
// ======================================================
const EMAILJS_PUBLIC_KEY = 'XXxDKJxYUGQBuhP2w';
const EMAILJS_SERVICE_ID = 'service_whqk61h';
const EMAILJS_TEMPLATE_ID = 'template_3o1p4qm';

// Your admin email to receive notifications
const ADMIN_EMAIL = 'petpawsjourney@gmail.com';


document.addEventListener('DOMContentLoaded', () => {
  // Initialize EmailJS
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0"></span> Sending...';

    // Gather form data
    const formData = {
      name: form.querySelector('#contactName').value.trim(),
      email: form.querySelector('#contactEmail').value.trim(),
      phone: form.querySelector('#contactPhone').value.trim() || 'Not provided',
      subject: form.querySelector('#contactSubject').value.trim(),
      message: form.querySelector('#contactMessage').value.trim()
    };

    // Basic validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      showToast('Please fill in all required fields.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }

    try {
      // 1. Send email notification to admin via EmailJS (primary)
      await sendEmailNotification(formData);

      // 2. Also save to Supabase database (secondary — don't block on failure)
      try {
        await supabaseClient
          .from('contact_messages')
          .insert([{
            name: formData.name,
            email: formData.email,
            phone: formData.phone === 'Not provided' ? null : formData.phone,
            subject: formData.subject,
            message: formData.message
          }]);
      } catch (dbErr) {
        console.warn('Supabase save skipped:', dbErr);
      }

      showToast('Message sent successfully! We will get back to you soon.', 'success');
      form.reset();

    } catch (err) {
      console.error('Contact form error:', err);
      showToast('Failed to send message. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
});


// ---- Send Email Notification via EmailJS ----
async function sendEmailNotification(formData) {
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS not loaded — skipping email notification.');
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  // Template parameters — these map to {{variable}} placeholders in your EmailJS template
  const templateParams = {
    to_email: ADMIN_EMAIL,
    from_name: formData.name,
    from_email: formData.email,
    from_phone: formData.phone,
    subject: formData.subject,
    message: formData.message,
    date: dateStr,
    time: timeStr,
    // For the email subject line
    email_subject: `🐾 New Contact: ${formData.subject} — from ${formData.name}`
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    console.log('Email notification sent successfully.');
  } catch (emailErr) {
    // Don't fail the whole form submission if email fails
    console.error('Email notification failed:', emailErr);
  }
}


// ---- Contact Google Map ----
window.initContactMap = function() {
  const mapEl = document.getElementById('contactMap');
  if (!mapEl) return;
  
  const officeLocation = { lat: 40.7484, lng: -73.9857 }; // Empire State / New York Area

  const map = new google.maps.Map(mapEl, {
    center: officeLocation,
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false,
    styles: [
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] }
    ]
  });

  new google.maps.Marker({
    position: officeLocation,
    map: map,
    title: 'Pet Paws Journey Office',
    animation: google.maps.Animation.DROP
  });
};
