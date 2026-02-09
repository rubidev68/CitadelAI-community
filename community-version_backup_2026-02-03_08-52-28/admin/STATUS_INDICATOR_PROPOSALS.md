# Status Indicator Solutions for Chatbot Builder Blocks

## Overview
Blocks requiring crawling (Website Context, Cloud) or installation (Slack) need visual status indicators directly on the frontend canvas.

## Current Status Data Available

### Website Context Blocks
- **Data Source**: `websiteContexts` array in `BlockEditorContext`
- **Status Fields**: 
  - `crawlingStatus.status`: 'idle' | 'starting' | 'crawling' | 'completed' | 'error'
  - `crawlingStatus.progress`: number (current page)
  - `crawlingStatus.total`: number (total pages)
  - `lastCrawledAt`: DateTime
  - `crawledPagesCount`: number

### Cloud Blocks
- **Data Source**: Block `properties.indexingStatus` and `properties.isConnected`
- **Status Fields**:
  - `indexingStatus`: 'idle' | 'indexing' | 'completed' | 'error'
  - `isConnected`: boolean
  - `indexedFileCount`: number
  - `filesDiscovered`: number
  - `lastIndexedAt`: DateTime

### Slack Blocks
- **Data Source**: `getSlackIntegration()` API call
- **Status Fields**:
  - `teamId`: string | null (null = not installed)
  - `isActive`: boolean
  - `installedAt`: DateTime
  - `lastUsedAt`: DateTime | null

---

## Solution Proposals

### Solution 1: Badge Overlay (Top-Right Corner) ⭐ Recommended
**Visual**: Small colored badge with icon in the top-right corner of each block

**Implementation**:
- Add a status badge component that overlays the block
- Badge shows:
  - **Website**: 🟢 (green) = crawled, 🟡 (yellow) = crawling, 🔴 (red) = error, ⚪ (gray) = not crawled
  - **Cloud**: 🟢 = connected & indexed, 🟡 = indexing, 🔴 = error/disconnected, ⚪ = not connected
  - **Slack**: 🟢 = installed, ⚪ = not installed

**Pros**:
- ✅ Non-intrusive, doesn't change block layout
- ✅ Always visible without hover
- ✅ Clear visual distinction
- ✅ Can show progress percentage for crawling/indexing

**Cons**:
- ⚠️ Small size might be hard to see on zoomed-out canvas
- ⚠️ Could overlap with delete button (need positioning adjustment)

**Code Location**: `admin/interface/src/components/blocks/BlockRenderer.tsx`

---

### Solution 2: Status Bar (Bottom of Block)
**Visual**: Thin colored bar at the bottom of each block (similar to progress bars)

**Implementation**:
- Add a status bar component below the block content
- Bar shows:
  - **Color**: Green (ready), Yellow (in progress), Red (error), Gray (not configured)
  - **Progress**: For crawling/indexing, show progress percentage
  - **Text**: "Crawling 45%", "Installed", "Not Configured", etc.

**Pros**:
- ✅ Clear and visible
- ✅ Can show detailed progress information
- ✅ Doesn't interfere with block content
- ✅ Professional appearance

**Cons**:
- ⚠️ Changes block height/layout
- ⚠️ Might make blocks feel cluttered
- ⚠️ Requires more space

**Code Location**: `admin/interface/src/components/blocks/BlockRenderer.tsx`

---

### Solution 3: Colored Border Indicator
**Visual**: Additional colored border or glow effect around the block

**Implementation**:
- Add a colored border/ring around blocks based on status
- Colors:
  - **Green ring**: Ready/Active
  - **Yellow pulsing ring**: In progress
  - **Red ring**: Error/Not configured
  - **Gray ring**: Not set up

**Pros**:
- ✅ Very visible from a distance
- ✅ Doesn't change internal layout
- ✅ Can combine with other indicators

**Cons**:
- ⚠️ Might be too prominent/distracting
- ⚠️ Could clash with selection ring
- ⚠️ Less detailed information visible

**Code Location**: `admin/interface/src/components/blocks/BlockRenderer.tsx`

---

### Solution 4: Status Icon Next to Title
**Visual**: Small status icon next to the block title inside the block

**Implementation**:
- Add status icon in the block content area, next to the title
- Icons:
  - ✅ Checkmark (ready)
  - ⏳ Spinner (in progress)
  - ❌ X (error)
  - ⚠️ Warning (not configured)

**Pros**:
- ✅ Integrated into block design
- ✅ Clear and readable
- ✅ Can show tooltip on hover for details

**Cons**:
- ⚠️ Takes up space in block content
- ⚠️ Might make title area crowded
- ⚠️ Less visible when zoomed out

**Code Location**: `admin/interface/src/components/blocks/BlockRenderer.tsx`

---

### Solution 5: Tooltip-Only Status (Hover)
**Visual**: Status shown only in tooltip when hovering over block

**Implementation**:
- Add tooltip that appears on hover
- Shows detailed status information:
  - Website: "Last crawled: 2 hours ago (150 pages)"
  - Cloud: "Connected | Last indexed: 1 day ago (45 files)"
  - Slack: "Installed in workspace: Acme Corp"

**Pros**:
- ✅ No visual clutter
- ✅ Detailed information available
- ✅ Doesn't affect block appearance

**Cons**:
- ⚠️ Not visible without interaction
- ⚠️ Users might not discover it
- ⚠️ Less useful for quick status checks

**Code Location**: `admin/interface/src/components/blocks/BlockRenderer.tsx`

---

### Solution 6: Hybrid Approach (Badge + Tooltip) ⭐⭐ Best Balance
**Visual**: Small badge indicator + detailed tooltip on hover

**Implementation**:
- Small colored badge in top-right corner (Solution 1)
- Detailed tooltip on hover showing:
  - Current status
  - Progress percentage (if applicable)
  - Last update time
  - Error messages (if any)

**Pros**:
- ✅ Quick visual status at a glance
- ✅ Detailed info available on demand
- ✅ Best of both worlds
- ✅ Professional and polished

**Cons**:
- ⚠️ Slightly more complex implementation
- ⚠️ Still need to handle badge positioning

**Code Location**: `admin/interface/src/components/blocks/BlockRenderer.tsx`

---

## Recommended Implementation: Solution 6 (Hybrid)

### Status Badge Design
```
┌─────────────────────┐
│  [Icon] Title       │
│  Context            │
└─────────────────────┘
         [🟢] ← Badge
```

### Status Definitions

#### Website Context Block
- 🟢 **Green**: `crawlingStatus.status === 'completed'` AND `lastCrawledAt` exists
- 🟡 **Yellow (pulsing)**: `crawlingStatus.status === 'crawling'` OR `'starting'`
- 🔴 **Red**: `crawlingStatus.status === 'error'`
- ⚪ **Gray**: No crawling status or `status === 'idle'` AND no `lastCrawledAt`

#### Cloud Block
- 🟢 **Green**: `isConnected === true` AND `indexingStatus === 'completed'`
- 🟡 **Yellow (pulsing)**: `indexingStatus === 'indexing'`
- 🔴 **Red**: `isConnected === false` OR `indexingStatus === 'error'`
- ⚪ **Gray**: `isConnected === false` AND no connection attempt

#### Slack Block
- 🟢 **Green**: `teamId !== null` AND `isActive === true`
- 🔴 **Red**: `teamId !== null` AND `isActive === false`
- ⚪ **Gray**: `teamId === null` (not installed)

### Tooltip Content Examples

**Website Context**:
```
Status: Crawling
Progress: 45/100 pages (45%)
Current: https://example.com/page-45
Last crawled: Never
```

**Cloud**:
```
Status: Indexing
Progress: 23/50 files (46%)
Provider: Google Drive
Last indexed: 2 hours ago
```

**Slack**:
```
Status: Installed
Workspace: Acme Corp
Installed: 3 days ago
Last used: 1 hour ago
```

---

## Implementation Requirements

### 1. Data Fetching
- **Website**: Already available in `websiteContexts` (polling already implemented)
- **Cloud**: Need to fetch via `getCloudIntegration(blockId, token)` - may need polling
- **Slack**: Need to fetch via `getSlackIntegration(chatbotId, token)` - may need polling

### 2. Status Polling
- Website contexts already poll for active crawls
- Cloud blocks: Poll when `indexingStatus === 'indexing'`
- Slack blocks: Poll when installation is in progress (already implemented in properties panel)

### 3. Component Structure
```typescript
// New component: BlockStatusBadge.tsx
interface BlockStatusBadgeProps {
  block: Block;
  websiteContext?: WebsiteContext;
  cloudIntegration?: CloudIntegration;
  slackIntegration?: SlackIntegration;
}

// Integration in BlockRenderer.tsx
<BlockRenderer>
  {/* existing block content */}
  <BlockStatusBadge 
    block={block}
    websiteContext={websiteContext}
    cloudIntegration={cloudIntegration}
    slackIntegration={slackIntegration}
  />
</BlockRenderer>
```

### 4. Context Updates Needed
- Add `slackIntegrations` array to `BlockEditorContext`
- Add polling for Cloud block status when indexing
- Ensure Website context status is properly synced to blocks

---

## Alternative: Status Panel (Sidebar)
If badges feel too cluttered, consider a dedicated status panel in the sidebar showing all blocks with their statuses in a list format. This would be separate from the main canvas but always visible.

---

## Recommendation Summary

**Primary Choice**: **Solution 6 (Hybrid: Badge + Tooltip)**
- Best balance of visibility and information
- Professional appearance
- Non-intrusive but informative

**Alternative**: **Solution 1 (Badge Only)** if tooltips feel unnecessary
- Simpler implementation
- Still provides quick visual feedback

**Fallback**: **Solution 2 (Status Bar)** if more detailed progress display is needed
- Best for showing detailed progress information
- More space for text/details
