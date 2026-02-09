#!/usr/bin/env node

/**
 * Log Viewer for CitadelAI
 * Pretty-prints logs from docker-compose with JSON parsing and colors
 * 
 * Usage:
 *   node scripts/view-logs.js [service] [options]
 *   node scripts/view-logs.js user-backend --follow
 *   node scripts/view-logs.js user-backend --json --level ERROR
 */

const { spawn } = require('child_process');
const readline = require('readline');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

// Parse arguments
const args = process.argv.slice(2);
let service = '';
let lines = 100;
let follow = false;
let jsonMode = true; // Default to JSON mode
let levelFilter = '';
let composeFile = '';

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
        case '-s':
        case '--service':
            service = args[++i];
            break;
        case '-c':
        case '--file':
            composeFile = args[++i];
            break;
        case '-n':
        case '--lines':
            lines = parseInt(args[++i], 10);
            break;
        case '-f':
        case '--follow':
            follow = true;
            break;
        case '-j':
        case '--json':
            jsonMode = true;
            break;
        case '--no-json':
            jsonMode = false;
            break;
        case '-l':
        case '--level':
            levelFilter = args[++i].toUpperCase();
            break;
        case '-h':
        case '--help':
            console.log(`
Usage: node scripts/view-logs.js [OPTIONS] [SERVICE]

View and format logs from docker-compose services

Options:
  -s, --service SERVICE    Service name (e.g., user-backend, admin-backend)
  -c, --file FILE          Docker compose file (e.g., docker-compose.prod.yml)
  -n, --lines N           Number of lines to show (default: 100)
  -f, --follow            Follow log output (like tail -f)
  -j, --json              Parse and pretty-print JSON logs (default)
  --no-json               Disable JSON parsing
  -l, --level LEVEL       Filter by log level (DEBUG, INFO, WARN, ERROR)
  -h, --help              Show this help message

Examples:
  node scripts/view-logs.js user-backend
  node scripts/view-logs.js -c docker-compose.prod.yml user-backend
  node scripts/view-logs.js -s user-backend -f
  node scripts/view-logs.js -s user-backend -l ERROR
  node scripts/view-logs.js -c docker-compose.prod.yml -f
`);
            process.exit(0);
        default:
            if (!service && !arg.startsWith('-')) {
                service = arg;
            }
            break;
    }
}

// Get color for log level
function getLevelColor(level) {
    switch (level) {
        case 'DEBUG':
            return colors.cyan;
        case 'INFO':
            return colors.green;
        case 'WARN':
            return colors.yellow;
        case 'ERROR':
            return colors.red;
        default:
            return colors.reset;
    }
}

// Format JSON log entry
function formatJsonLog(line) {
    // Remove docker-compose prefix (e.g., "user-backend  | " or "user-backend | ")
    const cleanLine = line.replace(/^[^|]*\s*\|\s*/, '').trim();

    // Skip empty lines
    if (!cleanLine) {
        return null;
    }

    // Try to parse as JSON
    let logEntry;
    try {
        logEntry = JSON.parse(cleanLine);
    } catch {
        // Not JSON, return as-is (but still remove prefix)
        return cleanLine || line;
    }

    // Filter by level if specified
    if (levelFilter && logEntry.level !== levelFilter) {
        return null;
    }

    const timestamp = logEntry.timestamp || '';
    const level = logEntry.level || 'INFO';
    const message = logEntry.message || '';
    const serviceName = logEntry.service || '';
    const correlationId = logEntry.correlationId || '';
    const error = logEntry.error;

    const color = getLevelColor(level);

    // Format timestamp
    const timeStr = timestamp.replace('T', ' ').replace(/\.(\d{3})Z$/, '.$1');

    // Build formatted line
    let output = `${color}[${timeStr}]${colors.reset} ${color}${level.padEnd(5)}${colors.reset} ${message}`;

    if (serviceName) {
        output += ` ${color}(${serviceName})${colors.reset}`;
    }

    if (correlationId) {
        const shortId = correlationId.substring(0, 8);
        output += ` ${color}[cid:${shortId}]${colors.reset}`;
    }

    // Add error details if present
    if (error) {
        const errorMsg = typeof error === 'string' ? error : (error.message || '');
        if (errorMsg) {
            output += `\n${color}  ✗ Error:${colors.reset} ${errorMsg}`;
        }
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(1);
            output += `\n${color}  Stack:${colors.reset}\n${stackLines.map(l => `  ${l}`).join('\n')}`;
    }
  }
  
  // Add metadata (excluding already shown fields)
  const metadata = { ...logEntry };
  delete metadata.timestamp;
  delete metadata.level;
  delete metadata.message;
  delete metadata.service;
  delete metadata.correlationId;
  delete metadata.error;
  
  const metadataKeys = Object.keys(metadata).filter(k => metadata[k] != null && metadata[k] !== '');
  if (metadataKeys.length > 0) {
    const metadataStr = metadataKeys
      .map(k => `${k}=${typeof metadata[k] === 'object' ? JSON.stringify(metadata[k]) : metadata[k]}`)
      .join(', ');
    output += `\n${color}  →${colors.reset} ${metadataStr}`;
  }
  
  return output;
}

// Detect docker-compose command (docker-compose or docker compose)
const { execSync } = require('child_process');
let dockerComposeCmd = 'docker-compose';
try {
  execSync('which docker-compose', { stdio: 'ignore' });
} catch {
  dockerComposeCmd = 'docker';
}

// Build docker-compose command
const composeArgs = [];
if (dockerComposeCmd === 'docker') {
  composeArgs.push('compose');
}
if (composeFile) {
  composeArgs.push('-f', composeFile);
}
composeArgs.push('logs');

if (follow) {
  composeArgs.push('-f');
}
if (!follow && lines) {
  composeArgs.push('--tail', lines.toString());
}
if (service) {
  composeArgs.push(service);
}

// Execute docker-compose
console.log(`${colors.bold}${colors.blue}Viewing logs${colors.reset}${jsonMode ? ` ${colors.bold}(JSON mode)${colors.reset}` : ''}`);
if (composeFile) {
  console.log(`${colors.cyan}Compose file:${colors.reset} ${composeFile}`);
}
if (service) {
  console.log(`${colors.cyan}Service:${colors.reset} ${service}`);
}
if (levelFilter) {
  console.log(`${colors.cyan}Level filter:${colors.reset} ${levelFilter}`);
}
console.log('');

const dockerCompose = spawn(dockerComposeCmd, composeArgs, {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

const rl = readline.createInterface({
  input: dockerCompose.stdout,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  // Skip docker-compose warning messages
  if (line.match(/^time=|level=warning|level=error.*msg=/)) {
    return;
  }
  
  if (jsonMode) {
    const formatted = formatJsonLog(line);
    if (formatted) {
      console.log(formatted);
    }
  } else {
    // Remove docker-compose prefix for cleaner output
    const cleanLine = line.replace(/^[^|]*\s*\|\s*/, '');
    console.log(cleanLine || line);
  }
});

dockerCompose.stderr.on('data', (data) => {
  process.stderr.write(data);
});

dockerCompose.on('close', (code) => {
  process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  dockerCompose.kill();
  process.exit(0);
});