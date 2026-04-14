/* ============================================
   PET PAWS JOURNEY — CONTACT FORM
   Saves messages to Supabase
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
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
      phone: form.querySelector('#contactPhone').value.trim() || null,
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
      const { error } = await supabaseClient
        .from('contact_messages')
        .insert([formData]);

      if (error) throw error;

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
