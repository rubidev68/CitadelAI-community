#!/bin/bash

# Log Viewer Script for CitadelAI
# Pretty-prints logs from docker-compose with JSON parsing and colors

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
RESET='\033[0m'
BOLD='\033[1m'

# Default values
SERVICE=""
LINES=100
FOLLOW=false
JSON_MODE=true  # Default to JSON mode for better output
LEVEL_FILTER=""
COMPOSE_FILE=""

# Function to print usage
usage() {
    echo "Usage: $0 [OPTIONS] [SERVICE]"
    echo ""
    echo "View and format logs from docker-compose services"
    echo ""
    echo "Options:"
    echo "  -s, --service SERVICE    Service name (e.g., user-backend, admin-backend)"
    echo "  -c, --file FILE         Docker compose file (e.g., docker-compose.prod.yml)"
    echo "  -n, --lines N           Number of lines to show (default: 100)"
    echo "  -f, --follow            Follow log output (like tail -f)"
    echo "  -j, --json              Parse and pretty-print JSON logs"
    echo "  -l, --level LEVEL       Filter by log level (DEBUG, INFO, WARN, ERROR)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 user-backend                              # View user-backend logs"
    echo "  $0 -c docker-compose.prod.yml user-backend    # Use specific compose file"
    echo "  $0 -s user-backend -f                        # Follow user-backend logs"
    echo "  $0 -s user-backend -j                        # Pretty-print JSON logs"
    echo "  $0 -s user-backend -l ERROR                  # Show only errors"
    echo "  $0 -c docker-compose.prod.yml -f              # Follow all services with prod file"
    echo ""
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        -c|--file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -j|--json)
            JSON_MODE=true
            shift
            ;;
        --no-json)
            JSON_MODE=false
            shift
            ;;
        -l|--level)
            LEVEL_FILTER="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$SERVICE" ]; then
                SERVICE="$1"
            else
                echo "Unknown option: $1"
                usage
            fi
            shift
            ;;
    esac
done

# Check if jq is available for JSON parsing
HAS_JQ=false
if command -v jq &> /dev/null; then
    HAS_JQ=true
fi

# Function to format JSON log entry
format_json_log() {
    local line="$1"
    
    # Remove docker-compose prefix (e.g., "user-backend  | " or "user-backend | ")
    # Handle both single and double spaces before the pipe
    local clean_line=$(echo "$line" | sed -E 's/^[^|]*[[:space:]]*\|[[:space:]]*//')
    
    # Skip empty lines
    if [ -z "$clean_line" ]; then
        return
    fi
    
    # Try to parse as JSON (must be valid JSON)
    if echo "$clean_line" | jq -e . >/dev/null 2>&1; then
        local timestamp=$(echo "$clean_line" | jq -r '.timestamp // empty')
        local level=$(echo "$clean_line" | jq -r '.level // "INFO"')
        local message=$(echo "$clean_line" | jq -r '.message // empty')
        local service=$(echo "$clean_line" | jq -r '.service // empty')
        local correlationId=$(echo "$clean_line" | jq -r '.correlationId // empty')
        local error=$(echo "$clean_line" | jq -r '.error // empty')
        
        # Color based on level
        local color=""
        case "$level" in
            DEBUG) color="$CYAN" ;;
            INFO) color="$GREEN" ;;
            WARN) color="$YELLOW" ;;
            ERROR) color="$RED" ;;
        esac
        
        # Format timestamp
        local timeStr=""
        if [ -n "$timestamp" ]; then
            timeStr=$(echo "$timestamp" | sed 's/T/ /;s/\.\([0-9]\{3\}\)Z$/.\1/')
        fi
        
        # Build formatted line
        local output="${color}[${timeStr}]${RESET} ${color}${level}${RESET} ${message}"
        
        if [ -n "$service" ]; then
            output="${output} ${color}(${service})${RESET}"
        fi
        
        if [ -n "$correlationId" ]; then
            local shortId=$(echo "$correlationId" | cut -c1-8)
            output="${output} ${color}[cid:${shortId}]${RESET}"
        fi
        
        # Add error details if present
        if [ "$error" != "null" ] && [ -n "$error" ]; then
            local errorMsg=$(echo "$clean_line" | jq -r '.error.message // empty')
            if [ -n "$errorMsg" ]; then
                output="${output}\n${color}  ✗ Error:${RESET} ${errorMsg}"
            fi
            local errorStack=$(echo "$clean_line" | jq -r '.error.stack // empty')
            if [ -n "$errorStack" ] && [ "$errorStack" != "null" ]; then
                local stackLines=$(echo "$errorStack" | sed '1d' | sed 's/^/  /')
                output="${output}\n${color}  Stack:${RESET}\n${stackLines}"
            fi
        fi
        
        # Add metadata (excluding already shown fields)
        local metadata=$(echo "$clean_line" | jq -c 'del(.timestamp, .level, .message, .service, .correlationId, .error) | to_entries | map(select(.value != null and .value != "")) | from_entries')
        if [ "$metadata" != "{}" ] && [ "$metadata" != "null" ]; then
            local metadataStr=$(echo "$clean_line" | jq -c 'del(.timestamp, .level, .message, .service, .correlationId, .error)' | jq -r '. | to_entries | map("\(.key)=\(.value)") | join(", ")')
            if [ -n "$metadataStr" ]; then
                output="${output}\n${color}  →${RESET} ${metadataStr}"
            fi
        fi
        
        echo -e "$output"
    else
        # Not JSON, print as-is but remove docker-compose prefix for cleaner output
        echo "$clean_line"
    fi
}

# Function to filter by log level
filter_by_level() {
    local line="$1"
    local filter="$2"
    
    if [ -z "$filter" ]; then
        echo "$line"
        return
    fi
    
    # Check if line contains the level (case-insensitive)
    if echo "$line" | grep -qi "\"level\":\"${filter}\"" || \
       echo "$line" | grep -qiE "\[${filter}\]|${filter}"; then
        echo "$line"
    fi
}

# Detect docker-compose command (docker-compose or docker compose)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Build docker-compose command
COMPOSE_CMD="$DOCKER_COMPOSE_CMD"
if [ -n "$COMPOSE_FILE" ]; then
    COMPOSE_CMD="$COMPOSE_CMD -f $COMPOSE_FILE"
fi
COMPOSE_CMD="$COMPOSE_CMD logs"

if [ "$FOLLOW" = true ]; then
    COMPOSE_CMD="$COMPOSE_CMD -f"
fi

if [ -n "$SERVICE" ]; then
    COMPOSE_CMD="$COMPOSE_CMD $SERVICE"
fi

if [ "$FOLLOW" = false ] && [ -n "$LINES" ]; then
    COMPOSE_CMD="$COMPOSE_CMD --tail=$LINES"
fi

# Execute and process logs
if [ "$JSON_MODE" = true ] && [ "$HAS_JQ" = true ]; then
    # JSON mode with jq
    echo -e "${BOLD}${BLUE}Viewing logs${RESET} ${BOLD}(JSON mode)${RESET}" >&2
    if [ -n "$COMPOSE_FILE" ]; then
        echo -e "${CYAN}Compose file:${RESET} $COMPOSE_FILE" >&2
    fi
    if [ -n "$SERVICE" ]; then
        echo -e "${CYAN}Service:${RESET} $SERVICE" >&2
    fi
    if [ -n "$LEVEL_FILTER" ]; then
        echo -e "${CYAN}Level filter:${RESET} $LEVEL_FILTER" >&2
    fi
    echo "" >&2
    
    # Process logs with unbuffered output for real-time viewing
    # Filter out docker-compose warnings and process each line
    {
        eval "$COMPOSE_CMD" 2>&1 | grep -v '^time=' | while IFS= read -r line || [ -n "$line" ]; do
            # Skip empty lines
            if [ -z "$line" ]; then
                continue
            fi
            
            # Skip docker-compose warning messages (not from the application)
            if echo "$line" | grep -qE '^time=|level=warning.*msg=|level=error.*msg='; then
                continue
            fi
            
            # Remove docker-compose prefix for filtering check
            clean_check=$(echo "$line" | sed -E 's/^[^|]*[[:space:]]*\|[[:space:]]*//')
            
            if [ -n "$LEVEL_FILTER" ]; then
                # Filter before formatting
                if ! echo "$clean_check" | grep -qi "\"level\":\"${LEVEL_FILTER}\"" && \
                   ! echo "$line" | grep -qi "\"level\":\"${LEVEL_FILTER}\""; then
                    continue
                fi
            fi
            
            # Format and output the log line
            format_json_log "$line"
        done
    }
elif [ "$JSON_MODE" = true ] && [ "$HAS_JQ" = false ]; then
    # JSON mode requested but jq not available - use Node.js script instead
    echo -e "${YELLOW}jq not found. Using Node.js script for JSON parsing...${RESET}" >&2
    echo "" >&2
    
    # Build args for Node.js script
    NODE_ARGS=()
    if [ -n "$COMPOSE_FILE" ]; then
        NODE_ARGS+=("-c" "$COMPOSE_FILE")
    fi
    if [ -n "$SERVICE" ]; then
        NODE_ARGS+=("-s" "$SERVICE")
    fi
    if [ "$FOLLOW" = true ]; then
        NODE_ARGS+=("-f")
    fi
    if [ -n "$LINES" ] && [ "$FOLLOW" = false ]; then
        NODE_ARGS+=("-n" "$LINES")
    fi
    if [ -n "$LEVEL_FILTER" ]; then
        NODE_ARGS+=("-l" "$LEVEL_FILTER")
    fi
    
    node view-logs.js "${NODE_ARGS[@]}"
else
    # Simple mode (no JSON parsing)
    echo -e "${BOLD}${BLUE}Viewing logs${RESET}" >&2
    if [ -n "$COMPOSE_FILE" ]; then
        echo -e "${CYAN}Compose file:${RESET} $COMPOSE_FILE" >&2
    fi
    if [ -n "$SERVICE" ]; then
        echo -e "${CYAN}Service:${RESET} $SERVICE" >&2
    fi
    echo "" >&2
    
    eval "$COMPOSE_CMD"
fi
