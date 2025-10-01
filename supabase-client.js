// supabase-client.js
// Configuration Supabase
let supabaseClient = null;

// Initialiser le client Supabase
function initSupabase(url, key) {
  try {
    supabaseClient = supabase.createClient(url, key);
    return true;
  } catch (error) {
    console.error("Erreur initialisation Supabase:", error);
    return false;
  }
}

// Test de connexion
async function testConnection() {
  if (!supabaseClient) {
    return { connected: false, error: "Client non initialisé" };
  }

  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("count", { count: "exact", head: true });

    if (error) throw error;
    return { connected: true, error: null };
  } catch (error) {
    console.error("Test connexion échoué:", error);
    return { connected: false, error: error.message };
  }
}

// Récupérer tous les utilisateurs avec leurs inscriptions
async function fetchUsersWithEnrollments() {
  if (!supabaseClient) {
    throw new Error("Client Supabase non initialisé");
  }

  try {
    const { data, error } = await supabaseClient
      .from("user_enrollments_view")
      .select("*")
      .order("display_name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erreur récupération utilisateurs:", error);
    throw error;
  }
}

// Récupérer tous les sites SharePoint actifs
async function fetchActiveSites() {
  if (!supabaseClient) {
    throw new Error("Client Supabase non initialisé");
  }

  try {
    const { data, error } = await supabaseClient
      .from("sharepoint_sites")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erreur récupération sites:", error);
    throw error;
  }
}

// Récupérer les statistiques
async function fetchStats() {
  if (!supabaseClient) {
    throw new Error("Client Supabase non initialisé");
  }

  try {
    const { count: totalUsers, error: usersError } = await supabaseClient
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (usersError) throw usersError;

    const { count: totalEnrollments, error: enrollmentsError } =
      await supabaseClient
        .from("user_site_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

    if (enrollmentsError) throw enrollmentsError;

    const { count: totalSites, error: sitesError } = await supabaseClient
      .from("sharepoint_sites")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (sitesError) throw sitesError;

    return {
      totalUsers: totalUsers || 0,
      totalEnrollments: totalEnrollments || 0,
      totalSites: totalSites || 0,
    };
  } catch (error) {
    console.error("Erreur récupération stats:", error);
    throw error;
  }
}

// Inscrire un utilisateur à un site
async function enrollUserToSite(userId, siteId, enrolledBy = "admin") {
  if (!supabaseClient) {
    throw new Error("Client Supabase non initialisé");
  }

  try {
    const { data, error } = await supabaseClient.rpc("enroll_user_to_site", {
      p_user_id: userId,
      p_site_id: siteId,
      p_enrolled_by: enrolledBy,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("Erreur inscription:", error);
    return { success: false, error: error.message };
  }
}

// Désinscrire un utilisateur d'un site
async function unenrollUserFromSite(userId, siteId, performedBy = "admin") {
  if (!supabaseClient) {
    throw new Error("Client Supabase non initialisé");
  }

  try {
    const { data, error } = await supabaseClient.rpc(
      "unenroll_user_from_site",
      {
        p_user_id: userId,
        p_site_id: siteId,
        p_performed_by: performedBy,
      }
    );

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("Erreur désinscription:", error);
    return { success: false, error: error.message };
  }
}
