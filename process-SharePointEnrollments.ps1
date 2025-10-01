<#
.SYNOPSIS
    Traite les inscriptions SharePoint en attente depuis Supabase
.DESCRIPTION
    Ce script se connecte à Supabase, récupère les inscriptions en attente,
    et ajoute les utilisateurs aux sites SharePoint via PnP PowerShell
#>

# Configuration
$SupabaseUrl = "https://neaxxyzhggofkmdpfgjg.supabase.co"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYXh4eXpoZ2dvZmttZHBmZ2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2OTgzMzUsImV4cCI6MjA3NDI3NDMzNX0.2crri7mSdeHVHhun9hcu2w3j_xlc4J16-bhxTnABhYk"
$SharePointAdminUrl = "https://neosphere83-admin.sharepoint.com"
$LogFile = ".\enrollment-log-$(Get-Date -Format 'yyyyMMdd').txt"

# Fonction de log
function Write-Log {
    param($Message, $Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

# Fonction pour appeler Supabase
function Invoke-SupabaseAPI {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = $null
    )
    
    $headers = @{
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
        "Content-Type" = "application/json"
    }
    
    $url = "$SupabaseUrl/rest/v1/$Endpoint"
    
    try {
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body $bodyJson
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers
        }
        return $response
    } catch {
        Write-Log "Erreur API Supabase: $_" "ERROR"
        throw
    }
}

# Fonction pour récupérer les inscriptions en attente
function Get-PendingEnrollments {
    Write-Log "Récupération des inscriptions en attente..."
    
    # Requête directe sur la table avec jointures
    try {
        # Récupérer les inscriptions en attente
        $enrollments = Invoke-SupabaseAPI -Endpoint "pending_sharepoint_enrollments?status=eq.pending&order=requested_at.asc&select=*"
        
        if ($enrollments.Count -eq 0) {
            Write-Log "Trouvé 0 inscription(s) en attente"
            return @()
        }
        
        # Enrichir avec les données utilisateur et site
        $enrichedEnrollments = @()
        foreach ($enrollment in $enrollments) {
            # Récupérer les détails de l'utilisateur
            $user = Invoke-SupabaseAPI -Endpoint "users?id=eq.$($enrollment.user_id)&select=display_name,email,user_principal_name,object_id"
            
            # Récupérer les détails du site
            $site = Invoke-SupabaseAPI -Endpoint "sharepoint_sites?id=eq.$($enrollment.site_id)&select=name,url"
            
            if ($user.Count -gt 0 -and $site.Count -gt 0) {
                $enriched = @{
                    id = $enrollment.id
                    user_id = $enrollment.user_id
                    site_id = $enrollment.site_id
                    status = $enrollment.status
                    requested_at = $enrollment.requested_at
                    requested_by = $enrollment.requested_by
                    display_name = $user[0].display_name
                    email = $user[0].email
                    user_principal_name = $user[0].user_principal_name
                    object_id = $user[0].object_id
                    site_name = $site[0].name
                    site_url = $site[0].url
                }
                $enrichedEnrollments += New-Object PSObject -Property $enriched
            }
        }
        
        Write-Log "Trouvé $($enrichedEnrollments.Count) inscription(s) en attente"
        return $enrichedEnrollments
        
    } catch {
        Write-Log "Erreur lors de la récupération: $_" "ERROR"
        return @()
    }
}

# Fonction pour marquer une inscription comme en traitement
function Set-EnrollmentProcessing {
    param($EnrollmentId)
    
    $body = @{
        status = "processing"
    }
    
    Invoke-SupabaseAPI -Endpoint "pending_sharepoint_enrollments?id=eq.$EnrollmentId" -Method "PATCH" -Body $body
}

# Fonction pour marquer une inscription comme terminée
function Set-EnrollmentCompleted {
    param($EnrollmentId)
    
    $body = @{
        status = "completed"
        processed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    
    Invoke-SupabaseAPI -Endpoint "pending_sharepoint_enrollments?id=eq.$EnrollmentId" -Method "PATCH" -Body $body
}

# Fonction pour marquer une inscription comme échouée
function Set-EnrollmentFailed {
    param($EnrollmentId, $ErrorMessage)
    
    $body = @{
        status = "failed"
        processed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        error_message = $ErrorMessage
    }
    
    Invoke-SupabaseAPI -Endpoint "pending_sharepoint_enrollments?id=eq.$EnrollmentId" -Method "PATCH" -Body $body
}

# Fonction pour ajouter un utilisateur à un site SharePoint
function Add-UserToSharePointSite {
    param(
        [string]$SiteUrl,
        [string]$UserPrincipalName,
        [string]$GroupName = "Membres"
    )
    
    try {
        Write-Log "Connexion au site: $SiteUrl"
        
        # Utiliser votre App Registration existante
        $ClientId = "fa7b7ac8-f43d-4321-ac90-aca039da2f08"
        $TenantId = "718110a6-919e-4290-a9fb-89c4c942b6e1"
        
        # Connexion interactive avec votre App ID
        Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId -Tenant $TenantId
        
        Write-Log "Ajout de l'utilisateur: $UserPrincipalName au groupe: $GroupName"
        
        # Essayer d'abord d'ajouter au groupe par défaut
        try {
            Add-PnPGroupMember -LoginName $UserPrincipalName -Identity $GroupName
            Write-Log "Utilisateur ajouté au groupe '$GroupName'" "SUCCESS"
            return $true
        } catch {
            Write-Log "Échec ajout au groupe '$GroupName', essai avec 'Members'..." "WARN"
            Add-PnPGroupMember -LoginName $UserPrincipalName -Identity "Members"
            Write-Log "Utilisateur ajouté au groupe 'Members'" "SUCCESS"
            return $true
        }
        
    } catch {
        Write-Log "Erreur lors de l'ajout: $_" "ERROR"
        throw
    } finally {
        Disconnect-PnPOnline
    }
}

# Script principal
Write-Log "====== DÉBUT DU TRAITEMENT ======"
Write-Log "Connexion à Supabase: $SupabaseUrl"

# Vérifier la version de PowerShell et installer le bon module
$psVersion = $PSVersionTable.PSVersion.Major

if ($psVersion -lt 7) {
    Write-Log "PowerShell version $psVersion détectée. Installation de PnP.PowerShell 1.12.0 (compatible PS 5.1)..." "WARN"
    
    if (-not (Get-Module -ListAvailable -Name "PnP.PowerShell" | Where-Object { $_.Version -like "1.12.*" })) {
        Install-Module -Name "PnP.PowerShell" -RequiredVersion 1.12.0 -Force -AllowClobber -Scope CurrentUser
    }
    Import-Module PnP.PowerShell -RequiredVersion 1.12.0
    
} else {
    Write-Log "PowerShell $psVersion détecté. Installation de la dernière version de PnP.PowerShell..." "INFO"
    
    if (-not (Get-Module -ListAvailable -Name "PnP.PowerShell")) {
        Install-Module -Name "PnP.PowerShell" -Force -AllowClobber -Scope CurrentUser
    }
    Import-Module PnP.PowerShell
}

try {
    # Récupérer les inscriptions en attente
    $enrollments = Get-PendingEnrollments
    
    if ($enrollments.Count -eq 0) {
        Write-Log "Aucune inscription à traiter"
        exit 0
    }
    
    $successCount = 0
    $failCount = 0
    
    foreach ($enrollment in $enrollments) {
        Write-Log "----------------------------------------"
        Write-Log "Traitement: $($enrollment.display_name) -> $($enrollment.site_name)"
        
        try {
            # Marquer comme en traitement
            Set-EnrollmentProcessing -EnrollmentId $enrollment.id
            
            # Ajouter l'utilisateur au site
            Add-UserToSharePointSite -SiteUrl $enrollment.site_url -UserPrincipalName $enrollment.user_principal_name
            
            # Marquer comme terminé
            Set-EnrollmentCompleted -EnrollmentId $enrollment.id
            
            # Logger dans Supabase
            $logBody = @{
                user_id = $enrollment.user_id
                site_id = $enrollment.site_id
                action = "enroll"
                performed_by = "PowerShell Script"
                success = $true
                details = @{
                    script = "Process-SharePointEnrollments.ps1"
                    timestamp = Get-Date
                } | ConvertTo-Json
            }
            Invoke-SupabaseAPI -Endpoint "enrollment_logs" -Method "POST" -Body $logBody
            
            $successCount++
            Write-Log "Inscription réussie" "SUCCESS"
            
        } catch {
            $errorMsg = $_.Exception.Message
            Write-Log "Échec: $errorMsg" "ERROR"
            
            Set-EnrollmentFailed -EnrollmentId $enrollment.id -ErrorMessage $errorMsg
            
            # Logger l'échec
            $logBody = @{
                user_id = $enrollment.user_id
                site_id = $enrollment.site_id
                action = "enroll"
                performed_by = "PowerShell Script"
                success = $false
                error_message = $errorMsg
            }
            Invoke-SupabaseAPI -Endpoint "enrollment_logs" -Method "POST" -Body $logBody
            
            $failCount++
        }
        
        Start-Sleep -Seconds 2
    }
    
    Write-Log "====== RÉSUMÉ ======"
    Write-Log "Total traité: $($enrollments.Count)"
    Write-Log "Réussis: $successCount"
    Write-Log "Échecs: $failCount"
    Write-Log "====== FIN DU TRAITEMENT ======"
    
} catch {
    Write-Log "Erreur fatale: $_" "ERROR"
    exit 1
}