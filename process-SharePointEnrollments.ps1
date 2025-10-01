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
    
    $enrollments = Invoke-SupabaseAPI -Endpoint "pending_enrollments_view?status=eq.pending&order=requested_at.asc"
    
    Write-Log "Trouvé $($enrollments.Count) inscription(s) en attente"
    return $enrollments
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
        Connect-PnPOnline -Url $SiteUrl -Interactive
        
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

# Vérifier que PnP PowerShell est installé
if (-not (Get-Module -ListAvailable -Name "PnP.PowerShell")) {
    Write-Log "Module PnP.PowerShell non trouvé. Installation..." "WARN"
    Install-Module -Name "PnP.PowerShell" -Force -AllowClobber
}

Import-Module PnP.PowerShell

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