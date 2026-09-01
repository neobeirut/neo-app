const SUPABASE_URL = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';

let _supabase = null;
let currentRest = null;
let currentBranch = null;
let enteredPin = '';
let currentAction = 'In'; // 'In' or 'Out'

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  startClock();
});

// Initialize PWA State
async function initApp() {
  const storedInfo = localStorage.getItem('@tablet_restaurant_info');
  if (storedInfo) {
    currentRest = JSON.parse(storedInfo);
    initSupabaseClient(currentRest.id);
    showPunchScreen();
  } else {
    showActivationScreen();
  }

  // Setup service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed', err));
  }
}

function initSupabaseClient(restaurantId) {
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        'x-restaurant-id': restaurantId
      }
    }
  });
}

// Clock logic
function startClock() {
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');
  
  function update() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  update();
  setInterval(update, 1000);
}

// Render screens
function showActivationScreen() {
  document.getElementById('activation-screen').classList.remove('hidden');
  document.getElementById('punch-screen').classList.add('hidden');
}

async function showPunchScreen() {
  document.getElementById('activation-screen').classList.add('hidden');
  document.getElementById('punch-screen').classList.remove('hidden');

  // Display Restaurant Header
  document.getElementById('restaurant-title').textContent = currentRest.name;
  const logoEl = document.getElementById('restaurant-logo');
  if (currentRest.logo_url) {
    logoEl.src = currentRest.logo_url;
    logoEl.classList.remove('hidden');
  } else {
    logoEl.classList.add('hidden');
  }

  // Load and populate branches dropdown
  await loadBranches();
}

async function loadBranches() {
  const select = document.getElementById('branch-select');
  select.innerHTML = '<option value="">Loading branches...</option>';

  try {
    const { data: branches, error } = await _supabase
      .from('branches')
      .select('*')
      .eq('restaurant_id', currentRest.id)
      .order('name');

    if (error || !branches) {
      select.innerHTML = '<option value="">Error loading branches</option>';
      return;
    }

    select.innerHTML = '';
    branches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      select.appendChild(opt);
    });

    // Default to last selected branch
    const savedBranch = localStorage.getItem('@tablet_punch_branch');
    if (savedBranch && branches.some(b => b.name === savedBranch)) {
      select.value = savedBranch;
      currentBranch = savedBranch;
    } else if (branches.length > 0) {
      select.value = branches[0].name;
      currentBranch = branches[0].name;
      localStorage.setItem('@tablet_punch_branch', currentBranch);
    }
  } catch (err) {
    select.innerHTML = '<option value="">Network error</option>';
  }
}

// Handle Branch Select Change
function handleBranchChange(val) {
  currentBranch = val;
  localStorage.setItem('@tablet_punch_branch', val);
}

// Device Activation Flow
async function handleActivate() {
  const codeInput = document.getElementById('activation-code-input');
  const code = codeInput.value.trim();
  if (!code) {
    alert('Please enter your restaurant activation code.');
    return;
  }

  showLoader('Activating tablet...');

  try {
    const { data, error } = await supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY).rpc('activate_device_by_code', {
      p_code: code.toUpperCase()
    });

    if (error || !data || !data.success) {
      hideLoader();
      alert('Activation failed: ' + (data?.error || error?.message || 'Invalid code'));
      return;
    }

    currentRest = {
      id: data.restaurant_id,
      name: data.name,
      logo_url: data.logo_url,
      primary_color: data.primary_color
    };

    localStorage.setItem('@tablet_restaurant_info', JSON.stringify(currentRest));
    initSupabaseClient(currentRest.id);
    codeInput.value = '';
    
    hideLoader();
    await showPunchScreen();
  } catch (err) {
    hideLoader();
    alert('Network error during activation: ' + err.message);
  }
}

// Settings / Admin Reset Activation
async function handleResetActivation() {
  const adminPin = prompt('Enter Admin PIN to reset device settings:');
  if (!adminPin) return;

  showLoader('Verifying admin credentials...');
  try {
    // Check if user exists with role admin and this PIN
    const { data: adminUser, error } = await _supabase
      .from('users')
      .select('id, role')
      .eq('pin', adminPin.trim())
      .eq('restaurant_id', currentRest.id)
      .maybeSingle();

    if (adminUser && adminUser.role?.toLowerCase().includes('admin')) {
      hideLoader();
      localStorage.clear();
      currentRest = null;
      currentBranch = null;
      _supabase = null;
      showActivationScreen();
      alert('Tablet reset complete. Please activate again.');
    } else {
      hideLoader();
      alert('Unauthorized: Invalid Admin PIN.');
    }
  } catch (err) {
    hideLoader();
    alert('Verification failed: ' + err.message);
  }
}

// PIN Entry Keyboard handler
function openPinModal(action) {
  if (!currentBranch) {
    alert('Please select a branch first.');
    return;
  }
  currentAction = action;
  enteredPin = '';
  updatePinDots();
  
  document.getElementById('pin-modal-title').textContent = `Clock ${action === 'In' ? 'In' : 'Out'}`;
  document.getElementById('pin-modal').classList.remove('hidden');
}

function closePinModal() {
  document.getElementById('pin-modal').classList.add('hidden');
  enteredPin = '';
}

function handleKeypress(val) {
  if (enteredPin.length >= 4) return;
  enteredPin += val;
  updatePinDots();
  
  if (enteredPin.length === 4) {
    // Wait slightly to let the last dot highlight, then submit
    setTimeout(submitPunch, 200);
  }
}

function handleBackspace() {
  enteredPin = enteredPin.slice(0, -1);
  updatePinDots();
}

function handleClear() {
  enteredPin = '';
  updatePinDots();
}

function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < enteredPin.length) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

// Submit Punch Request
async function submitPunch() {
  const pinToVerify = enteredPin;
  closePinModal();
  showLoader('Verifying your details...');

  try {
    // 1. Authenticate PIN via login_by_pin RPC
    const { data: user, error: loginErr } = await _supabase.rpc('login_by_pin', {
      p_pin: pinToVerify,
      p_restaurant_id: currentRest.id
    });

    if (loginErr || !user) {
      showStatusScreen(false, 'Invalid PIN', 'The PIN code you entered is incorrect. Please try again.');
      return;
    }

    // 2. Fetch or generate employee profile link
    const { data: emp, error: empErr } = await _supabase
      .from('employees')
      .select('employee_id, first_name, last_name, branch')
      .eq('restaurant_id', currentRest.id)
      .eq('app_user_id', user.id)
      .maybeSingle();

    let employee = emp;

    if (!employee || empErr) {
      // Auto-create/sync employee profile link if missing
      const cleanName = user.name || 'User';
      const parts = cleanName.split(' ');
      const fName = parts[0] || 'Employee';
      const lName = parts.slice(1).join(' ') || '';

      const { data: newEmp, error: createErr } = await _supabase
        .from('employees')
        .insert([{
          app_user_id: user.id,
          restaurant_id: currentRest.id,
          first_name: fName,
          last_name: lName,
          branch: user.branch || currentBranch,
          status: 'Active'
        }])
        .select()
        .single();

      if (createErr || !newEmp) {
        showStatusScreen(false, 'Profile Link Error', 'Could not link your employee profile. Contact manager.');
        return;
      }
      employee = newEmp;
    }

    // 3. Verify permissions override
    let hasPermission = false;
    if (user.role === 'Admin' || user.role === 'SuperAdmin' || user.role === 'Super Admin' || user.role?.toLowerCase() === 'manager') {
      hasPermission = true;
    } else {
      // Query overrides
      const { data: override } = await _supabase
        .from('app_permissions')
        .select('can_punch_other_device')
        .eq('id', `user:${user.name}`)
        .eq('restaurant_id', currentRest.id)
        .maybeSingle();

      if (override && override.can_punch_other_device) {
        hasPermission = true;
      } else if (user.departments) {
        const depts = user.departments.split(',').map(d => d.trim()).filter(Boolean);
        if (depts.length > 0) {
          const deptIds = depts.map(d => `dept:${d}`);
          const { data: deptData } = await _supabase
            .from('app_permissions')
            .select('can_punch_other_device')
            .in('id', deptIds)
            .eq('restaurant_id', currentRest.id);
          if (deptData && deptData.some(p => p.can_punch_other_device)) {
            hasPermission = true;
          }
        }
      }
    }

    if (!hasPermission) {
      showStatusScreen(false, 'Punch Refused', 'Refused: You do not have permission to punch from this device.');
      return;
    }

    // 4. Verify open logs
    const { data: openPunch } = await _supabase
      .from('employee_attendance')
      .select('*')
      .eq('employee_id', employee.employee_id)
      .eq('restaurant_id', currentRest.id)
      .is('punch_out', null)
      .neq('status', 'Rejected')
      .order('punch_in', { ascending: false })
      .maybeSingle();

    if (currentAction === 'In') {
      if (openPunch) {
        showStatusScreen(false, 'Clock In Refused', 'You are already clocked in. Please punch out first.');
        return;
      }

      // Record Clock In
      const { error: insErr } = await _supabase
        .from('employee_attendance')
        .insert([{
          employee_id: employee.employee_id,
          restaurant_id: currentRest.id,
          branch: currentBranch,
          punch_source: 'Tablet',
          status: 'Pending',
          device_id: 'Tablet',
          punch_in: new Date().toISOString()
        }]);

      if (insErr) {
        showStatusScreen(false, 'Clock In Failed', insErr.message);
        return;
      }

      showStatusScreen(true, 'Punch In Success', `Hi ${employee.first_name}, you have successfully punched IN at ${currentBranch}. Your punch is subject to manager approval.`);
    } else {
      if (!openPunch) {
        showStatusScreen(false, 'Clock Out Refused', 'You are not clocked in. Please punch in first.');
        return;
      }

      // Record Clock Out
      const { error: updErr } = await _supabase
        .from('employee_attendance')
        .update({
          punch_out: new Date().toISOString(),
          status: 'Pending' // Entire record remains subject to approval
        })
        .eq('id', openPunch.id);

      if (updErr) {
        showStatusScreen(false, 'Clock Out Failed', updErr.message);
        return;
      }

      showStatusScreen(true, 'Punch Out Success', `Hi ${employee.first_name}, you have successfully punched OUT. Your punch is subject to manager approval.`);
    }
  } catch (err) {
    showStatusScreen(false, 'Network Error', err.message || 'Could not connect to database server.');
  }
}

// Show Fullscreen Loader
function showLoader(msg) {
  document.getElementById('status-title').textContent = '';
  document.getElementById('status-msg').textContent = msg;
  document.getElementById('status-icon').innerHTML = '<div class="spinner"></div>';
  document.getElementById('status-screen').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('status-screen').classList.add('hidden');
}

// Show Success/Error Feedback Modal
function showStatusScreen(isSuccess, title, msg) {
  const iconHtml = isSuccess 
    ? '<span style="color: var(--success-color)">✓</span>' 
    : '<span style="color: var(--danger-color)">⚠️</span>';

  document.getElementById('status-title').textContent = title;
  document.getElementById('status-msg').textContent = msg;
  document.getElementById('status-icon').innerHTML = iconHtml;
  document.getElementById('status-screen').classList.remove('hidden');

  // Automatically dismiss after 4 seconds
  setTimeout(() => {
    document.getElementById('status-screen').classList.add('hidden');
  }, 4000);
}
