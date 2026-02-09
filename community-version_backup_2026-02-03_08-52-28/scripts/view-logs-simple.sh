#!/bin/bash
# Simple log viewer that processes docker-compose logs and formats JSON

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
SERVICE="${2:-user-backend}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Check if stdin has data, otherwise use docker-compose
if [ -t 0 ]; then
    # No stdin, use docker-compose
    docker-compose -f "$COMPOSE_FILE" logs "$SERVICE" 2>&1 | \
    grep -v '^time=' | \
    while IFS= read -r line || [ -n "$line" ]; do
    # Remove docker-compose prefix
    clean=$(echo "$line" | sed -E 's/^[^|]*[[:space:]]*\|[[:space:]]*//')
    
    # Try to parse as JSON
    if echo "$clean" | jq -e . >/dev/null 2>&1; then
        timestamp=$(echo "$clean" | jq -r '.timestamp // ""' | sed 's/T/ /;s/\.\([0-9]\{3\}\)Z$/.\1/')
        level=$(echo "$clean" | jq -r '.level // "INFO"')
        message=$(echo "$clean" | jq -r '.message // ""')
        service=$(echo "$clean" | jq -r '.service // ""')
        cid=$(echo "$clean" | jq -r '.correlationId // ""' | cut -c1-8)
        
        # Color based on level
        case "$level" in
            DEBUG) color="$CYAN" ;;
            INFO) color="$GREEN" ;;
            WARN) color="$YELLOW" ;;
            ERROR) color="$RED" ;;
            *) color="" ;;
        esac
        
        # Format output
        output="${color}[${timestamp}]${RESET} ${color}${level}${RESET} ${message}"
        [ -n "$service" ] && output="${output} ${color}(${service})${RESET}"
        [ -n "$cid" ] && output="${output} ${color}[cid:${cid}]${RESET}"
        
        # Add metadata
        metadata=$(echo "$clean" | jq -c 'del(.timestamp, .level, .message, .service, .correlationId, .error)' | jq -r 'to_entries | map("\(.key)=\(.value)") | join(", ")')
        [ "$metadata" != "" ] && [ "$metadata" != "null" ] && output="${output}\n${color}  →${RESET} ${metadata}"
        
        echo -e "$output"
    else
        # Not JSON, just show cleaned line
        echo "$clean"
    fi
    done
else
    # Has stdin, process it
    grep -v '^time=' | \
    while IFS= read -r line || [ -n "$line" ]; do
        # Remove docker-compose prefix
        clean=$(echo "$line" | sed -E 's/^[^|]*[[:space:]]*\|[[:space:]]*//')
        
        # Try to parse as JSON
        if echo "$clean" | jq -e . >/dev/null 2>&1; then
            timestamp=$(echo "$clean" | jq -r '.timestamp // ""' | sed 's/T/ /;s/\.\([0-9]\{3\}\)Z$/.\1/')
            level=$(echo "$clean" | jq -r '.level // "INFO"')
            message=$(echo "$clean" | jq -r '.message // ""')
            service=$(echo "$clean" | jq -r '.service // ""')
            cid=$(echo "$clean" | jq -r '.correlationId // ""' | cut -c1-8)
            
            # Color based on level
            case "$level" in
                DEBUG) color="$CYAN" ;;
                INFO) color="$GREEN" ;;
                WARN) color="$YELLOW" ;;
                ERROR) color="$RED" ;;
                *) color="" ;;
            esac
            
            # Format output
            output="${color}[${timestamp}]${RESET} ${color}${level}${RESET} ${message}"
            [ -n "$service" ] && output="${output} ${color}(${service})${RESET}"
            [ -n "$cid" ] && output="${output} ${color}[cid:${cid}]${RESET}"
            
            # Add metadata
            metadata=$(echo "$clean" | jq -c 'del(.timestamp, .level, .message, .service, .correlationId, .error)' | jq -r 'to_entries | map("\(.key)=\(.value)") | join(", ")')
            [ "$metadata" != "" ] && [ "$metadata" != "null" ] && output="${output}\n${color}  →${RESET} ${metadata}"
            
            echo -e "$output"
        else
            # Not JSON, just show cleaned line
            echo "$clean"
        fi
    done
fi
