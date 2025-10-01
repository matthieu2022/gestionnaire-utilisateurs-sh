// microsoft-graph.js
// Intégration Microsoft Graph API pour SharePoint

const msalConfig = {
  auth: {
    clientId: "fa7b7ac8-f43d-4321-ac90-aca039da2f08",
    authority:
      "https://login.microsoftonline.com/718110a6-919e-4290-a9fb-89c4c942b6e1",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: [
    "User.Read",
    "Sites.ReadWrite.All",
    "Group.ReadWrite.All",
    "Directory.Read.All",
  ],
};

let msalInstance = null;
let graphAccessToken = null;
let currentAccount = null;

async function initializeMSAL() {
  try {
    if (typeof msal === "undefined") {
      throw new Error("MSAL library not loaded");
    }

    msalInstance = new msal.PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
      return { success: true, account: currentAccount };
    }

    return { success: true, account: null };
  } catch (error) {
    console.error("Erreur initialisation MSAL:", error);
    return { success: false, error: error.message };
  }
}

async function loginMicrosoft() {
  try {
    if (!msalInstance) {
      await initializeMSAL();
    }

    const response = await msalInstance.loginPopup(loginRequest);
    currentAccount = response.account;
    graphAccessToken = response.accessToken;

    return {
      success: true,
      account: currentAccount,
      token: graphAccessToken,
    };
  } catch (error) {
    console.error("Erreur connexion Microsoft:", error);
    return { success: false, error: error.message };
  }
}

async function logoutMicrosoft() {
  try {
    if (!msalInstance || !currentAccount) {
      return { success: true };
    }

    await msalInstance.logoutPopup({
      account: currentAccount,
    });

    currentAccount = null;
    graphAccessToken = null;

    return { success: true };
  } catch (error) {
    console.error("Erreur déconnexion:", error);
    return { success: false, error: error.message };
  }
}

async function getGraphToken() {
  if (!msalInstance) {
    throw new Error("MSAL non initialisé");
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("Aucun compte connecté");
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: loginRequest.scopes,
      account: accounts[0],
    });
    graphAccessToken = response.accessToken;
    return graphAccessToken;
  } catch (error) {
    const response = await msalInstance.acquireTokenPopup(loginRequest);
    graphAccessToken = response.accessToken;
    return graphAccessToken;
  }
}

async function callGraphAPI(endpoint, method = "GET", body = null) {
  const token = await getGraphToken();

  const options = {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0${endpoint}`,
    options
  );

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.error?.message || errorMessage;
    } catch (e) {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return await response.json();
}

async function getSiteIdFromUrl(siteUrl) {
  try {
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const sitePath = url.pathname;

    const site = await callGraphAPI(`/sites/${hostname}:${sitePath}`);
    return site.id;
  } catch (error) {
    console.error("Erreur récupération site ID:", error);
    throw error;
  }
}

async function addUserToSharePointSite(userEmail, siteUrl) {
  try {
    const siteId = await getSiteIdFromUrl(siteUrl);
    console.log("Site ID:", siteId);

    const user = await callGraphAPI(`/users/${userEmail}`);
    console.log("Utilisateur trouvé:", user.displayName);

    const result = await callGraphAPI(`/sites/${siteId}/members`, "POST", {
      "@odata.type": "#microsoft.graph.user",
      id: user.id,
      roles: ["member"],
    });

    return {
      success: true,
      data: result,
      message: `${user.displayName} ajouté au site SharePoint`,
    };
  } catch (error) {
    console.error("Erreur ajout utilisateur SharePoint:", error);
    return {
      success: false,
      error: error.message,
      details: error,
    };
  }
}

async function removeUserFromSharePointSite(userEmail, siteUrl) {
  try {
    const siteId = await getSiteIdFromUrl(siteUrl);
    const user = await callGraphAPI(`/users/${userEmail}`);

    await callGraphAPI(`/sites/${siteId}/members/${user.id}/$ref`, "DELETE");

    return {
      success: true,
      message: `${user.displayName} retiré du site SharePoint`,
    };
  } catch (error) {
    console.error("Erreur retrait utilisateur SharePoint:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function listSiteMembers(siteUrl) {
  try {
    const siteId = await getSiteIdFromUrl(siteUrl);
    const members = await callGraphAPI(`/sites/${siteId}/members`);

    return {
      success: true,
      data: members.value || [],
      count: members.value?.length || 0,
    };
  } catch (error) {
    console.error("Erreur liste membres:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getCurrentUser() {
  try {
    const user = await callGraphAPI("/me");
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function isLoggedIn() {
  return currentAccount !== null && msalInstance !== null;
}

window.MicrosoftGraph = {
  initializeMSAL,
  loginMicrosoft,
  logoutMicrosoft,
  addUserToSharePointSite,
  removeUserFromSharePointSite,
  listSiteMembers,
  getCurrentUser,
  isLoggedIn,
  getAccount: () => currentAccount,
};
