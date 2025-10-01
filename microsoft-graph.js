// microsoft-graph.js
import { PublicClientApplication } from "@azure/msal-browser";

// Configuration MSAL (Microsoft Authentication Library)
const msalConfig = {
  auth: {
    clientId: "VOTRE-CLIENT-ID-AZURE",
    authority: "https://login.microsoftonline.com/VOTRE-TENANT-ID",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: ["User.Read", "Sites.ReadWrite.All", "Group.ReadWrite.All"],
};

let msalInstance = null;
let graphAccessToken = null;

// Initialiser MSAL
export async function initializeMSAL() {
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();
  return msalInstance;
}

// Connexion utilisateur
export async function loginMicrosoft() {
  try {
    const response = await msalInstance.loginPopup(loginRequest);
    graphAccessToken = response.accessToken;
    return { success: true, account: response.account };
  } catch (error) {
    console.error("Erreur connexion Microsoft:", error);
    return { success: false, error: error.message };
  }
}

// Obtenir un token d'accès
export async function getGraphToken() {
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
    // Si le token silencieux échoue, redemander la connexion
    const response = await msalInstance.acquireTokenPopup(loginRequest);
    graphAccessToken = response.accessToken;
    return graphAccessToken;
  }
}

// Appel générique à Microsoft Graph
async function callGraphAPI(endpoint, method = "GET", body = null) {
  const token = await getGraphToken();

  const options = {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0${endpoint}`,
    options
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return await response.json();
}

// Ajouter un utilisateur à un site SharePoint
export async function addUserToSharePointSite(userEmail, siteUrl) {
  try {
    // 1. Extraire le site ID depuis l'URL
    const siteId = await getSiteIdFromUrl(siteUrl);

    // 2. Récupérer l'utilisateur par email
    const user = await callGraphAPI(`/users/${userEmail}`);

    // 3. Ajouter l'utilisateur au site
    const result = await callGraphAPI(`/sites/${siteId}/members`, "POST", {
      "@odata.type": "#microsoft.graph.user",
      id: user.id,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Erreur ajout utilisateur SharePoint:", error);
    return { success: false, error: error.message };
  }
}

// Retirer un utilisateur d'un site SharePoint
export async function removeUserFromSharePointSite(userEmail, siteUrl) {
  try {
    const siteId = await getSiteIdFromUrl(siteUrl);
    const user = await callGraphAPI(`/users/${userEmail}`);

    await callGraphAPI(`/sites/${siteId}/members/${user.id}/$ref`, "DELETE");

    return { success: true };
  } catch (error) {
    console.error("Erreur retrait utilisateur SharePoint:", error);
    return { success: false, error: error.message };
  }
}

// Obtenir le site ID depuis l'URL
async function getSiteIdFromUrl(siteUrl) {
  // Extraire le hostname et le chemin du site
  const url = new URL(siteUrl);
  const hostname = url.hostname; // ex: neosphere83.sharepoint.com
  const sitePath = url.pathname; // ex: /sites/RETAC20252026

  // Appeler Graph pour obtenir le site
  const site = await callGraphAPI(`/sites/${hostname}:${sitePath}`);

  return site.id;
}

// Lister les membres d'un site
export async function listSiteMembers(siteUrl) {
  try {
    const siteId = await getSiteIdFromUrl(siteUrl);
    const members = await callGraphAPI(`/sites/${siteId}/members`);
    return { success: true, data: members.value };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
