document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const togglePassword = document.querySelector('.toggle-password');
  const passwordInput = document.getElementById('password');

  // Toggle password visibility
  togglePassword.addEventListener('click', function() {
    const icon = this.querySelector('i');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });

  // Form submission
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitButton = this.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    submitButton.disabled = true;

    // Get form values
    const formData = {
      email: this.email.value,
      password: this.password.value,
      remember: this.remember.checked
    };

    try {
      // Call backend API for login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials and try again.');
      }
      // Successful login
      window.location.href = '/dashboard';
    } catch (error) {
      // Show error message
      alert(error.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      // Reset button
      submitButton.innerHTML = originalText;
      submitButton.disabled = false;
    }
  });
});