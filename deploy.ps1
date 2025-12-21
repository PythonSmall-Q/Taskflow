#!/usr/bin/env pwsh
# Taskflow Zero - Automated Deployment Script
# This script automates the deployment process for Taskflow Zero

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'production')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipMigrations,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Taskflow Zero Deployment Script" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Blue

$commands = @('node', 'npm', 'wrangler')
foreach ($cmd in $commands) {
    if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Error: $cmd is not installed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ $cmd found" -ForegroundColor Green
}

# Check Node version
$nodeVersion = node --version
Write-Host "  Node version: $nodeVersion" -ForegroundColor Gray

# Check if in correct directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: Not in project root directory" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

# Run database migrations
if (!$SkipMigrations) {
    Write-Host ""
    Write-Host "🗄️  Running database migrations..." -ForegroundColor Blue
    
    if ($Environment -eq 'production') {
        $dbName = "taskflow-db"
        Write-Host "  Running migrations for production database..." -ForegroundColor Yellow
        wrangler d1 migrations apply $dbName -e production
    } else {
        $dbName = "taskflow-db"
        Write-Host "  Running migrations for local database..." -ForegroundColor Yellow
        wrangler d1 migrations apply $dbName --local
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Warning: Migrations may have failed" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Migrations completed" -ForegroundColor Green
    }
}

# Build frontend
if (!$SkipBuild) {
    Write-Host ""
    Write-Host "🏗️  Building frontend..." -ForegroundColor Blue
    npm --workspace @taskflow/web run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build frontend" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green
}

# Type check
Write-Host ""
Write-Host "🔍 Running type checks..." -ForegroundColor Blue
npm run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Type check failed" -ForegroundColor Yellow
    $continue = Read-Host "Continue deployment? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "  ✓ Type check passed" -ForegroundColor Green
}

# Deploy
Write-Host ""
Write-Host "🚀 Deploying to $Environment..." -ForegroundColor Blue

if ($Environment -eq 'production') {
    Write-Host ""
    Write-Host "⚠️  WARNING: You are about to deploy to PRODUCTION!" -ForegroundColor Red
    Write-Host "This will affect the live application." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
    
    if ($confirm -ne 'yes') {
        Write-Host "Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host ""
    Write-Host "Deploying to production..." -ForegroundColor Yellow
    wrangler deploy -e production
} else {
    Write-Host "Starting development server..." -ForegroundColor Yellow
    wrangler dev --config wrangler.toml
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green

if ($Environment -eq 'production') {
    Write-Host ""
    Write-Host "🎉 Your application is now live!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Test your application at your production URL"
    Write-Host "  2. Monitor logs with: wrangler tail -e production"
    Write-Host "  3. Check analytics in Cloudflare Dashboard"
    Write-Host ""
}

# Show useful commands
Write-Host ""
Write-Host "📚 Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:    wrangler tail -e $Environment"
Write-Host "  List secrets: wrangler secret list -e $Environment"
Write-Host "  Rollback:     wrangler rollback -e $Environment"
Write-Host ""
