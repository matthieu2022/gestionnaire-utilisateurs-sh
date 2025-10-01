# Script de test de connexion Supabase
# Pour diagnostiquer les problèmes de récupération des données

$SupabaseUrl = "https://neaxxyzhggofkmdpfgjg.supabase.co"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYXh4eXpoZ2dvZmttZHBmZ2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2OTgzMzUsImV4cCI6MjA3NDI3NDMzNX0.2crri7mSdeHVHhun9hcu2w3j_xlc4J16-bhxTnABhYk"

function Test-SupabaseEndpoint {
    param([string]$Endpoint, [string]$Description)
    
    Write-Host "`n=== $Description ===" -ForegroundColor Cyan
    Write-Host "Endpoint: $Endpoint" -ForegroundColor Gray
    
    $headers = @{
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
        "Content-Type" = "application/json"
    }
    
    $url = "$SupabaseUrl/rest/v1/$Endpoint"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
        
        if ($response -is [Array]) {
            Write-Host "✓ Succès - $($response.Count) enregistrement(s) trouvé(s)" -ForegroundColor Green
            if ($response.Count -gt 0) {
                Write-Host "`nPremier enregistrement:" -ForegroundColor Yellow
                $response[0] | Format-List
            }
        } else {
            Write-Host "✓ Succès - Réponse reçue" -ForegroundColor Green
            $response | Format-List
        }
        
        return $response
        
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        return $null
    }
}

Write-Host @"
╔════════════════════════════════════════════════════════════╗
║         TEST DE CONNEXION SUPABASE - DIAGNOSTIC            ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Test 1: Inscriptions en attente (table directe)
$pending = Test-SupabaseEndpoint `
    -Endpoint "pending_sharepoint_enrollments?status=eq.pending&select=*" `
    -Description "TEST 1: Inscriptions en attente (table)"

# Test 2: Tous les enregistrements
$all = Test-SupabaseEndpoint `
    -Endpoint "pending_sharepoint_enrollments?select=*&limit=10" `
    -Description "TEST 2: Tous les enregistrements pending_sharepoint_enrollments"

# Test 3: Vue (si elle existe)
$view = Test-SupabaseEndpoint `
    -Endpoint "pending_enrollments_view?status=eq.pending" `
    -Description "TEST 3: Vue pending_enrollments_view"

# Test 4: Utilisateurs
$users = Test-SupabaseEndpoint `
    -Endpoint "users?is_active=eq.true&limit=3&select=id,display_name,email" `
    -Description "TEST 4: Utilisateurs actifs"

# Test 5: Sites
$sites = Test-SupabaseEndpoint `
    -Endpoint "sharepoint_sites?is_active=eq.true&limit=3&select=id,name,url" `
    -Description "TEST 5: Sites SharePoint actifs"

# Résumé
Write-Host "`n" -NoNewline
Write-Host @"
╔════════════════════════════════════════════════════════════╗
║                      RÉSUMÉ DU TEST                        ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host "`nInscriptions en attente (table)  : " -NoNewline
if ($pending) { 
    Write-Host "$($pending.Count) trouvée(s)" -ForegroundColor Green 
} else { 
    Write-Host "Erreur" -ForegroundColor Red 
}

Write-Host "Vue pending_enrollments_view      : " -NoNewline
if ($view) { 
    Write-Host "$($view.Count) trouvée(s)" -ForegroundColor Green 
} else { 
    Write-Host "N'existe pas ou erreur" -ForegroundColor Yellow 
}

Write-Host "Utilisateurs actifs               : " -NoNewline
if ($users) { 
    Write-Host "$($users.Count) trouvé(s)" -ForegroundColor Green 
} else { 
    Write-Host "Erreur" -ForegroundColor Red 
}

Write-Host "Sites SharePoint actifs           : " -NoNewline
if ($sites) { 
    Write-Host "$($sites.Count) trouvé(s)" -ForegroundColor Green 
} else { 
    Write-Host "Erreur" -ForegroundColor Red 
}

# Recommandations
Write-Host "`n" -NoNewline
Write-Host @"
╔════════════════════════════════════════════════════════════╗
║                     RECOMMANDATIONS                        ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

if ($pending -and $pending.Count -gt 0) {
    Write-Host "`n✓ Vos données sont accessibles!" -ForegroundColor Green
    Write-Host "  → Le script principal devrait fonctionner avec la version mise à jour" -ForegroundColor White
} else {
    Write-Host "`n✗ Aucune inscription en attente trouvée" -ForegroundColor Yellow
    Write-Host "  → Vérifiez que vous avez bien des enregistrements avec status='pending'" -ForegroundColor White
    Write-Host "  → Exécutez dans Supabase SQL Editor:" -ForegroundColor White
    Write-Host "     SELECT * FROM pending_sharepoint_enrollments WHERE status = 'pending';" -ForegroundColor Gray
}

if (-not $view) {
    Write-Host "`n⚠ La vue pending_enrollments_view n'existe pas" -ForegroundColor Yellow
    Write-Host "  → Utilisez le script PowerShell mis à jour (version sans vue)" -ForegroundColor White
    Write-Host "  → OU créez la vue avec le script SQL fourni" -ForegroundColor White
}

Write-Host "`n"