// Event type icons mapping
const eventIcons = {
    'Hackathon': '💻',
    'Workshop': '🎯',
    'Competition': '🏆',
    'Seminar': '📚',
    'Session': '🎤',
    'Meetup': '🤝'
};

// Current user data
let currentUser = null;

// Initialize the application
function initializeApp() {
    loadClubs();
    loadEvents();
    setupEventListeners();
    setupAuthStateListener();
}

// Setup auth state listener
function setupAuthStateListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            try {
                console.log('User signed in:', user.email, 'UID:', user.uid);
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    console.log('User data found:', userData);
                    
                    // Check if user is approved
                    if (userData.status !== 'approved') {
                        console.log('User not approved, status:', userData.status);
                        alert('Your account is pending approval. Please wait for admin approval.');
                        await auth.signOut();
                        return;
                    }
                    
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        ...userData
                    };
                    console.log('Login successful!');
                    updateUIForLoggedInUser();
                } else {
                    // User document doesn't exist
                    console.error('No user document found in Firestore for UID:', user.uid);
                    alert('User profile not found. Please contact administrator.\nUID: ' + user.uid);
                    await auth.signOut();
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                alert('Error loading user data: ' + error.message);
                await auth.signOut();
            }
        } else {
            // User is signed out
            console.log('User signed out');
            currentUser = null;
            updateUIForLoggedOutUser();
        }
    });
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');
    const roleBadge = document.getElementById('userRole');
    const loginModal = document.getElementById('loginModal');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userEmail) userEmail.textContent = currentUser.email;
    
    // Set role badge
    if (roleBadge && currentUser.role === 'super_admin') {
        roleBadge.textContent = 'Super Admin';
        roleBadge.style.background = '#8b7355';
    } else if (roleBadge && currentUser.role === 'club_admin') {
        roleBadge.textContent = `${currentUser.clubName} Admin`;
        roleBadge.style.background = '#d4a574';
    }
    
    // Show/hide navigation based on role
    if (currentUser.role === 'super_admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = 'block');
    } else if (currentUser.role === 'club_admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = 'none');
        
        // Hide admin applications tab button for club admins
        const adminTabBtn = document.querySelector('.tab-btn:first-child');
        if (adminTabBtn) {
            adminTabBtn.style.display = 'none';
        }
        
        // For club admins, pre-select their club in event form
        const eventClubSelect = document.getElementById('eventClub');
        if (eventClubSelect) {
            eventClubSelect.value = currentUser.clubName;
            eventClubSelect.disabled = true;
        }
    }
    
    // Close login modal if open
    if (loginModal) {
        loginModal.classList.remove('active');
    }
}

// Update UI for logged out user
function updateUIForLoggedOutUser() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    
    if (loginBtn) loginBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    
    // Hide admin sections
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.super-admin-only').forEach(el => el.style.display = 'none');
    
    // Show admin tab button again
    const adminTabBtn = document.querySelector('.tab-btn:first-child');
    if (adminTabBtn) {
        adminTabBtn.style.display = 'block';
    }
    
    // Redirect to home if on admin pages
    const postEventSection = document.getElementById('post-event');
    const manageRequestsSection = document.getElementById('manage-requests');
    
    if ((postEventSection && postEventSection.classList.contains('active')) ||
        (manageRequestsSection && manageRequestsSection.classList.contains('active'))) {
        showSection('home');
    }
}

// Show login modal
function showLogin() {
    document.getElementById('loginModal').classList.add('active');
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Auth state listener will handle UI update and approval check
        document.getElementById('loginForm').reset();
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = getErrorMessage(error.code);
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Logout
async function logout() {
    try {
        await auth.signOut();
        const currentSection = document.querySelector('.section.active');
        if (currentSection && (currentSection.id === 'post-event' || currentSection.id === 'manage-requests')) {
            showSection('home');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

// Get user-friendly error messages
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No user found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        default:
            return 'Login failed. Please check your credentials.';
    }
}

// Load clubs from Firebase
async function loadClubs() {
    try {
        const clubsSnapshot = await db.collection('clubs').orderBy('name').get();
        const clubs = [];
        
        clubsSnapshot.forEach(doc => {
            clubs.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // If no clubs exist, initialize with default data
        if (clubs.length === 0) {
            await initializeDefaultClubs();
            loadClubs(); // Reload after initialization
            return;
        }

        displayClubs(clubs);
        populateClubSelects(clubs);
    } catch (error) {
        console.error('Error loading clubs:', error);
        showErrorMessage('Failed to load clubs. Please refresh the page.');
    }
}

// Initialize default clubs data
async function initializeDefaultClubs() {
    const defaultClubs = [
        {
            name: "Coding Club",
            description: "Master programming languages, participate in competitive coding, and build innovative projects.",
            incharge: "Dr. Rajesh Kumar",
            members: 156,
            activities: "Weekly coding sessions, hackathons, tech talks, project showcases",
            contact: "coding.club@mitindia.edu"
        },
        {
            name: "Robotics Club",
            description: "Design, build, and program robots. Participate in national robotics competitions.",
            incharge: "Prof. Anita Sharma",
            members: 89,
            activities: "Robot building workshops, Arduino sessions, competition prep",
            contact: "robotics@mitindia.edu"
        },
        {
            name: "Literary Club",
            description: "Express yourself through poetry, stories, debates, and creative writing workshops.",
            incharge: "Dr. Priya Menon",
            members: 134,
            activities: "Poetry slams, book discussions, writing workshops, debates",
            contact: "literary@mitindia.edu"
        },
        {
            name: "Music Club",
            description: "Learn instruments, vocal training, form bands, and perform at college events.",
            incharge: "Mr. Arjun Nair",
            members: 178,
            activities: "Jam sessions, music festivals, instrument training, performances",
            contact: "music@mitindia.edu"
        },
        {
            name: "Photography Club",
            description: "Capture moments, learn techniques, and showcase your work in exhibitions.",
            incharge: "Ms. Kavya Iyer",
            members: 112,
            activities: "Photo walks, editing workshops, exhibitions, competitions",
            contact: "photography@mitindia.edu"
        },
        {
            name: "Drama Club",
            description: "Act, direct, and produce plays. Develop confidence and stage presence.",
            incharge: "Dr. Vikram Singh",
            members: 95,
            activities: "Theater productions, street plays, acting workshops, festivals",
            contact: "drama@mitindia.edu"
        },
        {
            name: "Environmental Club",
            description: "Promote sustainability, organize tree plantations, and awareness campaigns.",
            incharge: "Prof. Lakshmi Devi",
            members: 143,
            activities: "Tree plantation drives, cleanup campaigns, workshops, awareness programs",
            contact: "environment@mitindia.edu"
        },
        {
            name: "Dance Club",
            description: "Learn various dance forms from hip-hop to classical, and perform at events.",
            incharge: "Ms. Sneha Reddy",
            members: 167,
            activities: "Dance workshops, choreography sessions, competitions, performances",
            contact: "dance@mitindia.edu"
        },
        {
            name: "Entrepreneurship Club",
            description: "Turn ideas into startups. Learn business skills, pitch to investors, and network.",
            incharge: "Mr. Karthik Krishnan",
            members: 121,
            activities: "Startup workshops, pitch competitions, mentorship, business seminars",
            contact: "entrepreneurship@mitindia.edu"
        },
        {
            name: "Sports Club",
            description: "Stay fit, compete in tournaments, and represent the college in various sports.",
            incharge: "Coach Ramesh Patel",
            members: 203,
            activities: "Daily practice sessions, tournaments, fitness training, sports events",
            contact: "sports@mitindia.edu"
        }
    ];

    const batch = db.batch();
    defaultClubs.forEach(club => {
        const clubRef = db.collection('clubs').doc();
        batch.set(clubRef, club);
    });

    await batch.commit();
    console.log('Default clubs initialized');
}

// Display clubs in the UI
function displayClubs(clubs) {
    const homeContainer = document.getElementById('homeClubsPreview');
    const allContainer = document.getElementById('allClubsGrid');
    
    const clubsHTML = clubs.map(club => `
        <div class="club-card">
            <h3>${club.name}</h3>
            <p>${club.description}</p>
            <p><strong>Activities:</strong> ${club.activities}</p>
            <div class="club-meta">
                <p><strong>Incharge:</strong> ${club.incharge}</p>
                <p><strong>Contact:</strong> ${club.contact}</p>
                <p><strong>Members:</strong> ${club.members}</p>
            </div>
        </div>
    `).join('');

    homeContainer.innerHTML = clubsHTML;
    allContainer.innerHTML = clubsHTML;
}

// Populate club select dropdowns
function populateClubSelects(clubs) {
    const selects = ['clubSelect', 'eventClub', 'adminClub'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const options = '<option value="">Select Club</option>' +
                clubs.map(club => `<option value="${club.name}">${club.name}</option>`).join('');
            select.innerHTML = options;
        }
    });
}

// Load events from Firebase
async function loadEvents() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const eventsSnapshot = await db.collection('events')
            .orderBy('date', 'asc')
            .get();
        
        const events = [];
        eventsSnapshot.forEach(doc => {
            const eventData = doc.data();
            let eventDate;
            
            if (eventData.date?.toDate) {
              eventDate = eventData.date.toDate();
            } else {
              eventDate = new Date(eventData.date); // fallback for old data
            }

            
            // Filter for future events on client side
            if (eventDate >= today) {
                events.push({
                    id: doc.id,
                    ...eventData
                });
            }
        });

        // Sort by date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        displayEvents(events);
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('eventsList').innerHTML = 
            '<p style="text-align: center; color: #5a5a5a;">Error loading events. Please refresh the page.</p>';
    }
}

// Display events in the UI
function displayEvents(events) {
    const container = document.getElementById('eventsList');
    
    if (events.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #5a5a5a;">No upcoming events at the moment. Check back soon!</p>';
        return;
    }

    const eventsHTML = events.map(event => {
        let eventDate;

        // Handle Firestore Timestamp safely
        if (event.date?.toDate) {
            eventDate = event.date.toDate();
        } else {
            eventDate = new Date(event.date); // fallback
        }
        
        const formattedDate = eventDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });

        return `
            <div class="event-card">
                <div class="event-image">${eventIcons[event.type] || '📅'}</div>
                <div class="event-content">
                    <h4>${event.title}</h4>
                    <p><strong>${event.club}</strong></p>
                    <p>${event.description}</p>
                    <div class="event-meta">
                        <div class="event-meta-item">📅 ${formattedDate}</div>
                        <div class="event-meta-item">🕐 ${event.time}</div>
                        <div class="event-meta-item">📍 ${event.venue}</div>
                        <div class="event-meta-item">🏷️ ${event.type}</div>
                    </div>
                    ${event.regLink ? `<a href="${event.regLink}" target="_blank" rel="noopener noreferrer"><button class="btn-primary" style="margin-top: 15px;">Register</button></a>` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = eventsHTML;
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Club registration form
    document.getElementById('registrationForm').addEventListener('submit', handleClubRegistration);
    
    // Admin registration form
    document.getElementById('adminRegistrationForm').addEventListener('submit', handleAdminRegistration);
    
    // Event form
    document.getElementById('eventForm').addEventListener('submit', handleEventPost);
    
    // Close modal when clicking outside
    document.getElementById('loginModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
}

// Handle club registration (student joining a club)
async function handleClubRegistration(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    
    const registration = {
        studentName: document.getElementById('studentName').value,
        studentEmail: document.getElementById('studentEmail').value,
        studentYear: document.getElementById('studentYear').value,
        studentDept: document.getElementById('studentDept').value,
        clubName: document.getElementById('clubSelect').value,
        joinReason: document.getElementById('joinReason').value,
        status: 'pending',
        type: 'club_join',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('requests').add(registration);
        
        showSuccessMessage('regSuccess');
        document.getElementById('registrationForm').reset();
    } catch (error) {
        console.error('Error submitting registration:', error);
        showErrorMessage('Failed to submit registration. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Registration';
    }
}

// Handle admin registration
async function handleAdminRegistration(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const name = document.getElementById('adminName').value;
    const phone = document.getElementById('adminPhone').value;
    const clubName = document.getElementById('adminClub').value;
    const reason = document.getElementById('adminReason').value;
    
    try {
        // Create auth account (but it will be pending approval)
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        // Create pending user document
        await db.collection('users').doc(userId).set({
            email: email,
            name: name,
            phone: phone,
            role: 'club_admin',
            clubName: clubName,
            status: 'pending',
            reason: reason,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Also add to requests collection for easy management
        await db.collection('requests').add({
            userId: userId,
            name: name,
            email: email,
            phone: phone,
            clubName: clubName,
            reason: reason,
            type: 'admin_request',
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Sign out the newly created user
        await auth.signOut();
        
        showSuccessMessage('adminRegSuccess');
        document.getElementById('adminRegistrationForm').reset();
        
        // Show info
        alert('Application submitted successfully! You will receive an email once your account is approved.');
        
    } catch (error) {
        console.error('Error submitting admin application:', error);
        const errorDiv = document.getElementById('adminRegError');
        errorDiv.textContent = getAdminRegErrorMessage(error.code);
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 7000);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Application';
    }
}

// Get admin registration error messages
function getAdminRegErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please login or use a different email.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/weak-password':
            return 'Password is too weak. Use at least 6 characters.';
        default:
            return 'Failed to submit application. Please try again.';
    }
}

// Handle event post
async function handleEventPost(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('You must be logged in to post events.');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Posting...';
    
    const event = {
        title: document.getElementById('eventTitle').value,
        club: document.getElementById('eventClub').value,
        type: document.getElementById('eventType').value,
        date: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('eventDate').value)),
        time: document.getElementById('eventTime').value,
        venue: document.getElementById('eventVenue').value,
        description: document.getElementById('eventDesc').value,
        regLink: document.getElementById('eventRegLink').value,
        postedBy: currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('events').add(event);
        
        showSuccessMessage('eventSuccess');
        document.getElementById('eventForm').reset();
        
        // Reset club select for super admin
        if (currentUser.role === 'super_admin') {
            document.getElementById('eventClub').value = '';
        }
        
        // Reload events
        await loadEvents();
    } catch (error) {
        console.error('Error posting event:', error);
        const errorDiv = document.getElementById('eventError');
        errorDiv.textContent = 'Failed to post event. Please try again.';
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Post Event';
    }
}

// Load admin requests
async function loadAdminRequests() {
    try {
        const requestsSnapshot = await db.collection('requests')
            .where('type', '==', 'admin_request')
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .get();
        
        const requests = [];
        requestsSnapshot.forEach(doc => {
            requests.push({
                id: doc.id,
                ...doc.data()
            });
        });

        displayAdminRequests(requests);
    } catch (error) {
        console.error('Error loading admin requests:', error);
        const container = document.getElementById('adminRequestsList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #dc3545;">Error loading requests.</p>';
        }
    }
}

// Display admin requests
function displayAdminRequests(requests) {
    const container = document.getElementById('adminRequestsList');
    
    if (!container) return;
    
    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #5a5a5a; padding: 40px;">No pending admin applications.</p>';
        return;
    }

    const requestsHTML = requests.map(request => {
        const date = request.timestamp ? new Date(request.timestamp.toDate()).toLocaleDateString() : 'N/A';
        return `
            <div class="request-card">
                <div class="request-header">
                    <h4>${request.name}</h4>
                    <span class="status-badge pending">Pending</span>
                </div>
                <div class="request-details">
                    <p><strong>Email:</strong> ${request.email}</p>
                    <p><strong>Phone:</strong> ${request.phone}</p>
                    <p><strong>Requested Club:</strong> ${request.clubName}</p>
                    <p><strong>Applied:</strong> ${date}</p>
                    <p><strong>Reason:</strong></p>
                    <p class="request-reason">${request.reason}</p>
                </div>
                <div class="request-actions">
                    <button class="btn-success" onclick="approveAdminRequest('${request.id}', '${request.userId}')">Approve</button>
                    <button class="btn-danger" onclick="rejectAdminRequest('${request.id}', '${request.userId}')">Reject</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = requestsHTML;
}

// Load club join requests
async function loadClubRequests() {
    try {
        let query = db.collection('requests')
            .where('type', '==', 'club_join')
            .where('status', '==', 'pending');
        
        // If club admin, only show their club's requests
        if (currentUser && currentUser.role === 'club_admin') {
            query = query.where('clubName', '==', currentUser.clubName);
        }
        
        const requestsSnapshot = await query.orderBy('timestamp', 'desc').get();
        
        const requests = [];
        requestsSnapshot.forEach(doc => {
            requests.push({
                id: doc.id,
                ...doc.data()
            });
        });

        displayClubRequests(requests);
    } catch (error) {
        console.error('Error loading club requests:', error);
        const container = document.getElementById('clubRequestsList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #dc3545;">Error loading requests.</p>';
        }
    }
}

// Display club join requests
function displayClubRequests(requests) {
    const container = document.getElementById('clubRequestsList');
    
    if (!container) return;
    
    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #5a5a5a; padding: 40px;">No pending club join requests.</p>';
        return;
    }

    const requestsHTML = requests.map(request => {
        const date = request.timestamp ? new Date(request.timestamp.toDate()).toLocaleDateString() : 'N/A';
        return `
            <div class="request-card">
                <div class="request-header">
                    <h4>${request.studentName}</h4>
                    <span class="status-badge pending">Pending</span>
                </div>
                <div class="request-details">
                    <p><strong>Email:</strong> ${request.studentEmail}</p>
                    <p><strong>Year:</strong> Year ${request.studentYear}</p>
                    <p><strong>Department:</strong> ${request.studentDept}</p>
                    <p><strong>Club:</strong> ${request.clubName}</p>
                    <p><strong>Applied:</strong> ${date}</p>
                    ${request.joinReason ? `
                        <p><strong>Reason:</strong></p>
                        <p class="request-reason">${request.joinReason}</p>
                    ` : ''}
                </div>
                <div class="request-actions">
                    <button class="btn-success" onclick="approveClubRequest('${request.id}', '${request.clubName}')">Approve</button>
                    <button class="btn-danger" onclick="rejectClubRequest('${request.id}')">Reject</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = requestsHTML;
}

// Approve admin request
async function approveAdminRequest(requestId, userId) {
    if (!confirm('Approve this admin application?')) return;
    
    try {
        // Update user status to approved
        await db.collection('users').doc(userId).update({
            status: 'approved'
        });
        
        // Update request status
        await db.collection('requests').doc(requestId).update({
            status: 'approved',
            approvedBy: currentUser.email,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Admin application approved! The user can now login.');
        loadAdminRequests();
        
    } catch (error) {
        console.error('Error approving request:', error);
        alert('Failed to approve request. Please try again.');
    }
}

// Reject admin request
async function rejectAdminRequest(requestId, userId) {
    if (!confirm('Reject this admin application? This will delete their account.')) return;
    
    try {
        // Delete user document
        await db.collection('users').doc(userId).delete();
        
        // Update request status
        await db.collection('requests').doc(requestId).update({
            status: 'rejected',
            rejectedBy: currentUser.email,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Note: We can't delete from Firebase Auth from client side
        // The auth account will remain but they won't be able to login (no user doc)
        
        alert('Admin application rejected. The user account has been removed.');
        loadAdminRequests();
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Failed to reject request. Please try again.');
    }
}

// Approve club join request
async function approveClubRequest(requestId, clubName) {
    if (!confirm('Approve this club join request?')) return;
    
    try {
        // Update request status
        await db.collection('requests').doc(requestId).update({
            status: 'approved',
            approvedBy: currentUser.email,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update club member count
        const clubsSnapshot = await db.collection('clubs')
            .where('name', '==', clubName)
            .get();
        
        if (!clubsSnapshot.empty) {
            const clubDoc = clubsSnapshot.docs[0];
            await clubDoc.ref.update({
                members: firebase.firestore.FieldValue.increment(1)
            });
            loadClubs(); // Reload clubs to show updated count
        }
        
        alert('Club join request approved!');
        loadClubRequests();
        
    } catch (error) {
        console.error('Error approving request:', error);
        alert('Failed to approve request. Please try again.');
    }
}

// Reject club join request
async function rejectClubRequest(requestId) {
    if (!confirm('Reject this club join request?')) return;
    
    try {
        await db.collection('requests').doc(requestId).update({
            status: 'rejected',
            rejectedBy: currentUser.email,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Club join request rejected.');
        loadClubRequests();
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Failed to reject request. Please try again.');
    }
}

// Switch tabs
function switchTab(tabName, buttonElement) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabName === 'admin') {
        document.getElementById('adminRequestsTab').classList.add('active');
        if (currentUser && currentUser.role === 'super_admin') {
            loadAdminRequests();
        }
    } else if (tabName === 'club') {
        document.getElementById('clubRequestsTab').classList.add('active');
        loadClubRequests();
    }
}

// Show success message
function showSuccessMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 4000);
    }
}

// Show error message
function showErrorMessage(message) {
    alert(message);
}

// Show section navigation
function showSection(sectionId) {
    // Check authentication for admin pages
    if ((sectionId === 'post-event' || sectionId === 'manage-requests') && !currentUser) {
        alert('Please login to access this section.');
        showLogin();
        return;
    }
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to corresponding nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const onclick = link.getAttribute('onclick');
        if (onclick && onclick.includes(`'${sectionId}'`)) {
            link.classList.add('active');
        }
    });
    
    // Load requests if showing manage-requests section
    if (sectionId === 'manage-requests') {
        // Set club tab as active by default
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const clubTabBtn = document.querySelector('.tab-btn:last-child');
        if (clubTabBtn) {
            clubTabBtn.classList.add('active');
        }
        
        document.getElementById('clubRequestsTab').classList.add('active');
        document.getElementById('adminRequestsTab').classList.remove('active');
        
        loadClubRequests();
        if (currentUser && currentUser.role === 'super_admin') {
            loadAdminRequests();
        }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize the app when DOM is loaded

document.addEventListener('DOMContentLoaded', initializeApp);


