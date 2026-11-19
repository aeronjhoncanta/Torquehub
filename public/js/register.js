// Polyfill for older Edge versions
if (!window.Promise) {
  window.Promise = Promise;
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const registerForm = document.getElementById('registerForm');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const strengthLabel = document.getElementById('strengthLabel');
  const strengthMeter = document.querySelector('.strength-meter-fill');
  const termsCheckbox = document.getElementById('terms');
  
  // Error display element
  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-message';
  Object.assign(errorDiv.style, {
    color: 'red',
    margin: '10px 0',
    textAlign: 'center',
    minHeight: '20px',
    fontSize: '14px'
  });
  registerForm.parentNode.insertBefore(errorDiv, registerForm);

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  // Update password strength UI
  passwordInput.addEventListener('input', function() {
    const password = this.value;
    const strength = calculatePasswordStrength(password);
    const percent = (strength / 5) * 100;
    
    strengthMeter.style.width = `${percent}%`;
    strengthMeter.style.transition = 'width 0.3s ease, background-color 0.3s ease';
    
    if (strength <= 2) {
      strengthLabel.textContent = 'Weak';
      strengthMeter.style.backgroundColor = '#ff4d4d';
    } else if (strength <= 3) {
      strengthLabel.textContent = 'Medium';
      strengthMeter.style.backgroundColor = '#ffa64d';
    } else {
      strengthLabel.textContent = 'Strong';
      strengthMeter.style.backgroundColor = '#4CAF50';
    }
  });

  // Form submission handler
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    errorDiv.textContent = '';
    errorDiv.style.color = 'red'; // Reset color
    
    // Validate form
    if (!termsCheckbox.checked) {
      showError('You must accept the terms and conditions');
      return;
    }
    
    if (passwordInput.value !== confirmPasswordInput.value) {
      showError('Passwords do not match');
      return;
    }

    // Use FormData for file upload
    const formData = new FormData(registerForm);

    // Debug: Log form data (for text fields only)
    console.log('Submitting form data:', Object.fromEntries(formData.entries()));

    try {
      const submitBtn = document.querySelector('.btn-auth');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

      // Edge-compatible fetch request
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        // Do NOT set Content-Type header when using FormData
        body: formData,
        credentials: 'include' // Required for Edge to handle cookies/sessions
      });

      // Debug: Log raw response
      console.log('Raw response:', response);

      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        throw data;
      }

      // Success
      errorDiv.style.color = 'green';
      errorDiv.textContent = 'Registration successful! Please check your email to verify your account.';
      
      // Redirect after delay
      setTimeout(() => {
        window.location.href = '/login?registered=true';
      }, 2000);
      
    } catch (error) {
      console.error('Full registration error:', error);
      
      let errorMessage = 'An error occurred during registration';
      if (error.errors) {
        errorMessage = error.errors.map(err => {
          console.error('Validation error:', err);
          return err.msg;
        }).join('\n');
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showError(errorMessage);
    } finally {
      const submitBtn = document.querySelector('.btn-auth');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Create Account</span>';
      }
    }
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.animation = 'shake 0.5s';
    setTimeout(() => errorDiv.style.animation = '', 500);
    
    // Log error to console
    console.error('Displaying error to user:', message);
  }
});

// Add shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  #error-message {
    padding: 8px;
    border-radius: 4px;
    margin-bottom: 15px;
  }
`;
document.head.appendChild(style);

// Edge-specific DOM ready check
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    const event = document.createEvent('Event');
    event.initEvent('DOMContentLoaded', true, true);
    document.dispatchEvent(event);
  }, 0);
}