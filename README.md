# 🎓 Gestionnaire d'Apprenants Non Licenciés

Application web pure (HTML/CSS/JavaScript) pour la gestion des apprenants non licenciés avec intégration **Supabase** et **SharePoint**.

## ✨ Fonctionnalités

- 📊 **Dashboard avec statistiques** en temps réel
- 👥 **Gestion des utilisateurs** non licenciés (397 apprenants)
- 🏢 **Gestion des sites SharePoint** (17 sites)
- ➕ **Inscription/désinscription** en masse
- 🔍 **Recherche et filtrage** avancés
- 📱 **Interface responsive** avec CSS Grid/Flexbox
- 🗄️ **Base de données Supabase** complète
- 🔐 **Logs d'audit** pour traçabilité

## 🚀 Déploiement sur Netlify

### Option 1 : Via GitHub

1. **Créer un repo GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE-USERNAME/gestionnaire-apprenants.git
git push -u origin main
```

2. **Connecter à Netlify**
   - Allez sur [netlify.com](https://netlify.com)
   - Cliquez "New site from Git"
   - Sélectionnez votre repo GitHub
   - Cliquez "Deploy site"

### Option 2 : Via Netlify Drop (le plus rapide)

1. Allez sur [app.netlify.com/drop](https://app.netlify.com/drop)
2. Glissez-déposez votre dossier de projet
3. C'est déployé ! 🎉

### Option 3 : Via Netlify CLI

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Se connecter
netlify login

# Déployer
netlify deploy --prod
```

## 🗄️ Configuration Supabase

### 1. Créer le schéma de base de données

Connectez-vous à votre dashboard Supabase et exécutez le script SQL fourni dans `schema.sql` (voir le fichier dans les artifacts précédents).

### 2. Récupérer vos identifiants

Dans votre dashboard Supabase :
- **Settings** → **API**
- Copiez l'**URL** et la **clé publique anon**

### 3. Configurer dans l'application

Les identifiants sont déjà pré-remplis dans `index.html` :
```javascript
value="https://shxalpzuumzlaupdoaqq.supabase.co"
value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Pour changer, modifiez directement les attributs `value` des inputs dans `index.html`.

## 📁 Structure du projet

```
gestionnaire-apprenants/
├── index.html              # Page principale
├── style.css              # Styles CSS
├── app.js                 # Logique application
├── supabase-client.js     # Client Supabase
├── netlify.toml           # Config Netlify
└── README.md              # Documentation
```

## 🔧 Développement local

```bash
# Ouvrir simplement index.html dans votre navigateur
# ou utiliser un serveur local :

# Avec Python
python -m http.server 8000

# Avec Node.js
npx serve

# Avec PHP
php -S localhost:8000
```

Puis ouvrez : `http://localhost:8000`

## 🎯 Utilisation

### 1. Connexion
- Cliquez sur "Connecter" (auto-connexion si pré-rempli)
- Vérifiez le statut "🟢 Supabase Connecté"

### 2. Inscription en masse
- Sélectionnez plusieurs apprenants (clic sur les cartes)
- Choisissez un site SharePoint
- Cliquez "Inscrire"

### 3. Désinscription
- Cliquez sur l'icône ❌ à côté du site dans la carte utilisateur

### 4. Recherche
- Tapez un nom ou email dans la barre de recherche
- Les résultats se filtrent en temps réel

## 📊 Données

L'application gère :
- **397 utilisateurs** non licenciés
- **17 sites SharePoint**
- **Logs d'audit** complets
- **Statistiques** temps réel

## 🔒 Sécurité

- ✅ Clé publique Supabase (safe côté client)
- ✅ Row Level Security (RLS) côté Supabase
- ✅ Headers de sécurité (via netlify.toml)
- ✅ HTTPS automatique sur Netlify

## 🌐 Variables d'environnement (optionnel)

Pour cacher les identifiants, utilisez les variables d'environnement Netlify :

1. Dans Netlify : **Site settings** → **Environment variables**
2. Ajoutez :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

Puis modifiez le code pour les lire (nécessite une fonction Netlify).

## 📈 Performance

- ⚡ **Chargement ultra-rapide** (pas de build)
- 🎯 **CDN global** via Netlify
- 🗜️ **Compression automatique**
- 📱 **Mobile-first** responsive

## 🛠️ Technologies

- HTML5
- CSS3 (Grid, Flexbox, Variables CSS)
- JavaScript ES6+
- [Supabase](https://supabase.com) - Backend as a Service
- [Lucide Icons](https://lucide.dev) - Icônes
- [Netlify](https://netlify.com) - Hébergement

## 📝 Licence

MIT License

## 👤 Auteur

Créé pour la gestion des apprenants non licenciés avec intégration SharePoint.

## 🆘 Support

Pour toute question :
- 📧 Email : support@votre-domaine.fr
- 🐛 Issues : GitHub Issues
- 📖 Docs : [Supabase Docs](https://supabase.com/docs)

---

**🎉 Votre application est prête à être déployée sur Netlify !**
