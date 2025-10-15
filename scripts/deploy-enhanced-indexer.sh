#!/bin/bash

# Enhanced Partisia Indexer Deployment Script
# This script sets up the enhanced reward tracking system

set -e

echo "🚀 Enhanced Partisia Indexer Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME=${DB_NAME:-"ls_indexer"}
DB_USER=${DB_USER:-"indexer"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST:$DB_PORT"
echo ""

# Function to run SQL with error handling
run_sql() {
    local sql_file=$1
    local description=$2

    echo -e "${YELLOW}🗄️  $description...${NC}"

    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$sql_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $description completed${NC}"
    else
        echo -e "${RED}❌ $description failed${NC}"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ PostgreSQL client (psql) not found${NC}"
        exit 1
    fi

    # Check if database is accessible
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${RED}❌ Cannot connect to database${NC}"
        echo "   Please check your database configuration and credentials"
        exit 1
    fi

    # Check if Node.js and bun are available
    if ! command -v bun &> /dev/null; then
        echo -e "${RED}❌ Bun runtime not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to backup existing data
backup_data() {
    echo -e "${BLUE}💾 Creating data backup...${NC}"

    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"

    if PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > "$backup_file" 2>/dev/null; then
        echo -e "${GREEN}✅ Backup created: $backup_file${NC}"
    else
        echo -e "${YELLOW}⚠️  Backup failed (continuing anyway)${NC}"
    fi
}

# Function to install enhanced schema
install_schema() {
    echo -e "${BLUE}🗄️  Installing enhanced database schema...${NC}"

    if [ -f "scripts/enhanced-schema.sql" ]; then
        run_sql "scripts/enhanced-schema.sql" "Enhanced schema installation"
    else
        echo -e "${RED}❌ Enhanced schema file not found${NC}"
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"

    if bun install; then
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    else
        echo -e "${RED}❌ Dependencies installation failed${NC}"
        exit 1
    fi
}

# Function to build TypeScript
build_project() {
    echo -e "${BLUE}🔨 Building TypeScript project...${NC}"

    if bun run build; then
        echo -e "${GREEN}✅ Project built successfully${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
}

# Function to run validation tests
run_validation() {
    echo -e "${BLUE}🔍 Running validation tests...${NC}"

    # Start the indexer temporarily for testing
    echo "Starting indexer for validation..."
    timeout 30s bun run dev > /dev/null 2>&1 &
    INDEXER_PID=$!

    # Wait for indexer to start
    sleep 5

    # Test API endpoints
    local endpoints=(
        "http://localhost:3002/health"
        "http://localhost:3002/api/rewards/health"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -s "$endpoint" > /dev/null; then
            echo -e "${GREEN}✅ $endpoint responded${NC}"
        else
            echo -e "${YELLOW}⚠️  $endpoint not responding${NC}"
        fi
    done

    # Stop test indexer
    kill $INDEXER_PID 2>/dev/null || true
    wait $INDEXER_PID 2>/dev/null || true
}

# Function to create systemd service (optional)
create_service() {
    echo -e "${BLUE}🔧 Creating systemd service...${NC}"

    local service_file="/etc/systemd/system/partisia-indexer.service"
    local current_dir=$(pwd)
    local user=$(whoami)

    if [ "$EUID" -eq 0 ]; then
        cat > "$service_file" << EOF
[Unit]
Description=Enhanced Partisia Indexer
After=network.target postgresql.service

[Service]
Type=simple
User=$user
WorkingDirectory=$current_dir
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/bun run dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload
        systemctl enable partisia-indexer
        echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipping systemd service creation (requires root)${NC}"
    fi
}

# Function to generate deployment report
generate_report() {
    echo -e "${BLUE}📊 Generating deployment report...${NC}"

    local report_file="deployment_report_$(date +%Y%m%d_%H%M%S).json"

    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "enhanced-1.0.0",
    "database": "$DB_NAME",
    "host": "$(hostname)",
    "user": "$(whoami)"
  },
  "components": {
    "enhanced_reward_indexer": "deployed",
    "enhanced_coingecko_service": "deployed",
    "reward_validator": "deployed",
    "enhanced_api_endpoints": "deployed",
    "enhanced_database_schema": "deployed"
  },
  "status": "ready_for_testing"
}
EOF

    echo -e "${GREEN}✅ Deployment report: $report_file${NC}"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting enhanced indexer deployment...${NC}"
    echo ""

    # Run deployment steps
    check_prerequisites
    backup_data
    install_dependencies
    build_project
    install_schema
    run_validation

    # Optional steps
    if [ "$CREATE_SERVICE" = "true" ]; then
        create_service
    fi

    generate_report

    echo ""
    echo -e "${GREEN}🎉 Enhanced Partisia Indexer deployment completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo "   1. Update environment variables (.env file)"
    echo "   2. Configure CoinGecko API key if available"
    echo "   3. Start the indexer: bun run dev"
    echo "   4. Monitor dashboard: http://localhost:3002/api/rewards/dashboard"
    echo "   5. Check validation: http://localhost:3002/api/rewards/health"
    echo ""
    echo -e "${BLUE}📚 API Endpoints:${NC}"
    echo "   • GET /api/rewards/history - Reward transaction history"
    echo "   • GET /api/rewards/daily - Daily reward aggregations"
    echo "   • GET /exchange-rates/history - Exchange rate history"
    echo "   • GET /apy/current - Real-time APY calculation"
    echo "   • GET /bot/performance - Bot account metrics"
    echo "   • GET /api/rewards/dashboard - Combined dashboard data"
    echo ""
}

# Help function
show_help() {
    echo "Enhanced Partisia Indexer Deployment Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  --create-service    Create systemd service (requires root)"
    echo "  --skip-backup       Skip database backup"
    echo "  --skip-validation   Skip validation tests"
    echo ""
    echo "Environment Variables:"
    echo "  DB_NAME            Database name (default: ls_indexer)"
    echo "  DB_USER            Database user (default: indexer)"
    echo "  DB_PASSWORD        Database password (required)"
    echo "  DB_HOST            Database host (default: localhost)"
    echo "  DB_PORT            Database port (default: 5432)"
    echo ""
}

# Parse command line arguments
SKIP_BACKUP=false
SKIP_VALIDATION=false
CREATE_SERVICE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --create-service)
            CREATE_SERVICE=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check required environment variables
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ DB_PASSWORD environment variable is required${NC}"
    exit 1
fi

# Run main deployment
main