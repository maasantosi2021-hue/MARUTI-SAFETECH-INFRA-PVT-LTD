// ENTERPRISE SESSION RUNTIME STATE MANAGEMENT
let CURRENT_SESSION_PROFILE = null;
let REQUIRE_2FA_STATE = false;
let ACTIVE_CHECKOUT_BILL_ID = null;

function switchTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => {
        content.classList.remove('active', 'animated-fade-in');
    });

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    const targetTab = document.getElementById(`${tabId}-tab`);
    if (targetTab) {
        targetTab.classList.add('active', 'animated-fade-in');
    }
    
    const activeLink = Array.from(navItems).find(item => item.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (activeLink) activeLink.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('authLoginForm');
    const regForm = document.getElementById('authRegForm');
    const loginBtn = document.getElementById('loginTabBtn');
    const regBtn = document.getElementById('regTabBtn');
    
    if(mode === 'login') {
        loginForm.style.display = 'block'; regForm.style.display = 'none';
        loginBtn.classList.add('active'); regBtn.classList.remove('active');
    } else {
        loginForm.style.display = 'none'; regForm.style.display = 'block';
        loginBtn.classList.remove('active'); regBtn.classList.add('active');
    }
}

// FULL STACK LOGIC HANDSHAKE GATEWAYS
function executeGatewayLogin(event) {
    event.preventDefault();
    const emailValue = document.getElementById('userEmailInput').value;
    const passValue = document.getElementById('userPassInput').value;

    if (REQUIRE_2FA_STATE) {
        const otpValue = document.getElementById('adminOtpInput').value;
        fetch('http://127.0.0.1:5000/api/login/step2-admin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: emailValue, otp: otpValue })
        })
        .then(res => { if(!res.ok) throw new Error(); return res.json(); })
        .then(data => {
            REQUIRE_2FA_STATE = false;
            document.getElementById('admin2FALayer').style.display = 'none';
            authorizeSession({ username: "System Administrator", role: "admin" });
        })
        .catch(() => alert("Security Violation: Invalid Admin OTP Code sequence."));
        return;
    }

    fetch('http://127.0.0.1:5000/api/login/step1', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email: emailValue, password: passValue })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'otp_required') {
            REQUIRE_2FA_STATE = true;
            document.getElementById('admin2FALayer').style.display = 'block';
            alert("MFS Verification Alert: Check your background Python terminal output for the admin temporary OTP code.");
        } else if (data.status === 'success') {
            authorizeSession(data.user);
        } else {
            alert("Authentication Denied.");
        }
    })
    .catch(() => alert("Network communication breakdown with validation gateways."));
}

function authorizeSession(userObject) {
    CURRENT_SESSION_PROFILE = userObject;
    closeModal('unifiedAuthModal');
    
    const badge = document.getElementById('activeSessionBadge');
    badge.innerText = `Active Account Access Profile: ${userObject.username.toUpperCase()} [Role Context: ${userObject.role.toUpperCase()}]`;
    badge.style.display = 'block';

    const navLinksContainer = document.getElementById('dynamicNavLinks');
    
    if (userObject.role === 'admin') {
        navLinksContainer.innerHTML += `<li><a href="#" class="nav-item" onclick="switchTab('admin-panel')"><i class="fa-solid fa-gears"></i> Admin Room</a></li>`;
        switchTab('admin-panel');
        syncAdminData();
    } else if (userObject.role === 'employee') {
        navLinksContainer.innerHTML += `<li><a href="#" class="nav-item" onclick="switchTab('employee-panel')"><i class="fa-solid fa-users-gear"></i> Tasks Hub</a></li>`;
        switchTab('employee-panel');
    } else if (userObject.role === 'developer') {
        navLinksContainer.innerHTML += `<li><a href="#" class="nav-item" onclick="switchTab('developer-panel')"><i class="fa-solid fa-code"></i> Engineering Room</a></li>`;
        switchTab('developer-panel');
        syncDeveloperData();
    }
    
    if (userObject.role === 'client') {
        document.getElementById('clientInvoiceArea').style.display = 'block';
    }

    document.getElementById('navAuthSection').innerHTML = `<button class="btn btn-outline" onclick="location.reload()"><i class="fa-solid fa-power-off"></i> Terminate Session</button>`;
}

function executeGatewayRegister(event) {
    event.preventDefault();
    const payload = {
        username: document.getElementById('regUsername').value,
        email: document.getElementById('regEmail').value,
        phone: document.getElementById('regPhone').value,
        password: document.getElementById('regPassword').value,
        emp_id: document.getElementById('regEmpId').value
    };

    fetch('http://127.0.0.1:5000/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if(data.status === 'success') closeModal('unifiedAuthModal');
    });
}

function triggerSOS() {
    if(confirm("🚨 CRITICAL WARNING: Launch emergency fire panic routing matrix sequence?")) {
        fetch('http://127.0.0.1:5000/api/sos', {method:'POST'})
        .then(res => res.json())
        .then(data => {
            alert("EMERGENCY ROUTED TO CENTRAL CONSOLE LOG NODES.");
            if(document.getElementById('sosLogCounter')) {
                document.getElementById('sosLogCounter').innerText = `${data.active_sos_count} Active Emergency Triggers`;
            }
        });
    }
}

function submitCrewAttendance() {
    if (!CURRENT_SESSION_PROFILE || CURRENT_SESSION_PROFILE.role !== 'employee') return;
    fetch('http://127.0.0.1:5000/api/attendance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            emp_id: CURRENT_SESSION_PROFILE.emp_id || "MFS-EMP-UNK",
            username: CURRENT_SESSION_PROFILE.username
        })
    })
    .then(res => res.json())
    .then(data => alert(data.message));
}

function dispatchDeveloperTicket() {
    const issueText = document.getElementById('devIssueText').value;
    if(!issueText) return;
    fetch('http://127.0.0.1:5000/api/tickets/raise', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user: CURRENT_SESSION_PROFILE.username, issue: issueText })
    })
    .then(res => res.json())
    .then(data => {
        alert(`System Issue Logged! Tracking token: ${data.token}`);
        document.getElementById('devIssueText').value = '';
    });
}

function executeBillGeneration() {
    const email = document.getElementById('billClientEmail').value;
    const amount = document.getElementById('billAmount').value;
    fetch('http://127.0.0.1:5000/api/billing/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email: email, amount: amount })
    })
    .then(res => res.json())
    .then(data => {
        alert(`Billing Matrix Statement Committed. Generated Node ID: ${data.bill_id}`);
        syncAdminData();
    });
}

function initiateCheckout(id, amount) {
    if(!CURRENT_SESSION_PROFILE) { alert("Authorization Required: Sign In to complete transactions."); return; }
    ACTIVE_CHECKOUT_BILL_ID = id;
    document.getElementById('gatewayInvoiceRef').innerText = id;
    document.getElementById('gatewayAmountField').innerText = amount.toFixed(2);
    openModal('paymentGatewayModal');
}

function commitGatewayPayment() {
    fetch('http://127.0.0.1:5000/api/billing/pay', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ bill_id: ACTIVE_CHECKOUT_BILL_ID })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        closeModal('paymentGatewayModal');
    });
}

function syncAdminData() {
    fetch('http://127.0.0.1:5000/api/attendance/get')
    .then(res => res.json())
    .then(data => {
        const tbody = document.querySelector('#adminAttendanceTable tbody');
        tbody.innerHTML = data.map(x => `<tr><td>${x.emp_id}</td><td>${x.username}</td><td>${x.timestamp}</td></tr>`).join('');
    });
    fetch('http://127.0.0.1:5000/api/billing/get')
    .then(res => res.json())
    .then(data => {
        let sum = data.reduce((acc, current) => acc + current.amount, 0);
        document.getElementById('grossBillingField').innerText = `$${sum.toFixed(2)}`;
    });
}

function syncDeveloperData() {
    fetch('http://127.0.0.1:5000/api/tickets/get')
    .then(res => res.json())
    .then(data => {
        const tbody = document.querySelector('#devTicketsTable tbody');
        tbody.innerHTML = data.map(x => `<tr><td><strong>${x.ticket_id}</strong></td><td>${x.raised_by}</td><td>${x.issue}</td><td><span class="status-pill">${x.status}</span></td></tr>`).join('');
    });
}