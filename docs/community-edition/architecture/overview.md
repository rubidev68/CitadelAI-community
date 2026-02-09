# Architecture Overview

**Purpose:** Understand the Community Edition architecture

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend Layer"]
        F1[User Interface<br/>React + TypeScript]
        F2[Admin Interface<br/>React + TypeScript]
    end
    
    subgraph Backend["Backend Services"]
        B1[User Backend<br/>Port 3003]
        B2[Admin Backend<br/>Port 3002]
        B3[Crawling Service<br/>Port 3001]
        B4[Cron Scheduler<br/>Port 3004]
    end
    
    subgraph Data["Data Layer"]
        D1[PostgreSQL]
        D2[Weaviate<br/>Vector DB]
    end
    
    subgraph Integrations["Integrations"]
        I1[Nextcloud<br/>Open-Source]
        I2[AI Providers<br/>Gemini, OpenAI, etc.]
    end
    
    F1 --> B1
    F2 --> B2
    B2 --> B3
    B2 --> B4
    B1 --> D1
    B2 --> D1
    B3 --> D2
    B2 --> I1
    B1 --> I2
    
    style I1 fill:#d4edda
```

---

## Component Comparison

### Business vs Community Edition

```mermaid
graph LR
    subgraph Business["Business Edition"]
        BE1[Email Service]
        BE2[Stripe]
        BE3[Slack]
        BE4[GDrive]
        BE5[OneDrive]
        BE6[Nextcloud]
        BE7[Subscription]
    end
    
    subgraph Community["Community Edition"]
        CE1[Nextcloud]
        CE2[Core Services]
    end
    
    BE6 --> CE1
    BE1 -.Remove.-> X1
    BE2 -.Remove.-> X2
    BE3 -.Remove.-> X3
    BE4 -.Remove.-> X4
    BE5 -.Remove.-> X5
    BE7 -.Remove.-> X6
    
    style BE6 fill:#d4edda
    style CE1 fill:#d4edda
    style X1 fill:#f8d7da
    style X2 fill:#f8d7da
    style X3 fill:#f8d7da
    style X4 fill:#f8d7da
    style X5 fill:#f8d7da
    style X6 fill:#f8d7da
```

---

## Service Architecture

### Services in Community Edition

```mermaid
graph TB
    subgraph Services["Community Edition Services"]
        S1[User Backend<br/>✅ Core Service]
        S2[Admin Backend<br/>✅ Core Service]
        S3[Crawling Service<br/>✅ Core Service]
        S4[Cron Scheduler<br/>✅ Core Service]
    end
    
    subgraph Removed["Removed Services"]
        R1[Email Service<br/>❌ Removed]
        R2[Instance Provisioning<br/>❌ Removed]
    end
    
    style S1 fill:#d4edda
    style S2 fill:#d4edda
    style S3 fill:#d4edda
    style S4 fill:#d4edda
    style R1 fill:#f8d7da
    style R2 fill:#f8d7da
```

---

## Integration Architecture

### Cloud Provider Integration

```mermaid
graph TB
    subgraph Business["Business Edition"]
        B1[Google Drive<br/>Proprietary]
        B2[OneDrive<br/>Proprietary]
        B3[Nextcloud<br/>Open-Source]
    end
    
    subgraph Community["Community Edition"]
        C1[Nextcloud<br/>Open-Source<br/>✅ Kept]
    end
    
    B1 -.Remove.-> X1[❌]
    B2 -.Remove.-> X2[❌]
    B3 --> C1
    
    style B3 fill:#d4edda
    style C1 fill:#d4edda
    style X1 fill:#f8d7da
    style X2 fill:#f8d7da
```

---

**Last Updated:** 2026-01-05
