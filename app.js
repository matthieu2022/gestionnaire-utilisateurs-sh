// app.js
// État de l'application
const appState = {
  users: [],
  sites: [],
  selectedUsers: new Set(),
  searchTerm: "",
  connected: false,
};

// État Microsoft
let microsoftConnected = false;
let microsoftAccount = null;

// Éléments DOM
const elements = {
  notification: document.getElementById("notification"),
  connectionStatus: document.getElementById("connectionStatus"),
  statusDot: document.querySelector(".status-dot"),
  statusText: document.querySelector(".status-text"),
  supabaseUrl: document.getElementById("supabaseUrl"),
  supabaseKey: document.getElementById("supabaseKey"),
  btnConnect: document.getElementById("btnConnect"),
  statUsers: document.getElementById("statUsers"),
  statEnrollments: document.getElementById("statEnrollments"),
  statSites: document.getElementById("statSites"),
  siteSelect: document.getElementById("siteSelect"),
  selectedCount: document.getElementById("selectedCount"),
  btnEnroll: document.getElementById("btnEnroll"),
  searchInput: document.getElementById("searchInput"),
  usersGrid: document.getElementById("usersGrid"),
  emptyState: document.getElementById("emptyState"),
  userCount: document.getElementById("userCount"),
};

// Éléments Microsoft
const microsoftElements = {
  btnLogin: document.getElementById("btnLoginMicrosoft"),
  btnLogout: document.getElementById("btnLogoutMicrosoft"),
  status: document.getElementById("microsoftStatus"),
};

// Notification
function showNotification(message, type = "info") {
  elements.notification.textContent = message;
  elements.notification.className = `notification ${type}`;
  elements.notification.classList.remove("hidden");

  setTimeout(() => {
    elements.notification.classList.add("hidden");
  }, 4000);
}

// Mettre à jour le statut de connexion
function updateConnectionStatus(connected, error = null) {
  appState.connected = connected;

  if (connected) {
    elements.statusDot.className = "status-dot online";
    elements.statusText.textContent = "Supabase Connecté";
  } else if (error) {
    elements.statusDot.className = "status-dot error";
    elements.statusText.textContent = "Erreur Connexion";
  } else {
    elements.statusDot.className = "status-dot offline";
    elements.statusText.textContent = "Non connecté";
  }
}

// Connexion à Supabase
async function handleConnect() {
  const url = elements.supabaseUrl.value.trim();
  const key = elements.supabaseKey.value.trim();

  if (!url || !key) {
    showNotification("Veuillez renseigner URL et clé Supabase", "error");
    return;
  }

  elements.btnConnect.disabled = true;
  elements.btnConnect.innerHTML =
    '<i data-lucide="refresh-cw" class="spinning"></i> Connexion...';
  lucide.createIcons();

  try {
    initSupabase(url, key);

    const { connected, error } = await testConnection();

    if (connected) {
      updateConnectionStatus(true);
      showNotification("Connexion Supabase réussie !", "success");
      await loadAllData();
    } else {
      updateConnectionStatus(false, error);
      showNotification("Erreur de connexion: " + error, "error");
    }
  } catch (error) {
    updateConnectionStatus(false, error);
    showNotification("Erreur: " + error.message, "error");
  } finally {
    elements.btnConnect.disabled = false;
    elements.btnConnect.innerHTML = '<i data-lucide="database"></i> Connecter';
    lucide.createIcons();
  }
}

// Charger toutes les données
async function loadAllData() {
  try {
    const [users, sites, stats] = await Promise.all([
      fetchUsersWithEnrollments(),
      fetchActiveSites(),
      fetchStats(),
    ]);

    appState.users = users;
    appState.sites = sites;

    updateStats(stats);
    renderSites();
    renderUsers();
  } catch (error) {
    console.error("Erreur chargement données:", error);
    showNotification("Erreur lors du chargement des données", "error");
  }
}

// Mettre à jour les statistiques
function updateStats(stats) {
  elements.statUsers.textContent = stats.totalUsers;
  elements.statEnrollments.textContent = stats.totalEnrollments;
  elements.statSites.textContent = stats.totalSites;
}

// Afficher les sites dans le dropdown
function renderSites() {
  elements.siteSelect.innerHTML =
    '<option value="">Sélectionner un site...</option>';

  appState.sites.forEach((site) => {
    const option = document.createElement("option");
    option.value = site.id;
    option.textContent = site.name;
    elements.siteSelect.appendChild(option);
  });
}

// Afficher les utilisateurs
function renderUsers() {
  const filteredUsers = filterUsers();
  elements.userCount.textContent = filteredUsers.length;

  if (filteredUsers.length === 0) {
    elements.usersGrid.innerHTML = "";
    elements.emptyState.classList.remove("hidden");
    return;
  }

  elements.emptyState.classList.add("hidden");
  elements.usersGrid.innerHTML = filteredUsers
    .map((user) => createUserCard(user))
    .join("");

  lucide.createIcons();
  attachUserCardListeners();
}

// Filtrer les utilisateurs selon la recherche
function filterUsers() {
  if (!appState.searchTerm) {
    return appState.users;
  }

  const term = appState.searchTerm.toLowerCase();
  return appState.users.filter(
    (user) =>
      user.display_name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
  );
}

// Créer une carte utilisateur
function createUserCard(user) {
  const isSelected = appState.selectedUsers.has(user.user_id);
  const activeSites = user.active_sites || [];
  const enrollmentCount = activeSites.length || 0;

  return `
        <div class="user-card ${isSelected ? "selected" : ""}" data-user-id="${
    user.user_id
  }">
            <div class="user-card-header">
                <div class="user-info">
                    <h3>${user.display_name}</h3>
                    <p class="user-email">
                        <i data-lucide="mail" style="width: 14px; height: 14px;"></i>
                        ${user.email}
                    </p>
                </div>
                <input 
                    type="checkbox" 
                    class="user-checkbox" 
                    ${isSelected ? "checked" : ""}
                    data-user-id="${user.user_id}"
                >
            </div>
            
            <div class="user-meta">
                <div class="meta-item">
                    <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                    ${new Date(user.created_date).toLocaleDateString("fr-FR")}
                </div>
                <div class="meta-item">
                    Inscriptions: 
                    <span class="enrollment-badge ${
                      enrollmentCount > 0 ? "badge-success" : "badge-gray"
                    }">
                        ${enrollmentCount}
                    </span>
                </div>
            </div>
            
            ${
              enrollmentCount > 0
                ? `
                <div class="user-enrollments">
                    <div class="enrollments-title">Sites d'inscription</div>
                    <div class="enrollment-list">
                        ${activeSites
                          .slice(0, 3)
                          .map(
                            (site) => `
                            <div class="enrollment-item">
                                <span class="enrollment-name">${site.site_name}</span>
                                <button class="btn-remove" data-user-id="${user.user_id}" data-site-id="${site.site_id}">
                                    <i data-lucide="minus" style="width: 14px; height: 14px;"></i>
                                </button>
                            </div>
                        `
                          )
                          .join("")}
                        ${
                          activeSites.length > 3
                            ? `
                            <div style="font-size: 0.75rem; color: var(--gray-500); text-align: center;">
                                +${activeSites.length - 3} autres...
                            </div>
                        `
                            : ""
                        }
                    </div>
                </div>
            `
                : ""
            }
        </div>
    `;
}

// Attacher les event listeners aux cartes utilisateur
function attachUserCardListeners() {
  document.querySelectorAll(".user-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("btn-remove") ||
        e.target.closest(".btn-remove")
      ) {
        return;
      }
      if (e.target.classList.contains("user-checkbox")) {
        return;
      }

      const userId = card.dataset.userId;
      toggleUserSelection(userId);
    });
  });

  document.querySelectorAll(".user-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      const userId = checkbox.dataset.userId;
      toggleUserSelection(userId);
    });
  });

  document.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const userId = btn.dataset.userId;
      const siteId = btn.dataset.siteId;
      await handleUnenroll(userId, siteId);
    });
  });
}

// Basculer la sélection d'un utilisateur
function toggleUserSelection(userId) {
  if (appState.selectedUsers.has(userId)) {
    appState.selectedUsers.delete(userId);
  } else {
    appState.selectedUsers.add(userId);
  }

  updateSelectionUI();
}

// Mettre à jour l'interface de sélection
function updateSelectionUI() {
  const count = appState.selectedUsers.size;
  elements.selectedCount.textContent = `${count} sélectionné${
    count > 1 ? "s" : ""
  }`;
  elements.btnEnroll.disabled = count === 0 || !elements.siteSelect.value;

  document.querySelectorAll(".user-card").forEach((card) => {
    const userId = card.dataset.userId;
    const checkbox = card.querySelector(".user-checkbox");

    if (appState.selectedUsers.has(userId)) {
      card.classList.add("selected");
      checkbox.checked = true;
    } else {
      card.classList.remove("selected");
      checkbox.checked = false;
    }
  });
}

// Gérer l'inscription en masse
async function handleEnrollUsers() {
  const siteId = parseInt(elements.siteSelect.value);
  const selectedCount = appState.selectedUsers.size;

  if (!siteId || selectedCount === 0) {
    showNotification("Sélectionnez un site et des utilisateurs", "error");
    return;
  }

  elements.btnEnroll.disabled = true;
  elements.btnEnroll.innerHTML =
    '<i data-lucide="refresh-cw" class="spinning"></i> Inscription...';
  lucide.createIcons();

  let successCount = 0;
  let errorCount = 0;
  const site = appState.sites.find((s) => s.id === siteId);

  try {
    for (const userId of appState.selectedUsers) {
      try {
        const user = appState.users.find((u) => u.user_id === userId);

        // 1. Enregistrer dans Supabase
        const supabaseResult = await enrollUserToSite(userId, siteId);

        // 2. Si Microsoft connecté, effectuer l'action réelle SharePoint
        if (microsoftConnected && window.MicrosoftGraph) {
          const graphResult =
            await window.MicrosoftGraph.addUserToSharePointSite(
              user.email,
              site.url
            );

          if (graphResult.success) {
            showNotification(
              `✅ ${user.display_name} ajouté à SharePoint`,
              "success"
            );
          } else {
            showNotification(
              `⚠️ ${user.display_name}: ${graphResult.error}`,
              "warning"
            );
          }
        }

        successCount++;
      } catch (error) {
        console.error(`Erreur pour ${userId}:`, error);
        errorCount++;
      }
    }

    appState.selectedUsers.clear();
    elements.siteSelect.value = "";

    if (successCount > 0) {
      const message = microsoftConnected
        ? `${successCount} inscription(s) effectuée(s) dans SharePoint`
        : `${successCount} inscription(s) enregistrée(s) (Microsoft non connecté)`;
      showNotification(message, "success");
    }
    if (errorCount > 0) {
      showNotification(`${errorCount} erreur(s)`, "error");
    }

    await loadAllData();
  } catch (error) {
    showNotification("Erreur: " + error.message, "error");
  } finally {
    elements.btnEnroll.disabled = false;
    elements.btnEnroll.innerHTML = '<i data-lucide="plus"></i> Inscrire';
    lucide.createIcons();
  }
}

// Gérer la désinscription
async function handleUnenroll(userId, siteId) {
  if (!confirm("Voulez-vous vraiment désinscrire cet apprenant de ce site ?")) {
    return;
  }

  try {
    const user = appState.users.find((u) => u.user_id === userId);
    const site = appState.sites.find((s) => s.id === parseInt(siteId));

    // 1. Désinscrire dans Supabase
    const result = await unenrollUserFromSite(userId, parseInt(siteId));

    // 2. Si Microsoft connecté, désinscrire de SharePoint
    if (microsoftConnected && window.MicrosoftGraph) {
      const graphResult =
        await window.MicrosoftGraph.removeUserFromSharePointSite(
          user.email,
          site.url
        );

      if (graphResult.success) {
        showNotification(
          `✅ ${user.display_name} retiré de SharePoint`,
          "success"
        );
      } else {
        showNotification(
          `⚠️ Erreur SharePoint: ${graphResult.error}`,
          "warning"
        );
      }
    }

    if (result.success) {
      showNotification("Apprenant désinscrit avec succès", "success");
      await loadAllData();
    } else {
      showNotification("Erreur: " + result.error, "error");
    }
  } catch (error) {
    showNotification("Erreur: " + error.message, "error");
  }
}

// Gérer la recherche
function handleSearch() {
  appState.searchTerm = elements.searchInput.value;
  renderUsers();
}

// Event Listeners Supabase
elements.btnConnect.addEventListener("click", handleConnect);
elements.btnEnroll.addEventListener("click", handleEnrollUsers);
elements.searchInput.addEventListener("input", handleSearch);

elements.siteSelect.addEventListener("change", () => {
  elements.btnEnroll.disabled =
    appState.selectedUsers.size === 0 || !elements.siteSelect.value;
});

// Event listeners Microsoft
microsoftElements.btnLogin.addEventListener("click", async () => {
  const result = await window.MicrosoftGraph.loginMicrosoft();
  if (result.success) {
    microsoftConnected = true;
    microsoftAccount = result.account;
    microsoftElements.status.textContent = `✅ Connecté: ${result.account.username}`;
    microsoftElements.btnLogin.classList.add("hidden");
    microsoftElements.btnLogout.classList.remove("hidden");
    showNotification("Connexion Microsoft réussie !", "success");
  } else {
    showNotification("Erreur: " + result.error, "error");
  }
});

microsoftElements.btnLogout.addEventListener("click", async () => {
  await window.MicrosoftGraph.logoutMicrosoft();
  microsoftConnected = false;
  microsoftAccount = null;
  microsoftElements.status.textContent = "";
  microsoftElements.btnLogin.classList.remove("hidden");
  microsoftElements.btnLogout.classList.add("hidden");
  showNotification("Déconnexion réussie", "info");
});

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  // Initialiser Microsoft au chargement
  if (window.MicrosoftGraph) {
    window.MicrosoftGraph.initializeMSAL().then((result) => {
      if (result.success && result.account) {
        microsoftConnected = true;
        microsoftAccount = result.account;
        microsoftElements.status.textContent = `✅ ${result.account.username}`;
        microsoftElements.btnLogin.classList.add("hidden");
        microsoftElements.btnLogout.classList.remove("hidden");
      }
    });
  }

  // Auto-connexion Supabase si les champs sont pré-remplis
  if (elements.supabaseUrl.value && elements.supabaseKey.value) {
    setTimeout(() => {
      handleConnect();
    }, 500);
  }
});
